import { Bot, InlineKeyboard } from 'grammy';
import { handleInlineQuery } from './handlers/inline.js';
import { registerModerationHandlers } from './handlers/moderation.js';
import { supabase } from '../lib/supabase.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

export const bot = new Bot(BOT_TOKEN);
let botStarted = false;

// Mini App URL
const MINI_APP_URL = process.env.VITE_MINI_APP_URL || 'https://t.me/YourBotUsername/app';

const AI_PRICE_STARS = (() => {
  const raw = process.env.AI_GENERATION_PRICE_STARS || '100';
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
})();

const isValidAiInvoicePayload = (payload: unknown): payload is string => {
  return typeof payload === 'string' && payload.startsWith('ai_gen_credit_v1:') && payload.length > 'ai_gen_credit_v1:'.length;
};

/**
 * Telegram Stars payments for AI generation credits.
 *
 * Flow:
 * 1) Mini App gets invoice link via server API and calls WebApp.openInvoice()
 * 2) Telegram sends pre_checkout_query -> we approve/deny
 * 3) Telegram sends successful_payment message -> we record + add credit (idempotent)
 */
bot.on('pre_checkout_query', async (ctx) => {
  try {
    const q = ctx.preCheckoutQuery;
    const ok =
      q.currency === 'XTR' &&
      q.total_amount === AI_PRICE_STARS &&
      isValidAiInvoicePayload(q.invoice_payload);

    if (!ok) {
      await ctx.answerPreCheckoutQuery(false, 'Invalid invoice payload');
      return;
    }

    await ctx.answerPreCheckoutQuery(true);
  } catch (err) {
    console.error('pre_checkout_query handler error:', err);
    try {
      await ctx.answerPreCheckoutQuery(false, 'Server error');
    } catch {
      // ignore
    }
  }
});

bot.on('message:successful_payment', async (ctx) => {
  const sp = ctx.message?.successful_payment;
  if (!sp) return;

  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const ok =
      sp.currency === 'XTR' &&
      sp.total_amount === AI_PRICE_STARS &&
      isValidAiInvoicePayload(sp.invoice_payload) &&
      typeof sp.telegram_payment_charge_id === 'string' &&
      sp.telegram_payment_charge_id.length > 0;

    if (!ok) {
      await ctx.reply('Платёж получен, но не удалось распознать покупку. Напишите в поддержку.');
      return;
    }

    const { data, error } = await (supabase as any).rpc('ai_apply_payment', {
      p_telegram_id: telegramId,
      p_invoice_payload: sp.invoice_payload,
      p_currency: sp.currency,
      p_total_amount: sp.total_amount,
      p_telegram_payment_charge_id: sp.telegram_payment_charge_id,
      p_provider_payment_charge_id: sp.provider_payment_charge_id || null,
      p_credit_delta: 1,
    });

    if (error) {
      console.error('ai_apply_payment rpc error:', error);
      await ctx.reply('✅ Платёж получен. Если кредит не появился, напишите в поддержку.');
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (row?.applied) {
      await ctx.reply(`✅ Оплата получена! Начислен 1 кредит для AI генерации.\n\nОсталось кредитов: ${row?.paid_credits ?? '—'}`);
    } else {
      // Idempotency: payment already processed.
      await ctx.reply(`✅ Оплата уже обработана ранее.\n\nОсталось кредитов: ${row?.paid_credits ?? '—'}`);
    }
  } catch (err) {
    console.error('successful_payment handler error:', err);
    try {
      await ctx.reply('✅ Платёж получен. Если кредит не появился, напишите в поддержку.');
    } catch {
      // ignore
    }
  }
});

/**
 * /start command - opens Mini App or shows share button
 */
bot.command('start', async (ctx) => {
  const startParam = (ctx.match || '').trim();
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'QuipoBot';

  // Share flow: Mini App opened t.me/QuipoBot?start=share_testId_title
  // We show a button that opens inline mode → user picks chat → rich card is sent
  if (startParam.startsWith('share_')) {
    const parts = startParam.split('_');
    if (parts.length >= 3) {
      const testId = parts[1];
      const titlePart = parts.slice(2).join('_');
      const inlineQuery = `test_result:${testId}:${encodeURIComponent(titlePart)}`;

      const keyboard = new InlineKeyboard()
        .switchInline('📤 Выбрать чат для отправки', inlineQuery);

      await ctx.reply(
        '👆 Нажми кнопку ниже — откроется выбор чата. В чат отправится карточка с результатом (картинка, название, описание и кнопка на тест).',
        { reply_markup: keyboard }
      );
      return;
    }
  }

  // Quiz share flow: start=qshare_quizId|score|total|title
  if (startParam.startsWith('qshare_')) {
    const rest = startParam.slice(7);
    const parts = rest.split('|');
    if (parts.length >= 4) {
      const [quizId, score, total, titlePart] = parts;
      const inlineQuery = `quiz_result:${quizId}:${score}:${total}:${encodeURIComponent(titlePart)}`;

      const keyboard = new InlineKeyboard()
        .switchInline('📤 Выбрать чат для отправки', inlineQuery);

      await ctx.reply(
        '👆 Нажми кнопку ниже — откроется выбор чата. В чат отправится карточка с результатом квиза.',
        { reply_markup: keyboard }
      );
      return;
    }
  }

  // Normal start - open Mini App
  const isRealUrl = MINI_APP_URL.startsWith('https://') && !MINI_APP_URL.includes('t.me');

  if (isRealUrl) {
    const keyboard = new InlineKeyboard()
      .webApp('🧠 Open Mind Test', `${MINI_APP_URL}${startParam ? `?startapp=${startParam}` : ''}`);

    await ctx.reply(
      '👋 Welcome to Mind Test!\n\n' +
      '🎯 Take quizzes, challenge friends, and climb the leaderboard.\n\n' +
      'Tap the button below to start:',
      { reply_markup: keyboard }
    );
  } else {
    const keyboard = new InlineKeyboard()
      .url('🧠 Open Mind Test', `https://t.me/${botUsername}/app${startParam ? `?startapp=${startParam}` : ''}`);

    await ctx.reply(
      '👋 Welcome to Mind Test!\n\n' +
      '🎯 Take quizzes, challenge friends, and climb the leaderboard.\n\n' +
      'Tap the button below to start:',
      { reply_markup: keyboard }
    );
  }
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
 * Register moderation handlers (approve/reject quiz callbacks)
 */
registerModerationHandlers(bot);

/**
 * Handle other callback queries from inline buttons
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
 * Handle bot being added/removed as admin in channels/groups
 * This creates/deactivates squads (Попкорн-команды)
 */
bot.on('my_chat_member', async (ctx) => {
  const update = ctx.myChatMember;
  const chat = update.chat;
  const newStatus = update.new_chat_member.status;
  const oldStatus = update.old_chat_member.status;
  const fromUser = update.from;

  // Only handle channels and groups/supergroups
  if (chat.type !== 'channel' && chat.type !== 'group' && chat.type !== 'supergroup') {
    return;
  }

  const chatId = chat.id;
  const chatTitle = chat.title || 'Unnamed';
  const chatUsername = 'username' in chat ? chat.username : null;
  const chatType = chat.type;

  // Bot became admin
  if ((newStatus === 'administrator' || newStatus === 'creator') &&
    oldStatus !== 'administrator' && oldStatus !== 'creator') {

    console.log(`🍿 Bot added as admin to ${chatType}: ${chatTitle} (${chatId})`);

    // Find who added the bot (their profile)
    const { data: adderProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('telegram_id', fromUser.id)
      .maybeSingle();

    // Generate invite link if possible
    let inviteLink: string | null = null;
    try {
      if (chatUsername) {
        inviteLink = `https://t.me/${chatUsername}`;
      } else {
        // Try to get/create invite link
        const link = await ctx.api.exportChatInviteLink(chatId);
        inviteLink = link;
      }
    } catch (e) {
      console.log('Could not get invite link:', e);
    }

    // Create or reactivate squad
    const { data: existingSquad } = await supabase
      .from('squads')
      .select('id')
      .eq('telegram_chat_id', chatId)
      .maybeSingle();

    // Helper to get and save avatar
    const saveSquadAvatar = async (squadChatId: number) => {
      try {
        const chatInfo = await ctx.api.getChat(squadChatId);
        if ('photo' in chatInfo && chatInfo.photo) {
          const file = await ctx.api.getFile(chatInfo.photo.big_file_id);
          const avatarUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

          await supabase
            .from('squads')
            .update({ avatar_url: avatarUrl })
            .eq('telegram_chat_id', squadChatId);

          console.log(`🍿 Squad avatar saved for: ${chatTitle}`);
        }
      } catch (e) {
        console.log('Could not get chat avatar:', e);
      }
    };

    if (existingSquad) {
      // Reactivate existing squad
      await supabase
        .from('squads')
        .update({
          title: chatTitle,
          username: chatUsername,
          type: chatType,
          invite_link: inviteLink,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSquad.id);

      console.log(`🍿 Squad reactivated: ${chatTitle}`);

      // Update avatar on reactivation too
      await saveSquadAvatar(chatId);

      // Notify user about reactivation
      try {
        await ctx.api.sendMessage(
          fromUser.id,
          `🍿 *Попкорн-команда "${chatTitle}" реактивирована!*\n\n` +
          'Команда снова активна в рейтинге.\n\n' +
          '_Открой Quipo → на главной нажми "Вступить" в блоке Попкорн-команды_',
          { parse_mode: 'Markdown' }
        );
      } catch (e) {
        console.log('Could not send reactivation message:', e);
      }
    } else {
      // Create new squad
      const { error } = await supabase
        .from('squads')
        .insert({
          telegram_chat_id: chatId,
          title: chatTitle,
          username: chatUsername,
          type: chatType,
          invite_link: inviteLink,
          created_by: adderProfile?.id || null,
          is_active: true,
        });

      if (error) {
        console.error('Failed to create squad:', error);
      } else {
        console.log(`🍿 Squad created: ${chatTitle}`);

        // Notify the user who added the bot (NOT the channel!)
        try {
          await ctx.api.sendMessage(
            fromUser.id,
            `🍿 *Попкорн-команда "${chatTitle}" активирована!*\n\n` +
            'Теперь участники вашего сообщества могут вступить в эту команду через Quipo.\n\n' +
            '• Все лайки (попкорны) участников суммируются\n' +
            '• Команда появится в общем рейтинге\n' +
            '• Создатели контента могут указывать вашу команду\n\n' +
            '_Открой Quipo → на главной нажми "Вступить" в блоке Попкорн-команды_',
            { parse_mode: 'Markdown' }
          );
        } catch (e) {
          console.log('Could not send activation message to user:', e);
        }

        // Save avatar for new squad
        await saveSquadAvatar(chatId);
      }
    }
  }

  // Bot was removed from admin
  if ((oldStatus === 'administrator' || oldStatus === 'creator') &&
    newStatus !== 'administrator' && newStatus !== 'creator') {

    console.log(`🍿 Bot removed as admin from ${chatType}: ${chatTitle} (${chatId})`);

    // Deactivate squad
    await supabase
      .from('squads')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('telegram_chat_id', chatId);

    console.log(`🍿 Squad deactivated: ${chatTitle}`);
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
  if (botStarted) {
    return;
  }
  botStarted = true;

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
