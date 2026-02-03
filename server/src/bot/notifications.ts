import { bot } from './index.js';
import { InlineKeyboard } from 'grammy';

const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',')
  .map((id) => parseInt(id.trim(), 10))
  .filter((id) => !isNaN(id));

const MINI_APP_URL = process.env.VITE_MINI_APP_URL || 'https://quipobot.netlify.app';

export interface QuizNotification {
  quizId: string;
  title: string;
  description?: string;
  questionCount: number;
  authorId: number;
  authorName: string;
  authorUsername?: string;
}

/**
 * Send notification to all admins about a new quiz submission
 */
export async function notifyAdminsNewQuiz(quiz: QuizNotification): Promise<void> {
  if (ADMIN_TELEGRAM_IDS.length === 0) {
    console.warn('No admin IDs configured for notifications');
    return;
  }

  const authorLink = quiz.authorUsername 
    ? `@${quiz.authorUsername}` 
    : `<a href="tg://user?id=${quiz.authorId}">${quiz.authorName}</a>`;

  const message = `📝 <b>Новый квиз на модерацию!</b>\n\n` +
    `📌 <b>${escapeHtml(quiz.title)}</b>\n` +
    (quiz.description ? `📄 ${escapeHtml(quiz.description.slice(0, 100))}${quiz.description.length > 100 ? '...' : ''}\n` : '') +
    `❓ Вопросов: ${quiz.questionCount}\n` +
    `👤 Автор: ${authorLink}\n\n` +
    `🆔 <code>${quiz.quizId}</code>`;

  const keyboard = new InlineKeyboard()
    .text('✅ Одобрить', `approve_quiz:${quiz.quizId}`)
    .text('❌ Отклонить', `reject_quiz:${quiz.quizId}`)
    .row()
    .webApp('👁️ Предпросмотр', `${MINI_APP_URL}?startapp=preview_${quiz.quizId}`);

  for (const adminId of ADMIN_TELEGRAM_IDS) {
    try {
      await bot.api.sendMessage(adminId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (error) {
      console.error(`Failed to notify admin ${adminId}:`, error);
    }
  }
}

/**
 * Notify quiz author about moderation result
 */
export async function notifyAuthorModerationResult(
  authorId: number,
  quizTitle: string,
  approved: boolean,
  reason?: string
): Promise<void> {
  const message = approved
    ? `🎉 <b>Отличные новости!</b>\n\nТвой квиз "<b>${escapeHtml(quizTitle)}</b>" одобрен и опубликован! Теперь другие пользователи могут его проходить.\n\n🔥 Делись им с друзьями!`
    : `😔 <b>К сожалению...</b>\n\nТвой квиз "<b>${escapeHtml(quizTitle)}</b>" не прошёл модерацию.\n\n${reason ? `📝 Причина: ${escapeHtml(reason)}\n\n` : ''}Ты можешь исправить замечания и отправить квиз заново!`;

  const keyboard = new InlineKeyboard()
    .webApp('📱 Открыть приложение', MINI_APP_URL);

  try {
    await bot.api.sendMessage(authorId, message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error(`Failed to notify author ${authorId}:`, error);
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
