require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function clearDatabase() {
  console.log('🗑️  Очистка базы данных...\n');

  // Удаляем listings
  const { error: listingsError } = await supabase
    .from('listings')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (listingsError) {
    console.error('❌ Ошибка удаления listings:', listingsError);
  } else {
    console.log('✅ Все listings удалены');
  }

  // Удаляем raw_messages
  const { error: messagesError } = await supabase
    .from('raw_messages')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (messagesError) {
    console.error('❌ Ошибка удаления raw_messages:', messagesError);
  } else {
    console.log('✅ Все raw_messages удалены');
  }

  // Очищаем папку с картинками
  const imagesDir = path.resolve(__dirname, 'scripts/images');
  if (fs.existsSync(imagesDir)) {
    const files = fs.readdirSync(imagesDir);
    files.forEach(file => {
      fs.unlinkSync(path.join(imagesDir, file));
    });
    console.log(`✅ Удалено ${files.length} картинок из scripts/images`);
  }

  // Очищаем JSON файл
  const jsonPath = path.resolve(__dirname, 'scripts/parsed_messages.json');
  if (fs.existsSync(jsonPath)) {
    fs.unlinkSync(jsonPath);
    console.log('✅ Удален parsed_messages.json');
  }

  console.log('\n✅ База данных и файлы очищены!');
}

clearDatabase().catch(console.error);
