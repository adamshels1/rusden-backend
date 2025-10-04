require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Запуск полного флоу парсинга Telegram каналов\n');

async function runFullFlow() {
  try {
    // 1. Парсинг Telegram каналов
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📡 Этап 1: Парсинг Telegram каналов');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    execSync('cd scripts && node parser-json.js', {
      stdio: 'inherit',
      timeout: 300000 // 5 минут на все каналы
    });

    // Проверяем наличие файла
    const parsedFile = path.resolve(__dirname, 'scripts/parsed_messages.json');
    if (!fs.existsSync(parsedFile)) {
      console.log('❌ Файл parsed_messages.json не найден');
      return;
    }

    const messages = JSON.parse(fs.readFileSync(parsedFile, 'utf8'));
    console.log(`✅ Найдено ${messages.length} сообщений`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

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
