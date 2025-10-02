// Скрипт для миграции картинок из Supabase Storage
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const https = require('https');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const file = fs.createWriteStream(filepath);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', reject);
  });
}

async function migrateStorage() {
  console.log('📦 Экспорт картинок из Supabase Storage...');

  // Получаем список всех файлов
  const { data: files, error } = await supabase
    .storage
    .from('listings-images')
    .list();

  if (error) {
    console.error('Ошибка:', error);
    return;
  }

  const exportDir = './exported-images';
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir);
  }

  console.log(`Найдено ${files.length} файлов`);

  for (const file of files) {
    const { data } = supabase
      .storage
      .from('listings-images')
      .getPublicUrl(file.name);

    const filepath = path.join(exportDir, file.name);

    console.log(`⬇️  ${file.name}`);
    await downloadImage(data.publicUrl, filepath);
  }

  console.log('✅ Экспорт завершен!');
  console.log(`📁 Файлы сохранены в: ${exportDir}`);
}

migrateStorage();
