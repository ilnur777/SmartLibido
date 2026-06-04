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

// Инициализация базы данных SQLite
async function initDb() {
    db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });
    
    // Создаем таблицу связей партнерства
    await db.exec(`
        CREATE TABLE IF NOT EXISTS partnerships (
            owner_id TEXT PRIMARY KEY,
            partner_id TEXT,
            sh_st TEXT,
            sh_en TEXT,
            sh_sl TEXT,
            sh_nd TEXT,
            last_checked TEXT
        )
    `);
    console.log('База данных SQLite запущена и настроена!');
}

// Поток START в Telegram
bot.start(async (ctx) => {
    const text = ctx.message.text || '';
    const userId = ctx.from.id.toString();
    
    // Если партнер перешел по глубокой ссылке партнера: /start link_ownerid
    if (text.startsWith('/start link_')) {
        const ownerId = text.replace('/start link_', '').trim();
        
        if (ownerId === userId) {
            return ctx.reply('Вы не можете стать партнером самому себе! Перешлите созданную инвайт-ссылку вашему мужу.');
        }

        // Обновляем или вставляем связь в SQLite
        await db.run(
            `INSERT INTO partnerships (owner_id, partner_id) 
             VALUES (?, ?) 
             ON CONFLICT(owner_id) DO UPDATE SET partner_id = ?`,
            [ownerId, userId, userId]
        );

        ctx.reply('🔔 Канал заботы успешно подключен!\n\nТеперь вы будете получать автоматические пуш-уведомления о состоянии вашей партнерши прямо в этот чат, как только она сделает чек-ин! ✨');
        
        // Оповещаем хозяйку, что муж подключился
        try {
            await bot.telegram.sendMessage(ownerId, '💞 Ваш муж успешно подключился к вашему каналу заботы! Теперь он будет получать пуши.');
        } catch (e) {
            console.log('Не удалось отправить уведомление хозяйке, возможно бот не запущен у нее напрямую.');
        }
        return;
    }

    // Обычный запуск бота для хозяйки
    ctx.reply('Привет! Я SmartLibido Bot. 🌸 Нажми на кнопку ниже, чтобы войти в твой приватный цикл и настроить шеринг.', {
        reply_markup: {
            inline_keyboard: [
                [{ text: "Открыть SmartLibido 📅", web_app: { url: `https://ilnur777.github.io/SmartLibido/index.html` } }]
            ]
        }
    });
});

// Эндпоинт отправки статуса и нативного пуша от фронтенда хозяйки
app.post('/api/update-status', async (req, res) => {
    const { owner_id, libido, energy, sleep, needs, sh_st, sh_en, sh_sl, sh_nd, date, len } = req.body;
    
    if (!owner_id) {
        return res.status(400).json({ error: 'owner_id не указан' });
    }

    // Сохраняем/обновляем статус настроек шеринга в БД
    await db.run(
        `INSERT INTO partnerships (owner_id, sh_st, sh_en, sh_sl, sh_nd, last_checked) 
         VALUES (?, ?, ?, ?, ?, ?) 
         ON CONFLICT(owner_id) DO UPDATE SET sh_st=?, sh_en=?, sh_sl=?, sh_nd=?, last_checked=?`,
        [owner_id, sh_st, sh_en, sh_sl, sh_nd, JSON.stringify({libido, energy, sleep, needs}), sh_st, sh_en, sh_sl, sh_nd, JSON.stringify({libido, energy, sleep, needs})]
    );

    // Пытаемся вытащить партнера для этой хозяйки
    const row = await db.get('SELECT partner_id FROM partnerships WHERE owner_id = ?', [owner_id]);
    
    if (row && row.partner_id) {
        // Рассчитываем фазу для упреждающего текста пуша
        const start = new Date(date);
        const now = new Date();
        const diffDays = Math.ceil(Math.abs(now - start) / (1000 * 60 * 60 * 24));
        const cycleDay = (diffDays % parseInt(len)) || 1;
        
        let level = 'warm';
        let emoji = '🌤';
        let title = 'День баланса';
        let message = 'У неё стабильный, комфортный уровень сил. Всё супер.';

        if (cycleDay <= 5) {
            level = 'low'; emoji = '🌙'; title = 'День максимальной бережности';
            message = 'Организм требует заботы. Постарайтесь приготовить ужин, убрать посуду или просто обнять.';
        } else if (cycleDay >= 12 && cycleDay <= 16) {
            level = 'high'; emoji = '🔥'; title = 'Яркий тонус!';
            message = 'У неё пик сил и тепла! Прекрасный день для совместного времени, ярких разговоров и близости.';
        } else if (cycleDay > 16) {
            level = 'gentle'; emoji = '🧘'; title = 'Период нежного восстановления';
            message = 'Тело замедляется. Окружите мягким вниманием и дайте отдохнуть.';
        }

        // Собираем текст пуша на базе свитчей
        let pushText = `🌸 <b>SmartLibido: Обновление состояния</b>\n\n`;
        if (sh_st === 'true' || sh_st === true) {
            pushText += `${emoji} <b>Статус:</b> ${title}\n💡 <i>Совет: ${message}</i>\n\n`;
        } else {
            pushText += `🌤 <b>Статус:</b> Обычный комфортный день\n\n`;
        }

        let metrics = [];
        if (sh_en === 'true' || sh_en === true) {
            const elab = energy === 'high' ? 'Высокий' : (energy === 'low' ? 'Снижен' : 'В норме');
            metrics.push(`🔋 <b>Ресурс энергии:</b> ${elab}`);
        }
        if (sh_sl === 'true' || sh_sl === true) {
            const slab = sleep === 'good' ? 'Высыпалась' : (sleep === 'bad' ? 'Устала/Плохой сон' : 'Обычный');
            metrics.push(`😴 <b>Качество сна:</b> ${slab}`);
        }
        if (metrics.length > 0) {
            pushText += `📊 <b>Показатели:</b>\n${metrics.join('\n')}\n\n`;
        }

        if ((sh_nd === 'true' || sh_nd === true) && needs && needs.length > 0) {
            pushText += `💝 <b>Её потребность на сегодня:</b>\n👉 <span style="background:#EEE8FF;">${needs.join(', ')}</span>\n`;
        }

        try {
            await bot.telegram.sendMessage(row.partner_id, pushText, { parse_mode: 'HTML' });
            console.log(`Пуш-уведомление успешно отправлено партнеру ${row.partner_id}`);
        } catch (err) {
            console.error('Ошибка отправки сообщения партнеру:', err);
        }
    }

    res.json({ success: true, partner_connected: !!(row && row.partner_id) });
});

// Запуск сервера
async function bootstrap() {
    await initDb();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`HTTP Сервер API запущен на порту ${PORT}`);
        bot.launch();
        console.log('Бот запущен на прием сообщений!');
    });
}

bootstrap();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
