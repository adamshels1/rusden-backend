require('dotenv').config();
const MTProto = require('@mtproto/core');
const path = require('path');
const fs = require('fs-extra');

const api_id = parseInt(process.env.API_ID);
const api_hash = process.env.API_HASH;

const mtproto = new MTProto({
  api_id,
  api_hash,
  storageOptions: {
    path: path.resolve(__dirname, './data.json'),
  },
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Создаем папку для изображений
const imagesDir = path.resolve(__dirname, './images');
fs.ensureDirSync(imagesDir);

async function downloadPhoto(photo, messageId, retryCount = 0) {
  try {
    // Получаем самое большое фото (последнее в массиве sizes)
    const size = photo.sizes[photo.sizes.length - 1];

    const fileLocation = {
      _: 'inputPhotoFileLocation',
      id: photo.id,
      access_hash: photo.access_hash,
      file_reference: photo.file_reference,
      thumb_size: size.type,
    };

    // Скачиваем файл
    const result = await mtproto.call('upload.getFile', {
      location: fileLocation,
      offset: 0,
      limit: 1024 * 1024, // 1MB за раз
    });

    const fileName = `${messageId}_${photo.id}.jpg`;
    const filePath = path.join(imagesDir, fileName);

    await fs.writeFile(filePath, result.bytes);

    return fileName;
  } catch (error) {
    // Обработка FILE_MIGRATE
    if (error.error_message && error.error_message.includes('FILE_MIGRATE_') && retryCount < 1) {
      const [, dc] = error.error_message.match(/FILE_MIGRATE_(\d+)/);
      await mtproto.setDefaultDc(+dc);
      await sleep(1000);
      return downloadPhoto(photo, messageId, retryCount + 1);
    }

    console.error(`  ❌ Ошибка скачивания фото: ${error.error_message || error.message}`);
    return null;
  }
}

async function getChannelMessages(username, retryCount = 0) {
  try {
    // Получаем информацию о канале
    const resolvedPeer = await mtproto.call('contacts.resolveUsername', {
      username: username.replace('@', ''),
    });

    console.log(`✅ Канал найден: ${resolvedPeer.chats[0].title}`);
    console.log(`👥 Подписчиков: ${resolvedPeer.chats[0].participants_count || 'N/A'}\n`);

    // Получаем сообщения
    const messages = await mtproto.call('messages.getHistory', {
      peer: {
        _: 'inputPeerChannel',
        channel_id: resolvedPeer.chats[0].id,
        access_hash: resolvedPeer.chats[0].access_hash,
      },
      limit: 50, // Увеличил лимит
      offset_id: 0,
      offset_date: 0,
      add_offset: 0,
      max_id: 0,
      min_id: 0,
      hash: 0,
    });

    return messages;
  } catch (error) {
    if (error.error_message && error.error_message.includes('_MIGRATE_') && retryCount < 1) {
      const match = error.error_message.match(/_MIGRATE_(\d+)/);
      if (match) {
        const dc = match[1];
        console.log(`🔄 Переключение на DC${dc}...`);
        await mtproto.setDefaultDc(+dc);
        await sleep(2000);
        return getChannelMessages(username, retryCount + 1);
      }
    }
    throw error;
  }
}

(async () => {
  console.log('\n🚀 Запуск MTProto парсера...\n');

  const channel = 'antalia_sales';

  try {
    console.log('='.repeat(60));
    console.log(`📡 Парсинг канала: @${channel}`);
    console.log('='.repeat(60) + '\n');

    await sleep(2000);

    const result = await getChannelMessages(channel);

    console.log(`📊 Найдено сообщений: ${result.messages.length}\n`);

    for (let index = 0; index < result.messages.length; index++) {
      const msg = result.messages[index];

      if (msg._ === 'message' && msg.message) {
        console.log('─'.repeat(60));
        console.log(`📄 Сообщение ${index + 1}`);
        console.log('─'.repeat(60));
        console.log(`🆔 ID: ${msg.id}`);
        console.log(`📅 Дата: ${new Date(msg.date * 1000).toLocaleString('ru-RU')}`);

        // Получаем информацию об авторе
        if (msg.from_id) {
          const author = result.users.find(u => u.id === msg.from_id.user_id);
          if (author) {
            console.log(`👤 Автор: ${author.first_name || ''} ${author.last_name || ''}`.trim());
            if (author.username) {
              console.log(`📱 Username: @${author.username}`);
            }
            if (author.phone) {
              console.log(`☎️  Телефон: +${author.phone}`);
            }
          }
        }

        console.log(`📝 Текст:`);
        console.log(msg.message.substring(0, 300));
        if (msg.message.length > 300) {
          console.log('...');
        }

        if (msg.media) {
          console.log(`📎 Медиа: ${msg.media._}`);

          // Скачиваем фото
          if (msg.media._ === 'messageMediaPhoto' && msg.media.photo) {
            console.log('  ⬇️  Скачиваю фото...');
            await sleep(1000); // Задержка перед скачиванием
            const fileName = await downloadPhoto(msg.media.photo, msg.id);
            if (fileName) {
              console.log(`  ✅ Сохранено: images/${fileName}`);
            }
          }
        }

        if (msg.reply_markup) {
          console.log(`🔘 Есть кнопки`);
        }
        console.log('');
      }
    }

    console.log('✅ Парсинг завершен!\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.error_message || error.message);

    if (error.error_message && error.error_message.includes('AUTH_KEY')) {
      console.log('\n⚠️  Нужно авторизоваться! Запустите: node simple-auth.js\n');
    }
  }
})();
