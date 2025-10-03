require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

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

  console.log('\n✅ База данных очищена!');
}

clearDatabase().catch(console.error);
