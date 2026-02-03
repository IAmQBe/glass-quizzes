import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { validateInitData, parseStartParam, type InitData } from '../lib/telegram.js';
import { getQuizById, getPublishedQuizzes, getDailyQuiz } from '../lib/supabase.js';
import { bot } from '../bot/index.js';
import { analytics } from './analytics.js';

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
