require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const path = require('path');
const localtunnel = require('localtunnel');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const app = express();
const PORT = process.env.PORT || 3000;

// Раздаем статику (наш будущий Mini App)
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Настройка бота
bot.start((ctx) => {
    ctx.reply('Привет, Ильнур! Я Кимико. Добро пожаловать в SmartLibido.', {
        reply_markup: {
            inline_keyboard: [
                [{ text: "Открыть SmartLibido", web_app: { url: process.env.WEBAPP_URL } }]
            ]
        }
    });
});

// Запуск всего этого добра
async function bootstrap() {
    app.listen(PORT, async () => {
        console.log(`Server is running on port ${PORT}`);
        
        // Поднимаем туннель, чтобы Ильнур видел это с вахты
        const tunnel = await localtunnel({ port: PORT });
        console.log(`\n🔥🔥🔥 Туннель запущен: ${tunnel.url}`);
        console.log(`Используй этот URL в .env как WEBAPP_URL и в BotFather\n`);
        
        process.env.WEBAPP_URL = tunnel.url;

        bot.launch();
        console.log('Бот запущен!');
    });
}

bootstrap();

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
