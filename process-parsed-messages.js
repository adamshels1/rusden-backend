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
const BUCKET_NAME = 'listings-images';
const IMAGES_DIR = path.resolve(__dirname, 'scripts/images');

const SYSTEM_PROMPT = `Ты — AI-агент для классификации объявлений из русскоязычных Telegram-каналов в Турции.

Твоя задача: классифицировать сообщение в одну из категорий и извлечь структурированные данные.

**ВАЖНО для location:**
- Города ВСЕГДА пиши ТОЛЬКО из списка: Аланья, Анталья, Стамбул, Бодрум, Измир, Анкара, Мармарис, Фетхие, Кемер
- Все варианты названий приводи к единому: "Alanya"/"Алания" → "Аланья", "Antalya" → "Анталья"
- Если видишь "центр", "центр Алании", "center" - определи конкретный район или оставь district пустым
- Районы тоже пиши по-русски: Махмутлар, Каргыджак, Тосмур, Оба и т.д.

**Категории:**
- realty: недвижимость - квартиры, дома, виллы, студии, комнаты (с подкатегориями: Продажа или Аренда). ВАЖНО: если упоминаются 1+1, 2+1, студия, квартира, комната, дом, вилла - это ВСЕГДА realty!
- job: вакансии - когда работодатель/компания ИЩЕТ сотрудника (требуется повар, нужен водитель). НЕ используй для специалистов, предлагающих услуги!
- service: услуги - когда специалист ПРЕДЛАГАЕТ свои услуги (даю уроки английского, делаю ремонт, психолог, юрист, преподаватель, репетитор)
- goods: продажа товаров (мебель, техника, одежда и т.д.)
- auto: автомобили, машины, авто, мото, скутеры (с подкатегориями: Продажа или Аренда). ВАЖНО: только транспортные средства!

**Отвечай ТОЛЬКО в JSON формате:**
{
  "category": "realty" | "job" | "service" | "goods" | "auto" | "other",
  "subcategory": "для realty и auto: Продажа или Аренда. Для остальных категорий можно описать точнее (например: мебель, техника, вакансия официанта)",
  "title": "краткое описание (до 100 символов)",
  "description": "полное описание",
  "price": {
    "amount": число или null,
    "currency": "EUR" | "USD" | "TRY" | null,
    "period": "month" | "day" | "once" | null
  },
  "location": {
    "city": "ТОЛЬКО одно из: Аланья, Анталья, Стамбул, Бодрум, Измир, Анкара, Мармарис, Фетхие, Кемер или null",
    "district": "район/микрорайон по-русски (Махмутлар, Оба, Тосмур, Каргыджак и т.д.) или null. НЕ используй 'центр'"
  },
  "contact": {
    "phone": "номер телефона (только цифры, +, -, скобки) или null. Если в тексте нет телефона - пиши null",
    "telegram": "юзернейм телеграм БЕЗ @ (например: ivan123) или null. ВАЖНО: если в тексте нет юзернейма - пиши null. НЕ пиши 'автор объявления', 'см. профиль' и подобное",
    "other": "другие контакты (email, сайт) или null"
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

async function categorizeMessage(text, author, defaultCity) {
  let userPrompt = `Классифицируй это объявление:\n\n${text}`;

  // Добавляем контакты автора если есть
  if (author) {
    userPrompt += `\n\nКонтактная информация автора:\n`;
    if (author.phone) userPrompt += `Телефон: ${author.phone}\n`;
    if (author.username) userPrompt += `Telegram: @${author.username}\n`;
  }

  // Добавляем город по умолчанию
  if (defaultCity) {
    userPrompt += `\n\nПРИМЕЧАНИЕ: Если в тексте не указан конкретный город, используй "${defaultCity}" как значение для location.city.`;
  }

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(completion.choices[0].message.content);
}

async function uploadImageToSupabase(filename) {
  const filePath = path.join(IMAGES_DIR, filename);

  // Проверяем существование файла
  if (!fs.existsSync(filePath)) {
    console.log(`   ⚠️  Файл не найден: ${filename}`);
    return null;
  }

  // Проверяем, не загружен ли уже
  const { data: existingFile } = await supabase.storage
    .from(BUCKET_NAME)
    .list('', { search: filename });

  if (existingFile && existingFile.length > 0) {
    // Уже загружен, возвращаем URL
    const { data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename);
    return data.publicUrl;
  }

  // Загружаем файл (уже сжатый при парсинге)
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fileBuffer.length;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filename, fileBuffer, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.log(`   ❌ Ошибка загрузки ${filename}:`, error.message);
    return null;
  }

  // Получаем публичный URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filename);

  console.log(`   📤 ${filename} (${Math.round(fileSize/1024)}KB)`);
  return urlData.publicUrl;
}

async function processMessages() {
  console.log('🚀 Обработка спарсенных сообщений\n');

  // Читаем спарсенные сообщения
  const parsedPath = path.resolve(__dirname, 'scripts/parsed_messages.json');
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

  // Функция задержки
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
        author_info: msg.author ? {
          id: msg.author.id,
          username: msg.author.username,
          firstName: msg.author.firstName,
          lastName: msg.author.lastName,
          phone: msg.author.phone,
        } : null,
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
      const aiResult = await categorizeMessage(msg.text, msg.author, msg.default_city);

      // Задержка 1 секунда между AI-запросами (ускоряем обработку)
      await delay(1000);

      // Валидация контактов
      const hasValidContact =
        (aiResult.contact?.phone && aiResult.contact.phone.trim() && !/автор|профиль|см\.|смотри/i.test(aiResult.contact.phone)) ||
        (aiResult.contact?.telegram && aiResult.contact.telegram.trim() && !/автор|профиль|см\.|смотри|объявления/i.test(aiResult.contact.telegram)) ||
        (aiResult.contact?.other && aiResult.contact.other.trim());

      if (!hasValidContact) {
        console.log('⏭️  Пропускаем: нет валидных контактов');
        skipped++;
        continue;
      }

      // Фильтрация нежелательного контента
      const spamKeywords = /бар|клуб|стрип|ночной|массаж|эскорт|интим|девушк[иа]\s+для|хостес|танцовщиц/i;
      const textToCheck = `${aiResult.title} ${aiResult.description} ${aiResult.subcategory || ''}`;

      if (spamKeywords.test(textToCheck)) {
        console.log('⏭️  Пропускаем: нежелательный контент');
        skipped++;
        continue;
      }

      // Очищаем telegram от @ если AI его добавил
      if (aiResult.contact?.telegram) {
        aiResult.contact.telegram = aiResult.contact.telegram.replace(/^@/, '');
      }

      // Загружаем картинки в Supabase Storage
      const imageUrls = [];
      if (msg.images && msg.images.length > 0) {
        console.log(`📸 Загрузка ${msg.images.length} картинок...`);
        for (const imageName of msg.images) {
          const imageUrl = await uploadImageToSupabase(imageName);
          if (imageUrl) {
            imageUrls.push(imageUrl);
          }
        }
      }

      // Создаем listing (используем актуальную схему базы данных)
      const location = aiResult.location?.city
        ? `${aiResult.location.city}${aiResult.location.district ? ', ' + aiResult.location.district : ''}`
        : null;

      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .insert({
          raw_message_id: rawMessage.id,
          category: aiResult.category,
          subcategory: aiResult.subcategory,
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
          images: imageUrls, // Теперь сохраняем полные URL из Supabase Storage
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

  // Сохраняем количество обработанных объявлений для Telegram логгера
  try {
    const fs = require('fs');
    fs.writeFileSync('scripts/listings-count.txt', processed.toString());
    console.log(`📝 Сохранено количество объявлений: ${processed}`);
  } catch (error) {
    console.log('Не удалось сохранить количество объявлений:', error.message);
  }
}

processMessages().catch(console.error);
