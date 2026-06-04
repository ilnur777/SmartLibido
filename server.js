require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const cors = require('cors');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let db;

async function initDb() {
    db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });
    await db.exec(`
        CREATE TABLE IF NOT EXISTS partnerships (
            owner_id TEXT PRIMARY KEY,
            partner_id TEXT
        )
    `);
    console.log('SQLite Ready.');
}

bot.start(async (ctx) => {
    const text = ctx.message.text || '';
    const userId = ctx.from.id.toString();

    // ПАРТНЕР КЛИКНУЛ ПО ССЫЛКЕ
    if (text.startsWith('/start link_')) {
        const ownerId = text.replace('/start link_', '').trim();
        
        await db.run(
            `INSERT INTO partnerships (owner_id, partner_id) VALUES (?, ?) 
             ON CONFLICT(owner_id) DO UPDATE SET partner_id = ?`,
            [ownerId, userId, userId]
        );

        return ctx.reply('🌸 Готово! Вы подключены к каналу заботы SmartLibido.\n\nТеперь, когда ваша партнерша будет делать чек-ин, я буду присылать вам сюда «Карточку дня» с подсказками, как лучше её поддержать. Никаких настроек — просто будьте рядом! 💞');
    }

    // ХОЗЯЙКА ЗАШЛА В БОТА
    ctx.reply('Привет! Я SmartLibido Bot. 🌸 Твой приватный трекер либидо и энергии.', {
        reply_markup: {
            inline_keyboard: [
                [{ text: "Открыть мой трекер 📅", web_app: { url: `https://ilnur777.github.io/SmartLibido/index.html` } }]
            ]
        }
    });
});

// API ДЛЯ ОТПРАВКИ ТЕКСТОВОГО ПУША ПАРТНЕРУ
app.post('/api/update-status', async (req, res) => {
    const { owner_id, libido, energy, date, len } = req.body;
    
    const row = await db.get('SELECT partner_id FROM partnerships WHERE owner_id = ?', [owner_id]);
    
    if (row && row.partner_id) {
        // РАСЧЕТ ФАЗЫ
        const start = new Date(date);
        const day = (Math.ceil(Math.abs(new Date() - start) / (1000*60*60*24)) % parseInt(len)) || 1;
        
        let emoji = '🌤'; let title = 'День баланса'; let msg = 'Хорошее время для спокойного общения и прогулки.';
        if (day <= 5) { emoji = '🌙'; title = 'День бережности'; msg = 'Ресурс снижен. Лучшая помощь — ужин, плед и меньше лишних вопросов.'; }
        if (day >= 12 && day <= 16) { emoji = '🔥'; title = 'Яркий тонус!'; msg = 'У неё пик сил и нежности. Прекрасный вечер для свидания и близости.'; }

        const enLabel = energy === 'high' ? 'Много сил 💪' : (energy === 'low' ? 'Устала 🪫' : 'В норме ⚡');

        const cardText = `🌸 <b>SmartLibido: Состояние сегодня</b>\n\n` +
                         `${emoji} <b>${title}</b>\n` +
                         `🔋 <b>Энергия:</b> ${enLabel}\n\n` +
                         `💡 <b>Совет:</b> ${msg}`;

        try {
            await bot.telegram.sendMessage(row.partner_id, cardText, { parse_mode: 'HTML' });
        } catch (e) {
            console.log('Push failed:', e.message);
        }
    }

    res.json({ success: true, partner_found: !!row });
});

async function main() {
    await initDb();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`API на порту ${PORT}`);
        bot.launch();
    });
}
main();
