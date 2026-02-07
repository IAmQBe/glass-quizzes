import { InlineKeyboard } from 'grammy';
import { bot } from '../index.js';
import { buildStartParam } from '../../lib/telegram.js';

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

interface PredictionModerationPayload {
  id: string;
  title: string;
  squadTitle?: string | null;
  reportCount?: number;
}

interface AuthorPendingModerationPayload {
  id: string;
  title: string;
  type: ContentType;
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

export async function notifyAuthorContentPendingReview(
  authorTelegramId: number,
  content: AuthorPendingModerationPayload
): Promise<void> {
  const typeLabel = content.type === 'quiz' ? 'квиз' : 'тест';
  const statusLabel = 'На проверке';
  const startParam = buildStartParam(
    content.type === 'quiz'
      ? { questId: content.id, source: 'moderation' }
      : { testId: content.id, source: 'moderation' }
  );
  const deepLink = `${MINI_APP_URL}?startapp=${encodeURIComponent(startParam)}`;

  const message = `
⏳ <b>Ваш ${typeLabel} отправлен на модерацию</b>

<b>${escapeHtml(content.title)}</b>
Статус: <b>${statusLabel}</b>

Мы пришлём новое уведомление после решения модератора.
  `.trim();

  const keyboard = new InlineKeyboard()
    .webApp('🔎 Открыть статус', deepLink);

  try {
    await bot.api.sendMessage(authorTelegramId, message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
    console.log(`Sent pending moderation status to author ${authorTelegramId}`);
  } catch (error) {
    console.error(`Failed to send pending moderation status to author ${authorTelegramId}:`, error);
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

export async function notifyAdminsPredictionPending(
  prediction: PredictionModerationPayload
): Promise<void> {
  if (ADMIN_TELEGRAM_IDS.length === 0) {
    console.warn('No admin Telegram IDs configured for prediction notifications');
    return;
  }

  const message = `
🆕 <b>Новое событие на модерации</b>

<b>${prediction.title}</b>
${prediction.squadTitle ? `👥 Сквад: ${prediction.squadTitle}` : ''}

🆔 <code>${prediction.id}</code>
  `.trim();

  const deepLink = `${MINI_APP_URL}?startapp=poll=${encodeURIComponent(prediction.id)}`;
  const keyboard = new InlineKeyboard()
    .webApp('👁️ Открыть событие', deepLink);

  for (const adminId of ADMIN_TELEGRAM_IDS) {
    try {
      await bot.api.sendMessage(adminId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (error) {
      console.error(`Failed to notify admin ${adminId} about pending prediction:`, error);
    }
  }
}

export async function notifyAdminsPredictionUnderReview(
  prediction: PredictionModerationPayload
): Promise<void> {
  if (ADMIN_TELEGRAM_IDS.length === 0) {
    console.warn('No admin Telegram IDs configured for prediction notifications');
    return;
  }

  const message = `
🚨 <b>Событие отправлено на проверку</b>

<b>${prediction.title}</b>
${prediction.squadTitle ? `👥 Сквад: ${prediction.squadTitle}` : ''}
${typeof prediction.reportCount === 'number' ? `⚠️ Репортов: ${prediction.reportCount}` : ''}

🆔 <code>${prediction.id}</code>
  `.trim();

  const deepLink = `${MINI_APP_URL}?startapp=poll=${encodeURIComponent(prediction.id)}`;
  const keyboard = new InlineKeyboard()
    .webApp('🔎 Открыть событие', deepLink);

  for (const adminId of ADMIN_TELEGRAM_IDS) {
    try {
      await bot.api.sendMessage(adminId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (error) {
      console.error(`Failed to notify admin ${adminId} about under_review prediction:`, error);
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
