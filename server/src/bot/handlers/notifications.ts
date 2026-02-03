import { InlineKeyboard } from 'grammy';
import { bot } from '../index.js';

const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',')
  .map((id) => parseInt(id.trim(), 10))
  .filter((id) => !isNaN(id));

const MINI_APP_URL = process.env.VITE_MINI_APP_URL || 'https://t.me/QuipoBot/app';

export type ContentType = 'quiz' | 'personality_test';

interface NewContentPayload {
  id: string;
  title: string;
  authorName: string;
  authorId?: number;
  questionCount?: number;
  resultCount?: number;
}

/**
 * Notify all admins about new content pending moderation
 */
export async function notifyAdminsNewContent(
  type: ContentType,
  content: NewContentPayload
): Promise<void> {
  if (ADMIN_TELEGRAM_IDS.length === 0) {
    console.warn('No admin Telegram IDs configured for notifications');
    return;
  }

  const typeLabel = type === 'quiz' ? '🧠 Квиз' : '🎭 Тест личности';
  const statsLine = type === 'quiz'
    ? `📝 ${content.questionCount || 0} вопросов`
    : `📝 ${content.questionCount || 0} вопросов · ${content.resultCount || 0} результатов`;

  const message = `
🆕 <b>Новый ${typeLabel} на модерации!</b>

<b>${content.title}</b>

${statsLine}
👤 Автор: ${content.authorName}

🔗 <a href="${MINI_APP_URL}?startapp=moderate_${type}_${content.id}">Открыть в админке</a>
  `.trim();

  const keyboard = new InlineKeyboard()
    .text('✅ Одобрить', `approve_${type}:${content.id}`)
    .text('❌ Отклонить', `reject_${type}:${content.id}`);

  for (const adminId of ADMIN_TELEGRAM_IDS) {
    try {
      await bot.api.sendMessage(adminId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      console.log(`Sent moderation notification to admin ${adminId}`);
    } catch (error) {
      console.error(`Failed to send notification to admin ${adminId}:`, error);
    }
  }
}

/**
 * Notify content author about moderation result
 */
export async function notifyAuthorModerationResult(
  authorTelegramId: number,
  contentTitle: string,
  approved: boolean,
  reason?: string
): Promise<void> {
  const statusEmoji = approved ? '✅' : '❌';
  const statusText = approved ? 'одобрен' : 'отклонён';

  let message = `
${statusEmoji} <b>Ваш контент ${statusText}!</b>

<b>${contentTitle}</b>
  `.trim();

  if (!approved && reason) {
    message += `\n\n📝 Причина: ${reason}`;
  }

  if (approved) {
    message += `\n\n🎉 Он теперь доступен всем пользователям!`;
  } else {
    message += `\n\nВы можете создать новый контент, учитывая замечания.`;
  }

  const keyboard = new InlineKeyboard()
    .webApp('📱 Открыть приложение', MINI_APP_URL);

  try {
    await bot.api.sendMessage(authorTelegramId, message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
    console.log(`Sent moderation result to author ${authorTelegramId}`);
  } catch (error) {
    console.error(`Failed to send result to author ${authorTelegramId}:`, error);
  }
}

/**
 * Notify admins about important events (low-priority, informational)
 */
export async function notifyAdminsEvent(
  event: string,
  details?: Record<string, any>
): Promise<void> {
  if (ADMIN_TELEGRAM_IDS.length === 0) return;

  const message = `
📊 <b>Event:</b> ${event}
${details ? `\n<pre>${JSON.stringify(details, null, 2)}</pre>` : ''}
  `.trim();

  for (const adminId of ADMIN_TELEGRAM_IDS) {
    try {
      await bot.api.sendMessage(adminId, message, { parse_mode: 'HTML' });
    } catch (error) {
      // Silent fail for informational notifications
    }
  }
}
