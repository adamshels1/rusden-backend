#!/bin/bash

echo "🚣‍♂️ Деплой на Railway..."

# Проверяем установлен ли Railway CLI
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI не установлен"
    echo "📦 Устанавливаем..."
    npm install -g @railway/cli
fi

# Авторизация
echo "🔐 Авторизация в Railway..."
railway login

# Деплой
echo "🚀 Деплой проекта..."
railway up

echo "✅ Деплой завершен!"
echo "🌐 Открыть приложение: railway open"
echo "📊 Логи: railway logs"