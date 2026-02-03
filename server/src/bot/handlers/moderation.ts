import { Bot, Context, InlineKeyboard } from 'grammy';
import { updateQuizStatus, getQuizById, getProfileByTelegramId } from '../../lib/supabase.js';
import { notifyAuthorModerationResult } from '../notifications.js';

const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',')
  .map((id) => parseInt(id.trim(), 10))
  .filter((id) => !isNaN(id));

/**
 * Register moderation handlers for the bot
 */
export function registerModerationHandlers(bot: Bot<Context>): void {
  // Handle approve_quiz callback
  bot.callbackQuery(/^approve_quiz:(.+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !ADMIN_TELEGRAM_IDS.includes(userId)) {
      await ctx.answerCallbackQuery({ text: '❌ Только админы могут модерировать', show_alert: true });
      return;
    }

    const quizId = ctx.match[1];

    try {
      // Update quiz status
      const quiz = await updateQuizStatus(quizId, 'published', String(userId));

      if (!quiz) {
        await ctx.answerCallbackQuery({ text: '❌ Квиз не найден', show_alert: true });
        return;
      }

      // Notify author
      if (quiz.created_by) {
        const profile = await getProfileByTelegramId(parseInt(quiz.created_by));
        if (profile?.telegram_id) {
          await notifyAuthorModerationResult(profile.telegram_id, quiz.title, true);
        }
      }

      // Update message
      await ctx.editMessageText(
        ctx.callbackQuery.message?.text + '\n\n✅ <b>ОДОБРЕНО</b> ' + 
        `@${ctx.from.username || ctx.from.first_name}`,
        { parse_mode: 'HTML' }
      );

      await ctx.answerCallbackQuery({ text: '✅ Квиз опубликован!' });
    } catch (error) {
      console.error('Approve quiz error:', error);
      await ctx.answerCallbackQuery({ text: '❌ Ошибка при одобрении', show_alert: true });
    }
  });

  // Handle reject_quiz callback
  bot.callbackQuery(/^reject_quiz:(.+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !ADMIN_TELEGRAM_IDS.includes(userId)) {
      await ctx.answerCallbackQuery({ text: '❌ Только админы могут модерировать', show_alert: true });
      return;
    }

    const quizId = ctx.match[1];

    // Ask for rejection reason
    const keyboard = new InlineKeyboard()
      .text('🚫 Некачественный контент', `reject_reason:${quizId}:quality`)
      .row()
      .text('⚠️ Нарушение правил', `reject_reason:${quizId}:rules`)
      .row()
      .text('❓ Дублирующий контент', `reject_reason:${quizId}:duplicate`)
      .row()
      .text('📝 Другая причина', `reject_reason:${quizId}:other`)
      .row()
      .text('❌ Отмена', `cancel_reject:${quizId}`);

    await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // Handle rejection reason selection
  bot.callbackQuery(/^reject_reason:(.+):(.+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !ADMIN_TELEGRAM_IDS.includes(userId)) {
      await ctx.answerCallbackQuery({ text: '❌ Только админы могут модерировать', show_alert: true });
      return;
    }

    const quizId = ctx.match[1];
    const reasonCode = ctx.match[2];

    const reasons: Record<string, string> = {
      quality: 'Контент не соответствует стандартам качества',
      rules: 'Нарушение правил платформы',
      duplicate: 'Дублирующий или слишком похожий контент',
      other: 'Не соответствует требованиям',
    };

    const reason = reasons[reasonCode] || 'Квиз не прошёл модерацию';

    try {
      const quiz = await updateQuizStatus(quizId, 'rejected', String(userId), reason);

      if (!quiz) {
        await ctx.answerCallbackQuery({ text: '❌ Квиз не найден', show_alert: true });
        return;
      }

      // Notify author
      if (quiz.created_by) {
        const profile = await getProfileByTelegramId(parseInt(quiz.created_by));
        if (profile?.telegram_id) {
          await notifyAuthorModerationResult(profile.telegram_id, quiz.title, false, reason);
        }
      }

      // Update message
      await ctx.editMessageText(
        ctx.callbackQuery.message?.text + '\n\n❌ <b>ОТКЛОНЕНО</b>\n' +
        `📝 Причина: ${reason}\n` +
        `👤 @${ctx.from.username || ctx.from.first_name}`,
        { parse_mode: 'HTML' }
      );

      await ctx.answerCallbackQuery({ text: '❌ Квиз отклонён' });
    } catch (error) {
      console.error('Reject quiz error:', error);
      await ctx.answerCallbackQuery({ text: '❌ Ошибка при отклонении', show_alert: true });
    }
  });

  // Handle cancel rejection
  bot.callbackQuery(/^cancel_reject:(.+)$/, async (ctx) => {
    const quizId = ctx.match[1];

    // Restore original buttons
    const keyboard = new InlineKeyboard()
      .text('✅ Одобрить', `approve_quiz:${quizId}`)
      .text('❌ Отклонить', `reject_quiz:${quizId}`);

    await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
    await ctx.answerCallbackQuery({ text: 'Отменено' });
  });
}
