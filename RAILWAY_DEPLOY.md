# 🚣‍♂️ Деплой на Railway

## 📋 Подготовка

### 1. Установка Railway CLI
```bash
npm install -g @railway/cli
```

### 2. Авторизация
```bash
railway login
```

### 3. Инициализация проекта
```bash
# В папке rusden-backend
railway init
```

## ⚙️ Настройка переменных окружения

### Вариант 1: Через консоль
```bash
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set API_ID=your_telegram_api_id
railway variables set API_HASH=your_telegram_api_hash
railway variables set SUPABASE_URL=your_supabase_url
railway variables set SUPABASE_ANON_KEY=your_supabase_anon_key
railway variables set SUPABASE_SERVICE_KEY=your_supabase_service_key
railway variables set GROQ_API_KEY=your_groq_api_key
railway variables set CRON_SCHEDULE=*/30 * * * *
railway variables set RUN_ONCE=false
```

### Вариант 2: Через веб-интерфейс
1. Открой railway.app
2. Твой проект → Variables
3. Добавь все переменные из `.env.railway`

## 🚀 Деплой

### Вариант 1: Автоматический (рекомендуется)
```bash
# Подключить GitHub репозиторий
railway up

# Или через веб-интерфейс:
# 1. railway.app → New Project
# 2. Deploy from GitHub repo
# 3. Выбери rusden-backend
# 4. Настрой переменные окружения
```

### Вариант 2: Ручной
```bash
railway up
```

## 🔧 Что будет работать

### ✅ API Endpoint
- GET `/api/listings` - все объявления
- GET `/api/listings?category=realty` - фильтрация
- GET `/health` - проверка состояния
- GET `/api-docs` - Swagger документация

### ✅ Парсер Telegram
- Автоматический запуск по cron
- Сохранение в Supabase
- Обработка изображений через Sharp

### ✅ Мониторинг
- Автоматические рестарты при ошибках
- Health checks
- Логи в реальном времени

## 📊 Мониторинг

### Логи
```bash
railway logs
```

### Статус
```bash
railway status
```

### Открыть приложение
```bash
railway open
```

## 🛠️ Отладка

Если что-то не работает:

1. **Проверь переменные окружения**:
   ```bash
   railway variables list
   ```

2. **Посмотри логи**:
   ```bash
   railway logs --service
   ```

3. **Перезапусти сервис**:
   ```bash
   railway restart
   ```

4. **Проверь health**:
   ```bash
   curl https://your-app.railway.app/health
   ```

## 💰 Стоимость

- **Бесплатный тариф**: $5/мес кредитов
- **Хобби проект**: $5-20/мес
- **Продакшн**: $20+/мес

## 🎯 Преимущества Railway

✅ **Всё в одном месте**: API + парсер + cron
✅ **Автоматический деплой** из GitHub
✅ **Поддержка Node.js + Sharp + Telegram API**
✅ **Долгие процессы** (без ограничений Vercel)
✅ **Персистентное хранилище** для сессий
✅ **Мониторинг и логи**
✅ **Автоматические рестарты**

## 🔄 Обновления

После каждого изменения в коде:
```bash
git add .
git commit -m "update: feature description"
git push
```

Railway автоматически задеплоит изменения!