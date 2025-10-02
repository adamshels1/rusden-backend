require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testUpload() {
  const BUCKET_NAME = 'listings-images';
  const IMAGES_DIR = path.resolve(__dirname, '../telegram-parser/images');

  // Берем первую картинку
  const files = fs.readdirSync(IMAGES_DIR).filter(f => f.endsWith('.jpg'));
  if (files.length === 0) {
    console.log('Нет картинок для теста');
    return;
  }

  const testFile = files[0];
  const filePath = path.join(IMAGES_DIR, testFile);

  console.log(`📸 Тестируем загрузку: ${testFile}\n`);

  // Сжимаем
  const originalSize = fs.statSync(filePath).size;
  console.log(`📏 Оригинальный размер: ${Math.round(originalSize/1024)} KB`);

  const compressedBuffer = await sharp(filePath)
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
  const savedPercent = Math.round((1 - compressedSize / originalSize) * 100);

  console.log(`🗜️  Сжатый размер: ${Math.round(compressedSize/1024)} KB (-${savedPercent}%)\n`);

  // Загружаем
  console.log('📤 Загружаем в Supabase Storage...');
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(`test-${testFile}`, compressedBuffer, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    console.error('❌ Ошибка:', error);
    return;
  }

  // Получаем URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(`test-${testFile}`);

  console.log('✅ Успешно загружено!');
  console.log(`🌐 URL: ${urlData.publicUrl}`);
}

testUpload().catch(console.error);
