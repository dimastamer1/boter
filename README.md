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


 [Markup.button.callback('4 раза 💪', 'process_4')],
    [Markup.button.callback('5 раз 🔥', 'process_5')],
    [Markup.button.callback('6 раз 🚀', 'process_6')],
```



const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Webhook обработка с увеличенным лимитом времени
app.post('/', (req, res) => {
  // Устанавливаем таймаут 10 минут
  req.setTimeout(600000);
  res.setTimeout(600000);

  bot.handleUpdate(req.body)
    .then(() => res.sendStatus(200))
    .catch((err) => {
      console.error('❌ Ошибка при handleUpdate:', err);
      res.sendStatus(500);
    });
});

// Тест GET-запроса
app.get('/', (req, res) => {
  res.send('🤖 Бот жив и принимает Webhook');
});

app.listen(PORT, () => {
  console.log(`✅ Express-сервер работает на порту ${PORT}`);
});