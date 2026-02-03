import { Hono } from 'hono';
import { supabase } from '../lib/supabase.js';

const analytics = new Hono();

/**
 * Get overview stats for admin dashboard
 */
analytics.get('/overview', async (c) => {
  try {
    // Run all queries in parallel
    const [
      usersResult,
      quizzesResult,
      attemptsResult,
      sharesResult,
      avgTimeResult,
      todayUsersResult,
      weekUsersResult,
    ] = await Promise.all([
      // Total users
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      
      // Total quizzes (published)
      supabase.from('quizzes').select('*', { count: 'exact', head: true }).eq('is_published', true),
      
      // Total attempts
      supabase.from('quiz_results').select('*', { count: 'exact', head: true }),
      
      // Total shares
      supabase.from('shares').select('*', { count: 'exact', head: true }),
      
      // Average completion time (estimated from duration_seconds)
      supabase.from('quizzes').select('duration_seconds').eq('is_published', true),
      
      // DAU - users who completed quiz today
      supabase
        .from('quiz_results')
        .select('user_id', { count: 'exact', head: true })
        .gte('completed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      
      // WAU - users who completed quiz this week
      supabase
        .from('quiz_results')
        .select('user_id', { count: 'exact', head: true })
        .gte('completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    // Calculate average time
    const avgTime = avgTimeResult.data?.length 
      ? Math.round(avgTimeResult.data.reduce((sum, q) => sum + q.duration_seconds, 0) / avgTimeResult.data.length)
      : 60;

    return c.json({
      totalUsers: usersResult.count || 0,
      totalQuizzes: quizzesResult.count || 0,
      totalAttempts: attemptsResult.count || 0,
      totalShares: sharesResult.count || 0,
      avgCompletionTime: avgTime,
      dau: todayUsersResult.count || 0,
      wau: weekUsersResult.count || 0,
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    return c.json({ error: 'Failed to fetch analytics' }, 500);
  }
});

/**
 * Get funnel metrics
 */
analytics.get('/funnel', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [attemptsResult, completedResult, sharesResult] = await Promise.all([
      // Started (all quiz_results are started)
      supabase
        .from('quiz_results')
        .select('*', { count: 'exact', head: true })
        .gte('completed_at', since),
      
      // Completed (has score > 0)
      supabase
        .from('quiz_results')
        .select('*', { count: 'exact', head: true })
        .gte('completed_at', since)
        .gt('score', 0),
      
      // Shared
      supabase
        .from('shares')
        .select('*', { count: 'exact', head: true })
        .gte('shared_at', since),
    ]);

    const started = attemptsResult.count || 0;
    const completed = completedResult.count || 0;
    const shared = sharesResult.count || 0;

    return c.json({
      period: `${days} days`,
      funnel: [
        { stage: 'Started', count: started, percentage: 100 },
        { stage: 'Completed', count: completed, percentage: started ? Math.round((completed / started) * 100) : 0 },
        { stage: 'Shared', count: shared, percentage: completed ? Math.round((shared / completed) * 100) : 0 },
      ],
    });
  } catch (error) {
    console.error('Funnel analytics error:', error);
    return c.json({ error: 'Failed to fetch funnel' }, 500);
  }
});

/**
 * Get top quizzes
 */
analytics.get('/top-quizzes', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '10', 10);
    const sortBy = c.req.query('sort') || 'participant_count'; // participant_count, like_count, save_count

    const { data: quizzes, error } = await supabase
      .from('quizzes')
      .select('id, title, participant_count, like_count, save_count, question_count')
      .eq('is_published', true)
      .order(sortBy, { ascending: false })
      .limit(limit);

    if (error) throw error;

    return c.json({ quizzes: quizzes || [] });
  } catch (error) {
    console.error('Top quizzes error:', error);
    return c.json({ error: 'Failed to fetch top quizzes' }, 500);
  }
});

/**
 * Get activity over time (daily)
 */
analytics.get('/activity', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '14', 10);
    
    // Generate date range
    const dates: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      dates.push(date.toISOString().split('T')[0]);
    }

    // Get daily completions
    const { data: completions, error } = await supabase
      .from('quiz_results')
      .select('completed_at')
      .gte('completed_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

    if (error) throw error;

    // Count by date
    const countsByDate: Record<string, number> = {};
    for (const date of dates) {
      countsByDate[date] = 0;
    }

    for (const completion of completions || []) {
      const date = completion.completed_at.split('T')[0];
      if (countsByDate[date] !== undefined) {
        countsByDate[date]++;
      }
    }

    return c.json({
      activity: dates.map((date) => ({
        date,
        completions: countsByDate[date],
      })),
    });
  } catch (error) {
    console.error('Activity analytics error:', error);
    return c.json({ error: 'Failed to fetch activity' }, 500);
  }
});

/**
 * Get recent activity feed
 */
analytics.get('/recent', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '20', 10);

    const [quizzesResult, resultsResult, sharesResult] = await Promise.all([
      // Recent quizzes created
      supabase
        .from('quizzes')
        .select('id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
      
      // Recent completions
      supabase
        .from('quiz_results')
        .select('id, score, completed_at, quiz_id')
        .order('completed_at', { ascending: false })
        .limit(10),
      
      // Recent shares
      supabase
        .from('shares')
        .select('id, source, shared_at')
        .order('shared_at', { ascending: false })
        .limit(5),
    ]);

    // Combine and sort
    const events = [
      ...(quizzesResult.data || []).map((q) => ({
        type: 'quiz_created',
        id: q.id,
        title: q.title,
        timestamp: q.created_at,
      })),
      ...(resultsResult.data || []).map((r) => ({
        type: 'quiz_completed',
        id: r.id,
        score: r.score,
        timestamp: r.completed_at,
      })),
      ...(sharesResult.data || []).map((s) => ({
        type: 'share',
        id: s.id,
        source: s.source,
        timestamp: s.shared_at,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return c.json({ events });
  } catch (error) {
    console.error('Recent activity error:', error);
    return c.json({ error: 'Failed to fetch recent activity' }, 500);
  }
});

export { analytics };
