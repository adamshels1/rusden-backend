# Rusden Backend - Архитектура

## 📐 Общая структура

```
Telegram → Parser → Database → AI → API → Frontend
    ↓         ↓         ↓        ↓      ↓
  MTProto   Sharp   Supabase  Groq  Express
```

## 🔄 Полный флоу обработки

### 1. Парсинг Telegram (telegram-parser/)

**Технологии:**
- MTProto API - прямое подключение к Telegram
- Sharp - сжатие изображений

**Процесс:**
```javascript
1. Подключение к каналу (@alanyadom, @AntalyaLife)
2. Получение последних 50 сообщений
3. Скачивание фотографий
4. Автоматическое сжатие (>100KB):
   - Resize: max 1200x1200px
   - Quality: 80%
   - Format: Progressive JPEG
5. Сохранение в images/
6. Экспорт в parsed_messages.json
```

**Оптимизация картинок:**
- Маленькие файлы (<100KB) - без сжатия
- Большие файлы (>100KB) - сжимаются на 40-60%
- Результат: экономия ~250MB/месяц

### 2. Обработка данных (rusden-backend/)

**База данных: Supabase (PostgreSQL)**

**Таблицы:**
```sql
channels        -- Список Telegram каналов
├── id (uuid)
├── username (text)
└── title (text)

raw_messages    -- Необработанные сообщения
├── id (uuid)
├── channel_id (uuid → channels)
├── telegram_message_id (bigint)
├── raw_text (text)
├── author_info (jsonb)
├── media_urls (text[])
└── message_date (timestamptz)

listings        -- Обработанные объявления
├── id (uuid)
├── raw_message_id (uuid → raw_messages)
├── category (text) -- realty/job/service/goods/event
├── title (text)
├── description (text)
├── price (numeric)
├── currency (text)
├── location (text)
├── contact_info (jsonb)
├── images (text[]) -- URL из Supabase Storage
├── ai_confidence (numeric)
└── is_active (boolean)
```

**Storage: Supabase Storage**
```
Bucket: listings-images
├── Public access: true
├── Max file size: 50MB
└── URLs: https://[project].supabase.co/storage/v1/object/public/listings-images/[filename]
```

### 3. AI Категоризация (Groq AI)

**Модель:** llama-3.3-70b-versatile

**Процесс:**
```javascript
1. Получение raw_text из сообщения
2. Отправка в Groq AI с промптом
3. Получение структурированного JSON:
   {
     category: "realty" | "job" | "service" | "goods" | "event",
     title: string,
     price: { amount, currency, period },
     location: { city, district },
     contact: { phone, telegram },
     confidence: 0.0-1.0
   }
4. Сохранение в listings
```

**Стоимость:** $0/месяц
- Бесплатный лимит: 14,400 запросов/день
- Текущее использование: ~120 запросов/день

### 4. API (Express + TypeScript)

**Эндпоинты:**

```
GET  /api/listings              -- Список объявлений
GET  /api/listings/:id          -- Одно объявление
POST /api/cron/parse            -- Запуск парсинга (cron)
GET  /api-docs                  -- Swagger документация
GET  /health                    -- Healthcheck
```

**Фильтры:**
- category: realty/job/service/goods/event
- city: поиск по подстроке
- minPrice, maxPrice
- limit, offset (пагинация)

**CORS:** Публичный доступ (origin: '*')

### 5. Автоматизация

**Vercel Cron Jobs:**
```json
{
  "path": "/api/cron/parse",
  "schedule": "0 */6 * * *"  // Каждые 6 часов
}
```

**Расписание:**
- 00:00 UTC - парсинг
- 06:00 UTC - парсинг
- 12:00 UTC - парсинг
- 18:00 UTC - парсинг

## 💰 Стоимость инфраструктуры

| Сервис | План | Использование/месяц | Стоимость |
|--------|------|---------------------|-----------|
| **Supabase Database** | Free | ~500 объявлений | $0 |
| **Supabase Storage** | Free | ~250MB картинок | $0.01-0.02 |
| **Groq AI** | Free | ~3,600 запросов | $0 |
| **Vercel Hosting** | Hobby | Serverless | $0 |
| **ИТОГО** | | | **~$0.02/месяц** |

## 📊 Производительность

**Парсинг:**
- 1 канал = ~20 новых сообщений
- 2 канала × 4 раза/день = 160 сообщений/день
- ~4,800 сообщений/месяц

**Картинки:**
- Среднее: 1.5 картинки на сообщение
- ~7,200 картинок/месяц
- После сжатия: ~250MB/месяц

**API:**
- Среднее время ответа: <100ms
- База данных: Supabase (global CDN)
- Картинки: Supabase Storage CDN

## 🔒 Безопасность

**Database:**
- Row Level Security (RLS) отключен для публичного доступа
- Только SELECT разрешен для anon роли

**Storage:**
- Публичный доступ на чтение
- Загрузка только через anon ключ (контролируется)

**API:**
- Публичный GET доступ
- POST /api/cron/parse защищен CRON_SECRET

**Секреты:**
```
SUPABASE_URL
SUPABASE_ANON_KEY
GROQ_API_KEY
CRON_SECRET
TELEGRAM_API_ID
TELEGRAM_API_HASH
```

## 🚀 Деплой

**Локально:**
```bash
npm run dev                 # Запуск сервера
npm run parse:full          # Ручной парсинг
```

**Production (Vercel):**
```bash
vercel --prod
```

**Автоматический деплой:**
- Push в main → автодеплой на Vercel
- Cron jobs активируются автоматически

## 📈 Масштабирование

**Когда вырастешь из Free tier:**

1. **База данных (>500MB или >2GB трафика):**
   - Supabase Pro: $25/месяц
   - Или свой VPS + PostgreSQL: $20-40/месяц

2. **Storage (>1GB):**
   - Supabase: $0.021/GB
   - Или Cloudflare R2: $0.015/GB (первые 10GB бесплатно)

3. **AI (>14,400 запросов/день):**
   - Groq Paid plan: от $0.27/M tokens
   - Или OpenAI GPT-4o-mini: $0.150/M tokens

4. **Hosting:**
   - Vercel Pro: $20/месяц (нужен если >100GB трафика)
   - Или свой сервер

## 🛠️ Техстек

**Backend:**
- Node.js 21+
- TypeScript 5.9
- Express 4.21
- Zod для валидации

**Database:**
- PostgreSQL (Supabase)
- Supabase Storage (S3-compatible)

**AI:**
- Groq AI (llama-3.3-70b-versatile)

**DevOps:**
- Vercel (serverless)
- Vercel Cron Jobs
- GitHub Actions (опционально)

**Парсинг:**
- MTProto (@mtproto/core)
- Sharp (image compression)

## 📝 Логирование

**Vercel Logs:**
- Автоматически собираются
- Доступны в Dashboard

**Supabase Logs:**
- API logs
- Database logs
- Storage logs

## 🔧 Мониторинг

**Ручной:**
- Swagger UI: http://localhost:3000/api-docs
- Health check: http://localhost:3000/health

**Production:**
- Vercel Analytics (автоматически)
- Supabase Dashboard
