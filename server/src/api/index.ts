import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { validateInitData, parseStartParam, type InitData } from '../lib/telegram.js';
import {
  getQuizById,
  getPublishedQuizzes,
  getDailyQuiz,
  getProfileByTelegramId,
  getPredictionPollById,
  getSquadTitleById,
  isProfileAdmin,
  getTaskById,
  getCompletedTaskIds,
  completeTaskForProfile,
  revokeTaskCompletionForProfile,
  type Task,
} from '../lib/supabase.js';
import { bot } from '../bot/index.js';
import { analytics } from './analytics.js';
import { notifyAdminsNewQuiz } from '../bot/notifications.js';
import { notifyAdminsPredictionPending, notifyAdminsPredictionUnderReview } from '../bot/handlers/notifications.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:8080', 'http://localhost:5173', process.env.VITE_MINI_APP_URL || '*'],
  credentials: true,
}));

// Extend Hono context with validated user
declare module 'hono' {
  interface ContextVariableMap {
    initData: InitData;
  }
}

/**
 * Middleware to validate Telegram initData
 */
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('tma ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const initDataString = authHeader.slice(4); // Remove "tma " prefix

  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return c.json({ error: 'Server configuration error' }, 500);
    }

    const initData = validateInitData(initDataString, botToken);
    c.set('initData', initData);
    await next();
  } catch (error) {
    console.error('Auth error:', error);
    return c.json({ error: 'Invalid initData' }, 401);
  }
};

const VERIFIABLE_TASK_TYPES = new Set(['subscribe_channel', 'channel_boost', 'telegram_premium']);

const parseTelegramChatId = (value: string | null): string | null => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^-?\d+$/.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('@')) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (!url.hostname.includes('t.me')) return null;

    const path = url.pathname.replace(/^\/+/, '');
    const segment = path.split('/')[0];
    if (!segment) return null;
    if (/^-?\d+$/.test(segment)) return segment;
    return `@${segment}`;
  } catch {
    if (trimmed.includes('/')) {
      const segment = trimmed.split('/').filter(Boolean).pop();
      if (!segment) return null;
      if (/^-?\d+$/.test(segment)) return segment;
      return `@${segment}`;
    }
    return `@${trimmed}`;
  }
};

const callTelegramBotApi = async <T>(method: string, payload: Record<string, unknown>): Promise<T | null> => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN is not configured');
    return null;
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = await response.json() as { ok: boolean; result?: T; description?: string };
  if (!response.ok || !json.ok) {
    console.warn(`Telegram API ${method} failed:`, json.description || response.statusText);
    return null;
  }

  return json.result ?? null;
};

const verifyTaskEligibility = async (
  task: Task,
  telegramUserId: number,
  userIsPremium: boolean
): Promise<{ ok: boolean; message?: string }> => {
  if (task.task_type === 'telegram_premium') {
    return userIsPremium
      ? { ok: true }
      : { ok: false, message: 'Нужна активная подписка Telegram Premium' };
  }

  if (task.task_type === 'subscribe_channel') {
    const chatId = parseTelegramChatId(task.action_url);
    if (!chatId) {
      return { ok: false, message: 'Некорректный канал в задании' };
    }

    const member = await callTelegramBotApi<{ status?: string; is_member?: boolean }>('getChatMember', {
      chat_id: chatId,
      user_id: telegramUserId,
    });

    if (!member) {
      return { ok: false, message: 'Не удалось проверить подписку. Убедитесь, что бот является админом канала' };
    }

    const status = member.status || '';
    const isSubscribed =
      status === 'member' ||
      status === 'administrator' ||
      status === 'creator' ||
      (status === 'restricted' && member.is_member === true);

    return isSubscribed
      ? { ok: true }
      : { ok: false, message: 'Подпишитесь на канал и попробуйте снова' };
  }

  if (task.task_type === 'channel_boost') {
    const chatId = parseTelegramChatId(task.action_url);
    if (!chatId) {
      return { ok: false, message: 'Некорректный канал в задании' };
    }

    const boosts = await callTelegramBotApi<{ boosts?: unknown[] }>('getUserChatBoosts', {
      chat_id: chatId,
      user_id: telegramUserId,
    });

    if (!boosts) {
      return { ok: false, message: 'Не удалось проверить буст канала. Проверьте права бота в канале' };
    }

    const hasBoost = Array.isArray(boosts.boosts) && boosts.boosts.length > 0;
    return hasBoost
      ? { ok: true }
      : { ok: false, message: 'Сначала отдайте буст каналу и повторите проверку' };
  }

  return { ok: true };
};

// ==================
// Public Routes
// ==================

/**
 * Health check
 */
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Get published quizzes (public)
 */
app.get('/api/quizzes', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const quizzes = await getPublishedQuizzes(limit);
    return c.json({ quizzes });
  } catch (error) {
    console.error('Get quizzes error:', error);
    return c.json({ error: 'Failed to fetch quizzes' }, 500);
  }
});

/**
 * Get daily quiz (public)
 */
app.get('/api/quizzes/daily', async (c) => {
  try {
    const quiz = await getDailyQuiz();
    if (!quiz) {
      return c.json({ error: 'No quiz available' }, 404);
    }
    return c.json({ quiz });
  } catch (error) {
    console.error('Get daily quiz error:', error);
    return c.json({ error: 'Failed to fetch daily quiz' }, 500);
  }
});

/**
 * Get quiz by ID (public)
 */
app.get('/api/quizzes/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const quiz = await getQuizById(id);

    if (!quiz) {
      return c.json({ error: 'Quiz not found' }, 404);
    }

    return c.json({ quiz });
  } catch (error) {
    console.error('Get quiz error:', error);
    return c.json({ error: 'Failed to fetch quiz' }, 500);
  }
});

// ==================
// Protected Routes (require initData)
// ==================

/**
 * Validate initData and get user info
 */
app.post('/api/auth/validate', authMiddleware, (c) => {
  const initData = c.get('initData');
  const startParam = parseStartParam(initData.start_param);

  return c.json({
    valid: true,
    user: initData.user,
    startParam,
  });
});

/**
 * Start a quiz attempt
 */
app.post('/api/attempts/start', authMiddleware, async (c) => {
  const initData = c.get('initData');
  const body = await c.req.json();
  const { quizId } = body;

  if (!quizId) {
    return c.json({ error: 'quizId is required' }, 400);
  }

  // TODO: Create attempt in database
  // For now, just validate and return
  const quiz = await getQuizById(quizId);
  if (!quiz) {
    return c.json({ error: 'Quiz not found' }, 404);
  }

  return c.json({
    attemptId: crypto.randomUUID(),
    quiz,
    user: initData.user,
    startedAt: new Date().toISOString(),
  });
});

/**
 * Log a share event
 */
app.post('/api/shares', authMiddleware, async (c) => {
  const initData = c.get('initData');
  const body = await c.req.json();
  const { attemptId, chatType, source } = body;

  // TODO: Log share in database
  console.log('Share event:', {
    userId: initData.user?.id,
    attemptId,
    chatType,
    source,
    timestamp: new Date().toISOString(),
  });

  return c.json({ success: true });
});

/**
 * Submit quiz for review (notifies admins)
 */
app.post('/api/quizzes/submit-for-review', authMiddleware, async (c) => {
  const initData = c.get('initData');
  const body = await c.req.json();
  const { quizId } = body;

  if (!quizId) {
    return c.json({ error: 'quizId is required' }, 400);
  }

  try {
    // Get quiz details
    const quiz = await getQuizById(quizId);
    if (!quiz) {
      return c.json({ error: 'Quiz not found' }, 404);
    }

    // Get author info
    const user = initData.user;
    if (!user) {
      return c.json({ error: 'User not found' }, 400);
    }

    // Send notification to admins
    await notifyAdminsNewQuiz({
      quizId: quiz.id,
      title: quiz.title,
      description: quiz.description || undefined,
      questionCount: quiz.question_count || 0,
      authorId: user.id,
      authorName: user.first_name + (user.last_name ? ` ${user.last_name}` : ''),
      authorUsername: user.username,
    });

    console.log('Quiz submitted for review:', {
      quizId,
      authorId: user.id,
      timestamp: new Date().toISOString(),
    });

    return c.json({ success: true, message: 'Quiz submitted for review' });
  } catch (error) {
    console.error('Submit for review error:', error);
    return c.json({ error: 'Failed to submit for review' }, 500);
  }
});

/**
 * Notify admins about prediction moderation events
 */
app.post('/api/predictions/moderation-notify', authMiddleware, async (c) => {
  const initData = c.get('initData');
  const body = await c.req.json();
  const { pollId, eventType } = body || {};

  if (!pollId || (eventType !== 'pending' && eventType !== 'under_review')) {
    return c.json({ error: 'pollId and valid eventType are required' }, 400);
  }

  const tgUser = initData?.user;
  if (!tgUser?.id) {
    return c.json({ error: 'User not found in initData' }, 400);
  }

  try {
    const profile = await getProfileByTelegramId(tgUser.id);
    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    const poll = await getPredictionPollById(pollId);
    if (!poll) {
      return c.json({ error: 'Prediction poll not found' }, 404);
    }

    const isAdmin = await isProfileAdmin(profile.id);

    if (eventType === 'pending' && !isAdmin && poll.created_by !== profile.id) {
      return c.json({ error: 'Forbidden for pending notification' }, 403);
    }

    if (eventType === 'under_review' && !isAdmin) {
      return c.json({ error: 'Only admins can send under_review notification' }, 403);
    }

    const squadTitle = await getSquadTitleById(poll.squad_id);

    if (eventType === 'pending') {
      await notifyAdminsPredictionPending({
        id: poll.id,
        title: poll.title,
        squadTitle,
        reportCount: poll.report_count,
      });
    } else {
      await notifyAdminsPredictionUnderReview({
        id: poll.id,
        title: poll.title,
        squadTitle,
        reportCount: poll.report_count,
      });
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Prediction moderation notify error:', error);
    return c.json({ error: 'Failed to send prediction notification' }, 500);
  }
});

/**
 * Complete task with server-side verification (Telegram-aware)
 */
app.post('/api/tasks/complete', authMiddleware, async (c) => {
  const initData = c.get('initData');
  const tgUser = initData.user;
  if (!tgUser?.id) {
    return c.json({ error: 'User not found in initData' }, 400);
  }

  const body = await c.req.json().catch(() => null) as { taskId?: string } | null;
  const taskId = body?.taskId;
  if (!taskId) {
    return c.json({ error: 'taskId is required' }, 400);
  }

  try {
    const profile = await getProfileByTelegramId(tgUser.id);
    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    const task = await getTaskById(taskId);
    if (!task) {
      return c.json({ error: 'Task not found' }, 404);
    }

    if (!task.is_active) {
      return c.json({ error: 'Task is inactive' }, 400);
    }

    const verification = await verifyTaskEligibility(task, tgUser.id, Boolean(tgUser.is_premium));
    if (!verification.ok) {
      return c.json({ error: verification.message || 'Task condition not satisfied' }, 400);
    }

    const result = await completeTaskForProfile(profile.id, task.id);
    return c.json({
      success: true,
      alreadyCompleted: result.alreadyCompleted,
    });
  } catch (error) {
    console.error('Task completion error:', error);
    return c.json({ error: 'Failed to complete task' }, 500);
  }
});

/**
 * Get completed tasks and auto-revoke invalid verifiable completions
 */
app.get('/api/tasks/completed', authMiddleware, async (c) => {
  const initData = c.get('initData');
  const tgUser = initData.user;
  if (!tgUser?.id) {
    return c.json({ taskIds: [] });
  }

  try {
    const profile = await getProfileByTelegramId(tgUser.id);
    if (!profile) {
      return c.json({ taskIds: [] });
    }

    const completedTaskIds = await getCompletedTaskIds(profile.id);
    if (completedTaskIds.length === 0) {
      return c.json({ taskIds: [] });
    }

    const validTaskIds: string[] = [];

    for (const taskId of completedTaskIds) {
      const task = await getTaskById(taskId);
      if (!task) continue;

      if (!VERIFIABLE_TASK_TYPES.has(task.task_type)) {
        validTaskIds.push(taskId);
        continue;
      }

      const verification = await verifyTaskEligibility(task, tgUser.id, Boolean(tgUser.is_premium));
      if (!verification.ok) {
        await revokeTaskCompletionForProfile(profile.id, taskId);
        continue;
      }

      validTaskIds.push(taskId);
    }

    return c.json({ taskIds: validTaskIds });
  } catch (error) {
    console.error('Get completed tasks error:', error);
    return c.json({ error: 'Failed to fetch completed tasks' }, 500);
  }
});

// ==================
// Admin Routes (require admin check)
// ==================

const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',')
  .map((id) => parseInt(id.trim(), 10))
  .filter((id) => !isNaN(id));

/**
 * Admin middleware - checks if user is in admin list
 */
const adminMiddleware = async (c: any, next: any) => {
  const initData = c.get('initData');
  const userId = initData?.user?.id;

  if (!userId || !ADMIN_TELEGRAM_IDS.includes(userId)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  await next();
};

/**
 * Mount analytics routes (protected)
 */
app.use('/api/admin/analytics/*', authMiddleware, adminMiddleware);
app.route('/api/admin/analytics', analytics);

// ==================
// Webhook Route (for production)
// ==================

app.post('/api/bot/webhook', async (c) => {
  const secret = c.req.header('X-Telegram-Bot-Api-Secret-Token');

  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const update = await c.req.json();
    await bot.handleUpdate(update);
    return c.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ error: 'Failed to process update' }, 500);
  }
});

/**
 * Start the API server
 */
export async function startApi(port: number) {
  console.log('🌐 Starting API server...');

  serve({
    fetch: app.fetch,
    port,
  });

  console.log(`✅ API server running on http://localhost:${port}`);
}

export { app };
