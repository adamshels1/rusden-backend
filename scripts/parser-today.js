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

const imagesDir = path.resolve(__dirname, './images');
fs.ensureDirSync(imagesDir);

const outputPath = path.resolve(__dirname, 'parsed_messages.json');

async function downloadPhoto(photo, messageId, retryCount = 0) {
  try {
    const size = photo.sizes[photo.sizes.length - 1];

    const fileLocation = {
      _: 'inputPhotoFileLocation',
      id: photo.id,
      access_hash: photo.access_hash,
      file_reference: photo.file_reference,
      thumb_size: size.type,
    };

    const result = await mtproto.call('upload.getFile', {
      location: fileLocation,
      offset: 0,
      limit: 1024 * 1024,
    });

    const fileName = `${messageId}_${photo.id}.jpg`;
    const filePath = path.join(imagesDir, fileName);

    await fs.writeFile(filePath, result.bytes);

    return fileName;
  } catch (error) {
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
    const resolvedPeer = await mtproto.call('contacts.resolveUsername', {
      username: username.replace('@', ''),
    });

    const messages = await mtproto.call('messages.getHistory', {
      peer: {
        _: 'inputPeerChannel',
        channel_id: resolvedPeer.chats[0].id,
        access_hash: resolvedPeer.chats[0].access_hash,
      },
      limit: 100, // Больше лимит для получения всех сегодняшних
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
  console.log('\n🚀 Парсинг объявлений за сегодня...\n');

  // ========================================
  // 📝 ЗДЕСЬ ДОБАВЛЯЙТЕ КАНАЛЫ:
  // ========================================
  const channels = [
    'antalia_sales',
    'realty_in_turkey',
  ];

  // Загружаем существующие данные
  let existingData = [];
  if (await fs.pathExists(outputPath)) {
    existingData = await fs.readJSON(outputPath);
    console.log(`📂 Загружено ${existingData.length} существующих объявлений\n`);
  }

  const existingIds = new Set(existingData.map(m => m.id));

  // Начало сегодняшнего дня (00:00:00)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = Math.floor(today.getTime() / 1000);

  let totalNewCount = 0;
  let totalTodayCount = 0;

  for (const channel of channels) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📡 Парсинг канала: @${channel}`);
    console.log('='.repeat(60) + '\n');

    try {
      const result = await getChannelMessages(channel);

    console.log(`📊 Получено сообщений из API: ${result.messages.length}\n`);

    let newCount = 0;
    let todayCount = 0;

    for (let index = 0; index < result.messages.length; index++) {
      const msg = result.messages[index];

      // Проверяем дату - если сообщение старше сегодня, прерываем цикл
      if (msg.date < todayTimestamp) {
        console.log(`⏹️  Достигли сообщений старше сегодня, останавливаем парсинг\n`);
        break;
      }

      if (msg._ === 'message' && msg.message) {
        todayCount++;

        // Проверяем, не добавлено ли уже
        if (existingIds.has(msg.id)) {
          console.log(`⏭️  Сообщение ${msg.id} уже существует, пропускаем`);
          continue;
        }

        newCount++;
        console.log(`⏳ Новое сообщение ${newCount} (ID: ${msg.id})...`);

        const messageData = {
          id: msg.id,
          date: new Date(msg.date * 1000).toISOString(),
          text: msg.message,
          author: null,
          images: [],
          hasButtons: !!msg.reply_markup,
        };

        // Информация об авторе
        if (msg.from_id) {
          const author = result.users.find(u => u.id === msg.from_id.user_id);
          if (author) {
            messageData.author = {
              id: author.id,
              firstName: author.first_name || '',
              lastName: author.last_name || '',
              username: author.username || null,
              phone: author.phone ? `+${author.phone}` : null,
            };

            console.log(`  👤 Автор: ${author.first_name || ''} ${author.last_name || ''} ${author.username ? `(@${author.username})` : ''}`);
          }
        }

        // Скачиваем фото
        if (msg.media && msg.media._ === 'messageMediaPhoto' && msg.media.photo) {
          console.log('  ⬇️  Скачиваю фото...');
          await sleep(1000);
          const fileName = await downloadPhoto(msg.media.photo, msg.id);
          if (fileName) {
            messageData.images.push(fileName);
            console.log(`  ✅ Сохранено: ${fileName}`);
          }
        }

        existingData.push(messageData);
        existingIds.add(msg.id); // Добавляем ID чтобы не дублировать
      }
    }

    totalNewCount += newCount;
    totalTodayCount += todayCount;

    console.log(`\n📊 Канал @${channel}: ${todayCount} сообщений за сегодня, ${newCount} новых\n`);

    // Задержка между каналами
    await sleep(3000);

  } catch (error) {
    console.error(`❌ Ошибка при парсинге @${channel}:`, error.error_message || error.message);
  }
}

  // Сохраняем обновленные данные
  await fs.writeJSON(outputPath, existingData, { spaces: 2 });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Парсинг завершен!`);
  console.log(`📊 Всего сообщений за сегодня: ${totalTodayCount}`);
  console.log(`🆕 Новых добавлено: ${totalNewCount}`);
  console.log(`📁 Всего в базе: ${existingData.length}`);
  console.log(`💾 Файл: parsed_messages.json`);
  console.log('='.repeat(60) + '\n');

})();
