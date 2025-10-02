const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk').default;
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Каналы для парсинга
const CHANNELS = [
  { username: 'alanyadom', title: 'Alanya Недвижимость' },
  { username: 'AntalyaLife', title: 'Анталия Life' },
];

async function parseRealChannels() {
  console.log('🚀 Запуск реального парсинга Telegram каналов\n');
  
  // 1. Добавляем каналы в базу
  console.log('📝 Добавляем каналы в базу данных...');
  for (const channel of CHANNELS) {
    const { data: existing } = await supabase
      .from('channels')
      .select('id')
      .eq('username', channel.username)
      .single();
    
    if (!existing) {
      const { data, error } = await supabase
        .from('channels')
        .insert({
          telegram_id: `@${channel.username}`,
          username: channel.username,
          title: channel.title,
          description: `Канал ${channel.title}`,
          is_active: true,
        })
        .select()
        .single();
      
      if (error) {
        console.log(`❌ Ошибка добавления канала ${channel.username}:`, error.message);
      } else {
        console.log(`✅ Канал добавлен: ${channel.username} (${data.id})`);
      }
    } else {
      console.log(`⏭️  Канал уже существует: ${channel.username}`);
    }
  }
  
  console.log('\n📡 Запуск парсера Telegram...\n');
  
  // 2. Запускаем telegram-parser для каждого канала
  for (const channel of CHANNELS) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📱 Парсим канал: ${channel.username}`);
    
    try {
      // Запускаем parser-json.js для канала
      const parserPath = path.resolve(__dirname, '../telegram-parser/parser-json.js');
      
      if (!fs.existsSync(parserPath)) {
        console.log(`⚠️  Парсер не найден: ${parserPath}`);
        console.log('💡 Используем тестовый режим - пропускаем парсинг');
        continue;
      }
      
      console.log('⏳ Запускаем MTProto парсер...');
      
      // Запускаем парсер (это занимает время)
      execSync(`cd ../telegram-parser && node parser-json.js ${channel.username}`, {
        stdio: 'inherit',
        timeout: 60000, // 1 минута
      });
      
      // 3. Читаем результаты парсинга
      const messagesFile = path.resolve(__dirname, '../telegram-parser/parsed_messages.json');
      
      if (!fs.existsSync(messagesFile)) {
        console.log('⚠️  Файл parsed_messages.json не найден');
        continue;
      }
      
      const messages = JSON.parse(fs.readFileSync(messagesFile, 'utf-8'));
      console.log(`📨 Получено ${messages.length} сообщений`);
      
      // 4. Сохраняем в raw_messages
      const { data: channelData } = await supabase
        .from('channels')
        .select('id')
        .eq('username', channel.username)
        .single();
      
      if (!channelData) continue;
      
      for (const msg of messages) {
        // Проверяем, не было ли уже
        const { data: existing } = await supabase
          .from('raw_messages')
          .select('id')
          .eq('channel_id', channelData.id)
          .eq('telegram_message_id', msg.id)
          .single();
        
        if (existing) continue;
        
        // Сохраняем
        const { data: savedMsg } = await supabase
          .from('raw_messages')
          .insert({
            channel_id: channelData.id,
            telegram_message_id: msg.id,
            raw_text: msg.text,
            author_info: msg.author,
            media_urls: msg.images || [],
            message_date: msg.date,
          })
          .select()
          .single();
        
        if (savedMsg) {
          console.log(`✅ Сохранено сообщение #${msg.id}`);
          
          // 5. Обрабатываем через AI
          try {
            const completion = await groq.chat.completions.create({
              model: 'llama-3.3-70b-versatile',
              messages: [
                {
                  role: 'system',
                  content: 'Ты помощник по категоризации объявлений. Возвращай JSON с полями: category, title, description, price_amount, price_currency, city, contact_telegram, confidence.'
                },
                {
                  role: 'user',
                  content: `Проанализируй: "${msg.text}"`
                }
              ],
              temperature: 0.3,
              response_format: { type: 'json_object' },
            });
            
            const aiResult = JSON.parse(completion.choices[0].message.content);
            
            // Сохраняем listing
            await supabase.from('listings').insert({
              raw_message_id: savedMsg.id,
              category: aiResult.category || 'goods',
              title: aiResult.title || 'Без названия',
              description: aiResult.description || msg.text,
              price: aiResult.price_amount,
              currency: aiResult.price_currency,
              location: aiResult.city,
              contact_info: { telegram: aiResult.contact_telegram },
              posted_date: msg.date,
              ai_confidence: aiResult.confidence || 0.5,
            });
            
            console.log(`🤖 AI: ${aiResult.category} - ${aiResult.title}`);
          } catch (aiError) {
            console.log(`⚠️  AI ошибка:`, aiError.message);
          }
        }
      }
      
    } catch (error) {
      console.log(`❌ Ошибка парсинга канала ${channel.username}:`, error.message);
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n✅ Парсинг завершен!');
  
  // Статистика
  const { data: stats } = await supabase
    .from('listings')
    .select('category');
  
  const categoryCounts = stats.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});
  
  console.log('\n📊 Статистика объявлений:');
  Object.entries(categoryCounts).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
  console.log(`\n📋 Всего: ${stats.length} объявлений`);
}

parseRealChannels().catch(console.error);
