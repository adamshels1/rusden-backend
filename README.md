# Rusden Backend API

Публичный API для агрегатора объявлений из Telegram каналов для русскоязычных экспатов в Турции.

## 🚀 Быстрый старт

### Локальная разработка

```bash
# Установить зависимости
npm install

# Настроить .env
cp .env.example .env
# Заполнить переменные окружения

# Запустить сервер
npm run dev
```

Сервер запустится на http://localhost:3000

## 📚 API Документация

После запуска сервера, Swagger документация доступна по адресу:

**http://localhost:3000/api-docs**

## 🔗 API Endpoints

### Listings (Объявления)

#### GET /api/listings
Получить список объявлений с фильтрацией

**Query параметры:**
- `category` - Категория (`realty`, `job`, `service`, `goods`, `event`)
- `city` - Город (поиск по подстроке)
- `minPrice` - Минимальная цена
- `maxPrice` - Максимальная цена
- `limit` - Количество результатов (по умолчанию 20, макс 100)
- `offset` - Смещение для пагинации

**Примеры:**
```bash
# Все объявления
curl http://localhost:3000/api/listings

# Только недвижимость
curl http://localhost:3000/api/listings?category=realty

# Недвижимость в Алании
curl "http://localhost:3000/api/listings?category=realty&city=Alanya"

# С ценовым диапазоном
curl "http://localhost:3000/api/listings?minPrice=10000&maxPrice=50000"
```

#### GET /api/listings/:id
Получить объявление по ID

**Пример:**
```bash
curl http://localhost:3000/api/listings/dd6dfb75-848c-42fe-9654-757f9ac555cb
```

### Health

#### GET /health
Проверка состояния сервера

## 🗂️ Категории объявлений

- **realty** - Недвижимость (аренда, продажа)
- **job** - Работа и вакансии
- **service** - Услуги (юристы, врачи, мастера)
- **goods** - Товары (мебель, техника, авто)
- **event** - Мероприятия и встречи

## 🌍 Поддерживаемые города

Istanbul, Antalya, Alanya, Bodrum, Marmaris, Izmir, Ankara, Side, Kemer, Belek

## 🧠 AI Категоризация

Все объявления автоматически категоризируются с помощью **Groq AI (llama-3.3-70b-versatile)** - бесплатно!

Каждое объявление имеет поле `ai_confidence` (0-1) - уверенность AI в правильности категоризации.

## 🛠️ Технологии

- **Backend**: Node.js + Express + TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI**: Groq llama-3.3-70b-versatile (бесплатно!)
- **Parser**: MTProto (Telegram)
- **Hosting**: Vercel
- **API Docs**: Swagger/OpenAPI 3.0

## 📦 Структура проекта

```
rusden-backend/
├── src/
│   ├── config/       # Конфигурация (Supabase, Groq, Swagger)
│   ├── services/     # Бизнес-логика (AI, parser, listings)
│   ├── routes/       # API endpoints
│   ├── jobs/         # Cron jobs для парсинга
│   ├── types/        # TypeScript типы
│   ├── app.ts        # Express приложение
│   └── server.ts     # Точка входа
├── .env              # Переменные окружения
├── vercel.json       # Конфигурация Vercel
└── package.json      # Зависимости
```

## 🔐 Переменные окружения

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key

# Groq AI (бесплатно!)
GROQ_API_KEY=gsk_your_groq_api_key

# Server
PORT=3000
NODE_ENV=development

# Cron Security
CRON_SECRET=your_random_secret_key
```

## 🚀 Деплой на Vercel

```bash
# Установить Vercel CLI
npm i -g vercel

# Деплой
vercel

# Установить переменные окружения
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add GROQ_API_KEY
vercel env add CRON_SECRET
```

## ⏱️ Cron Jobs

Автоматический парсинг каналов настроен в `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/parse",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

Запускается каждые 6 часов и обрабатывает новые сообщения из Telegram каналов.

## 📊 База данных (Supabase)

### Таблицы

**channels** - Telegram каналы
- `id` (UUID) - Уникальный идентификатор
- `telegram_id` (TEXT) - ID канала в Telegram
- `username` (TEXT) - Username канала
- `title` (TEXT) - Название канала
- `is_active` (BOOLEAN) - Активен ли канал

**raw_messages** - Сырые сообщения из Telegram
- `id` (UUID) - Уникальный идентификатор
- `channel_id` (UUID) - Ссылка на канал
- `telegram_message_id` (BIGINT) - ID сообщения в Telegram
- `raw_text` (TEXT) - Текст сообщения
- `author_info` (JSONB) - Информация об авторе
- `message_date` (TIMESTAMPTZ) - Дата сообщения

**listings** - Обработанные объявления
- `id` (UUID) - Уникальный идентификатор
- `raw_message_id` (UUID) - Ссылка на исходное сообщение
- `category` (TEXT) - Категория
- `title` (TEXT) - Заголовок
- `description` (TEXT) - Описание
- `price` (NUMERIC) - Цена
- `currency` (TEXT) - Валюта (TRY, USD, EUR)
- `location` (TEXT) - Локация
- `contact_info` (JSONB) - Контакты
- `ai_confidence` (NUMERIC) - Уверенность AI (0-1)

## 📝 Скрипты

```bash
# Разработка
npm run dev

# Сборка
npm run build

# Запуск production
npm start

# Единоразовый парсинг
npm run parse:once
```

## 📝 Лицензия

MIT

## 🤝 Вклад

Contributions welcome! Открывайте Issues и Pull Requests.
