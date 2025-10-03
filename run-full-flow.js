require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Запуск полного флоу парсинга Telegram каналов\n');

const CHANNELS = [
  { username: '@realty_in_turkey', title: 'Турция недвижимость | Аренда' },
];

async function runFullFlow() {
  try {
    // 1. Парсинг Telegram каналов
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📡 Этап 1: Парсинг Telegram каналов');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const channel of CHANNELS) {
      console.log(`📱 Парсинг канала: ${channel.username}`);

      try {
        execSync(
          `cd scripts && node parser-json.js ${channel.username}`,
          {
            stdio: 'inherit',
            timeout: 120000 // 2 минуты на канал
          }
        );
        console.log(`✅ Канал ${channel.username} спарсен\n`);
      } catch (error) {
        console.log(`⚠️  Парсинг канала ${channel.username} завершен с ошибкой (возможно таймаут)\n`);
      }
    }

    // Проверяем наличие файла
    const parsedFile = path.resolve(__dirname, 'scripts/parsed_messages.json');
    if (!fs.existsSync(parsedFile)) {
      console.log('❌ Файл parsed_messages.json не найден');
      return;
    }

    const messages = JSON.parse(fs.readFileSync(parsedFile, 'utf8'));
    console.log(`✅ Найдено ${messages.length} сообщений\n`);

    // 2. Обработка через AI и сохранение в БД
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 Этап 2: Обработка через AI и сохранение в БД');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    execSync('node process-parsed-messages.js', {
      stdio: 'inherit',
      timeout: 300000 // 5 минут на обработку
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Полный флоу завершен!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📊 Проверить результаты:');
    console.log('   API: http://localhost:3000/api/listings');
    console.log('   Swagger: http://localhost:3000/api-docs');
    console.log('   Категории: http://localhost:3000/api/listings?category=goods');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

runFullFlow();
