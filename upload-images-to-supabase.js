require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const BUCKET_NAME = 'listings-images';
const IMAGES_DIR = path.resolve(__dirname, '../telegram-parser/images');

async function uploadImagesToSupabase() {
  console.log('📤 Загрузка картинок в Supabase Storage...\n');

  // Проверяем существование bucket (bucket уже создан через SQL)
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);

  if (!bucketExists) {
    console.log('❌ Bucket не найден. Создайте его через Supabase Dashboard или SQL.');
    console.log('   SQL: INSERT INTO storage.buckets (id, name, public) VALUES (\'listings-images\', \'listings-images\', true);');
    return;
  }

  console.log('✅ Bucket найден\n');

  // Получаем список файлов
  if (!fs.existsSync(IMAGES_DIR)) {
    console.log('❌ Папка с картинками не найдена:', IMAGES_DIR);
    return;
  }

  const imageFiles = fs.readdirSync(IMAGES_DIR)
    .filter(file => file.endsWith('.jpg') || file.endsWith('.png'));

  console.log(`📊 Найдено ${imageFiles.length} картинок\n`);

  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  for (const filename of imageFiles) {
    const filePath = path.join(IMAGES_DIR, filename);
    const fileBuffer = fs.readFileSync(filePath);

    // Проверяем, не загружен ли уже
    const { data: existingFile } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', { search: filename });

    if (existingFile && existingFile.length > 0) {
      console.log(`⏭️  ${filename} - уже загружен`);
      skipped++;
      continue;
    }

    // Загружаем файл
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, fileBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error(`❌ ${filename} - ошибка:`, error.message);
      errors++;
    } else {
      console.log(`✅ ${filename}`);
      uploaded++;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Загрузка завершена!');
  console.log(`📊 Загружено: ${uploaded}`);
  console.log(`⏭️  Пропущено: ${skipped}`);
  console.log(`❌ Ошибок: ${errors}`);
  console.log('\n🌐 Картинки доступны по URL:');
  console.log(`   ${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/[filename]`);
}

uploadImagesToSupabase().catch(console.error);
