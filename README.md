# UBT Telegram Bot (Render-ready)

## 🚀 Деплой на Render:

1. Зарегистрируйся на https://render.com (если нет аккаунта)
2. Нажми "New +" → Web Service
3. Подключи GitHub и выбери репозиторий с этим проектом
4. В настройках:
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. После деплоя — скопируй ссылку, например: `https://uniccal-bot.onrender.com/`

## 🤖 Установка Webhook Telegram

Вставь свою ссылку и токен бота:

```
curl -F "url=https://uniccal-bot.onrender.com/" https://api.telegram.org/bot<ТВОЙ_ТОКЕН>/setWebhook
```
