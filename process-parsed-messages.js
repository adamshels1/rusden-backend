require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk').default;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `Ты — AI-агент для классификации объявлений из русскоязычных Telegram-каналов в Турции.

Твоя задача: классифицировать сообщение в одну из категорий и извлечь структурированные данные.

**Категории:**
- realty: недвижимость (аренда, продажа, куплю)
- job: вакансии, резюме, поиск работы
- service: услуги (ремонт, уборка, такси, доставка и т.д.)
- goods: продажа товаров (мебель, техника, одежда и т.д.)
- event: мероприятия, встречи, анонсы

**Отвечай ТОЛЬКО в JSON формате:**
{
  "category": "realty" | "job" | "service" | "goods" | "event" | "other",
  "subcategory": "например: долгосрочная аренда, вакансия официанта, и т.д.",
  "title": "краткое описание (до 100 символов)",
  "description": "полное описание",
  "price": {
    "amount": число или null,
    "currency": "EUR" | "USD" | "TRY" | null,
    "period": "month" | "day" | "once" | null
  },
  "location": {
    "city": "Alanya, Antalya, Istanbul и т.д. или null",
    "district": "район города или null"
  },
  "contact": {
    "phone": "номер телефона или null",
    "telegram": "юзернейм телеграм или null",
    "other": "другие контакты или null"
  },
  "realty": {
    "rooms": "1+1, 2+1, studio и т.д. или null",
    "area_sqm": число или null,
    "floor": число или null,
    "distance_to_sea": число в метрах или null
  },
  "language": "ru" | "en" | "tr",
  "is_spam": true | false,
  "confidence": 0.0-1.0
}`;

async function categorizeMessage(text) {
  const userPrompt = `Классифицируй это объявление:\n\n${text}`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(completion.choices[0].message.content);
}

async function processMessages() {
  console.log('🚀 Обработка спарсенных сообщений\n');

  // Читаем спарсенные сообщения
  const parsedPath = path.resolve(__dirname, '../telegram-parser/parsed_messages.json');
  const messages = JSON.parse(fs.readFileSync(parsedPath, 'utf8'));

  console.log(`📊 Найдено ${messages.length} сообщений\n`);

  // Получаем ID канала alanyadom (предполагаем, что это он)
  const { data: channel } = await supabase
    .from('channels')
    .select('id')
    .eq('username', 'alanyadom')
    .single();

  if (!channel) {
    console.error('❌ Канал не найден');
    return;
  }

  let processed = 0;
  let skipped = 0;

  for (const msg of messages) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📝 Сообщение ${msg.id}`);
    console.log(`📄 Текст: ${msg.text.substring(0, 100)}...`);

    // Проверяем, не обработано ли уже
    const { data: existing } = await supabase
      .from('raw_messages')
      .select('id')
      .eq('channel_id', channel.id)
      .eq('telegram_message_id', msg.id)
      .single();

    if (existing) {
      console.log('⏭️  Уже обработано, пропускаем');
      skipped++;
      continue;
    }

    // Сохраняем raw_message
    const { data: rawMessage, error: rawError } = await supabase
      .from('raw_messages')
      .insert({
        channel_id: channel.id,
        telegram_message_id: msg.id,
        raw_text: msg.text,
        author_info: {
          id: msg.author.id,
          username: msg.author.username,
          firstName: msg.author.firstName,
          lastName: msg.author.lastName,
          phone: msg.author.phone,
        },
        media_urls: msg.images,
        message_date: msg.date,
      })
      .select()
      .single();

    if (rawError) {
      console.error('❌ Ошибка сохранения raw_message:', rawError);
      continue;
    }

    console.log('✅ Сохранено в raw_messages');

    // Категоризируем через AI
    try {
      console.log('🤖 Обработка через AI...');
      const aiResult = await categorizeMessage(msg.text);

      // Создаем listing (используем актуальную схему базы данных)
      const location = aiResult.location?.city
        ? `${aiResult.location.city}${aiResult.location.district ? ', ' + aiResult.location.district : ''}`
        : null;

      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .insert({
          raw_message_id: rawMessage.id,
          category: aiResult.category,
          title: aiResult.title,
          description: aiResult.description,
          price: aiResult.price?.amount,
          currency: aiResult.price?.currency,
          location: location,
          contact_info: {
            phone: aiResult.contact?.phone,
            telegram: aiResult.contact?.telegram,
            other: aiResult.contact?.other,
          },
          images: msg.images || [],
          posted_date: msg.date,
          ai_confidence: aiResult.confidence,
        })
        .select()
        .single();

      if (listingError) {
        console.error('❌ Ошибка создания listing:', listingError);
        continue;
      }

      console.log(`✅ Создан listing: ${aiResult.category} (${Math.round(aiResult.confidence * 100)}% уверенность)`);
      console.log(`   Заголовок: ${aiResult.title}`);
      processed++;

    } catch (aiError) {
      console.error('❌ Ошибка AI:', aiError.message);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n✅ Обработка завершена!`);
  console.log(`📊 Обработано: ${processed}`);
  console.log(`⏭️  Пропущено: ${skipped}`);
}

processMessages().catch(console.error);
