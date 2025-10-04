require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

// Расписание cron (по умолчанию каждые 30 минут)
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '*/30 * * * *';
const RUN_ONCE = process.env.RUN_ONCE === 'true';

console.log('🚀 Запуск полного флоу парсинга Telegram каналов\n');
if (!RUN_ONCE) {
  console.log(`⏰ Режим: по расписанию (${CRON_SCHEDULE})`);
  console.log('💡 Для одиночного запуска: RUN_ONCE=true node run-full-flow.js\n');
}

async function runFullFlow() {
  const startTime = new Date();
  console.log(`\n🕐 Запуск: ${startTime.toLocaleString('ru-RU')}`);

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

    // 3. Очистка временных файлов
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧹 Этап 3: Очистка временных файлов');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Удаляем JSON файл
    if (fs.existsSync(parsedFile)) {
      fs.unlinkSync(parsedFile);
      console.log('✅ Удален: parsed_messages.json');
    }

    // Удаляем все изображения
    const imagesDir = path.resolve(__dirname, 'scripts/images');
    if (fs.existsSync(imagesDir)) {
      const files = fs.readdirSync(imagesDir);
      let deletedCount = 0;
      files.forEach(file => {
        const filePath = path.join(imagesDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      });
      console.log(`✅ Удалено изображений: ${deletedCount}`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Полный флоу завершен!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📊 Проверить результаты:');
    console.log('   API: http://localhost:3000/api/listings');
    console.log('   Swagger: http://localhost:3000/api-docs');
    console.log('   Категории: http://localhost:3000/api/listings?category=goods');

    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    console.log(`\n⏱️  Время выполнения: ${duration} сек`);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (RUN_ONCE) {
      process.exit(1);
    }
  }
}

// Запуск
if (RUN_ONCE) {
  runFullFlow().then(() => process.exit(0));
} else {
  // Запускаем сразу при старте
  runFullFlow();

  // Настраиваем периодический запуск по расписанию
  cron.schedule(CRON_SCHEDULE, () => {
    runFullFlow();
  });

  console.log('✅ Планировщик запущен. Нажмите Ctrl+C для остановки.');
}
