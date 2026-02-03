import { Bot, InlineKeyboard } from 'grammy';
import { handleInlineQuery } from './handlers/inline.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

export const bot = new Bot(BOT_TOKEN);

// Mini App URL
const MINI_APP_URL = process.env.VITE_MINI_APP_URL || 'https://t.me/YourBotUsername/app';

/**
 * /start command - opens Mini App
 */
bot.command('start', async (ctx) => {
  const startParam = ctx.match; // e.g., "quest_abc123_ref_456"
  
  const keyboard = new InlineKeyboard()
    .webApp('🧠 Open Mind Test', `${MINI_APP_URL}${startParam ? `?startapp=${startParam}` : ''}`);
  
  await ctx.reply(
    '👋 Welcome to Mind Test!\n\n' +
    '🎯 Take quizzes, challenge friends, and climb the leaderboard.\n\n' +
    'Tap the button below to start:',
    { reply_markup: keyboard }
  );
});

/**
 * /help command
 */
bot.command('help', async (ctx) => {
  await ctx.reply(
    '🧠 *Mind Test Help*\n\n' +
    '*Commands:*\n' +
    '/start - Open the Mini App\n' +
    '/help - Show this message\n\n' +
    '*Inline mode:*\n' +
    'Type @' + (process.env.TELEGRAM_BOT_USERNAME || 'YourBot') + ' in any chat to share quizzes!\n\n' +
    '*Options:*\n' +
    '• Daily Quiz - Today\'s featured quiz\n' +
    '• Random Quiz - A surprise quiz\n' +
    '• My Profile - Share your stats',
    { parse_mode: 'Markdown' }
  );
});

/**
 * Inline queries - the main feature!
 */
bot.on('inline_query', handleInlineQuery);

/**
 * Handle callback queries from inline buttons
 */
bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  
  if (data.startsWith('quiz_')) {
    const quizId = data.replace('quiz_', '');
    // Could show quiz preview or stats
    await ctx.answerCallbackQuery({
      text: 'Opening quiz...',
      show_alert: false,
    });
  }
});

/**
 * Error handler
 */
bot.catch((err) => {
  console.error('Bot error:', err);
});

/**
 * Start the bot
 */
export async function startBot() {
  console.log('🤖 Starting Telegram bot...');
  
  // Use long polling in development
  if (process.env.NODE_ENV !== 'production') {
    bot.start({
      onStart: (info) => {
        console.log(`✅ Bot @${info.username} started (polling)`);
      },
    });
  } else {
    // In production, use webhooks (set up separately)
    console.log('ℹ️ Bot in production mode - set up webhook separately');
  }
}
