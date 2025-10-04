require('dotenv').config();
const MTProto = require('@mtproto/core');
const path = require('path');
const fs = require('fs-extra');
const sharp = require('sharp');

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

    const originalSize = result.bytes.length;
    const MIN_SIZE_TO_COMPRESS = 100 * 1024; // 100 KB

    // Если файл больше 100KB - сжимаем
    if (originalSize > MIN_SIZE_TO_COMPRESS) {
      const compressedBuffer = await sharp(result.bytes)
        .resize(1200, 1200, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({
          quality: 80,
          progressive: true
        })
        .toBuffer();

      const compressedSize = compressedBuffer.length;

      // Сохраняем только если сжатие действительно уменьшило размер
      if (compressedSize < originalSize) {
        await fs.writeFile(filePath, compressedBuffer);
        const savedPercent = Math.round((1 - compressedSize / originalSize) * 100);
        console.log(`  🗜️  Сжато: ${Math.round(originalSize/1024)}KB → ${Math.round(compressedSize/1024)}KB (-${savedPercent}%)`);
      } else {
        // Сжатие не помогло, сохраняем оригинал
        await fs.writeFile(filePath, result.bytes);
      }
    } else {
      // Файл маленький, сохраняем как есть
      await fs.writeFile(filePath, result.bytes);
    }

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
      limit: 5, // Увеличил лимит
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
  console.log('\n🚀 Запуск парсера с сохранением в JSON...\n');

  const channels = [
    'realty_in_turkey', 
    // 'antalia_sales',
    // 'turkey_obyavlenia_uslugi'
    // 'rabota_antaliai'
  ];
  const parsedData = [];

  try {
    for (const channel of channels) {
      console.log(`📱 Парсинг канала: @${channel}\n`);

      const result = await getChannelMessages(channel);

      console.log(`📊 Найдено сообщений: ${result.messages.length}\n`);

      let processedCount = 0;
      for (let index = 0; index < result.messages.length; index++) {
        const msg = result.messages[index];

        if (msg._ === 'message' && msg.message) {
          processedCount++;
          console.log(`⏳ Обработка сообщения ${processedCount} (${index + 1}/${result.messages.length})...`);

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

          parsedData.push(messageData);
        }
      }

      console.log(`\n✅ Канал @${channel} обработан\n`);
    }

    // Сохраняем в JSON
    const outputPath = path.resolve(__dirname, 'parsed_messages.json');
    await fs.writeJSON(outputPath, parsedData, { spaces: 2 });

    console.log(`\n✅ Парсинг завершен!`);
    console.log(`📁 Сохранено ${parsedData.length} сообщений в: parsed_messages.json\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка:', error.error_message || error.message);
    process.exit(1);
  }
})();
