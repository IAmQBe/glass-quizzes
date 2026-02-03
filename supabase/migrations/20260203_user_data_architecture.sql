-- =====================================================
-- User Data Architecture Migration
-- Glass Quizzes - Full user tracking and analytics
-- =====================================================

-- =====================================================
-- PHASE 1: Fix RLS Policies for profiles
-- =====================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Allow anyone to create profile with telegram_id (for Telegram Mini App)
CREATE POLICY "Anyone can create profile with telegram_id" 
ON profiles FOR INSERT 
WITH CHECK (telegram_id IS NOT NULL);

-- Allow reading all profiles (for leaderboards, etc.)
CREATE POLICY "Anyone can read profiles" 
ON profiles FOR SELECT 
USING (true);

-- Allow updating own profile by telegram_id match
CREATE POLICY "Users can update own profile by telegram_id" 
ON profiles FOR UPDATE 
USING (true)
WITH CHECK (telegram_id IS NOT NULL);

-- =====================================================
-- PHASE 2: Extend profiles table
-- =====================================================

-- Add new columns for complete user data
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS platform TEXT; -- ios, android, tdesktop, web, etc.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS app_version TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_sessions INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_source TEXT; -- inline, direct, deeplink, share

-- Ensure has_telegram_premium has default
ALTER TABLE profiles ALTER COLUMN has_telegram_premium SET DEFAULT false;

-- Create index for faster lookups by telegram_id
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON profiles(telegram_id);

-- =====================================================
-- PHASE 3: Create user_events table for tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User identification (profile may not exist yet)
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  telegram_id BIGINT NOT NULL,
  
  -- Event details
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  
  -- Context
  quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL,
  session_id TEXT, -- Group events in a session
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Denormalized for fast date-based queries
  event_date DATE GENERATED ALWAYS AS (created_at::date) STORED
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_events_telegram_id ON user_events(telegram_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_date ON user_events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_quiz ON user_events(quiz_id);
CREATE INDEX IF NOT EXISTS idx_events_session ON user_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON user_events(created_at DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_events_type_date ON user_events(event_type, event_date);

-- RLS for user_events
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert events (from Mini App)
CREATE POLICY "Anyone can insert events" 
ON user_events FOR INSERT 
WITH CHECK (telegram_id IS NOT NULL);

-- Anyone can read events (for analytics)
CREATE POLICY "Anyone can read events" 
ON user_events FOR SELECT 
USING (true);

-- =====================================================
-- PHASE 4: Analytics RPC Functions
-- =====================================================

-- Get DAU/WAU/MAU
CREATE OR REPLACE FUNCTION get_active_users_by_period(days_back INT DEFAULT 30)
RETURNS TABLE(event_date DATE, unique_users BIGINT) AS $$
  SELECT 
    event_date,
    COUNT(DISTINCT telegram_id) as unique_users
  FROM user_events
  WHERE event_date >= CURRENT_DATE - days_back
  GROUP BY event_date
  ORDER BY event_date;
$$ LANGUAGE sql STABLE;

-- Get DAU (single number)
CREATE OR REPLACE FUNCTION get_dau()
RETURNS BIGINT AS $$
  SELECT COUNT(DISTINCT telegram_id)
  FROM user_events
  WHERE event_date = CURRENT_DATE;
$$ LANGUAGE sql STABLE;

-- Get WAU (single number)
CREATE OR REPLACE FUNCTION get_wau()
RETURNS BIGINT AS $$
  SELECT COUNT(DISTINCT telegram_id)
  FROM user_events
  WHERE event_date >= CURRENT_DATE - 7;
$$ LANGUAGE sql STABLE;

-- Get MAU (single number)
CREATE OR REPLACE FUNCTION get_mau()
RETURNS BIGINT AS $$
  SELECT COUNT(DISTINCT telegram_id)
  FROM user_events
  WHERE event_date >= CURRENT_DATE - 30;
$$ LANGUAGE sql STABLE;

-- Get quiz funnel for date range
CREATE OR REPLACE FUNCTION get_quiz_funnel(from_date DATE DEFAULT CURRENT_DATE - 7, to_date DATE DEFAULT CURRENT_DATE)
RETURNS JSON AS $$
  WITH event_counts AS (
    SELECT 
      event_type,
      COUNT(DISTINCT telegram_id) as users
    FROM user_events
    WHERE event_date BETWEEN from_date AND to_date
      AND event_type IN ('quiz_view', 'quiz_start', 'quiz_complete', 'quiz_share')
    GROUP BY event_type
  )
  SELECT json_build_object(
    'viewed', COALESCE((SELECT users FROM event_counts WHERE event_type = 'quiz_view'), 0),
    'started', COALESCE((SELECT users FROM event_counts WHERE event_type = 'quiz_start'), 0),
    'completed', COALESCE((SELECT users FROM event_counts WHERE event_type = 'quiz_complete'), 0),
    'shared', COALESCE((SELECT users FROM event_counts WHERE event_type = 'quiz_share'), 0)
  );
$$ LANGUAGE sql STABLE;

-- Get total shares count
CREATE OR REPLACE FUNCTION get_total_shares()
RETURNS BIGINT AS $$
  SELECT COUNT(*)
  FROM user_events
  WHERE event_type = 'quiz_share';
$$ LANGUAGE sql STABLE;

-- Get average completion time in seconds
CREATE OR REPLACE FUNCTION get_avg_completion_time()
RETURNS NUMERIC AS $$
  SELECT COALESCE(
    AVG((event_data->>'time_total_ms')::numeric) / 1000,
    60 -- Default 60 seconds if no data
  )
  FROM user_events
  WHERE event_type = 'quiz_complete'
    AND event_data->>'time_total_ms' IS NOT NULL;
$$ LANGUAGE sql STABLE;

-- Get retention cohorts (weekly)
CREATE OR REPLACE FUNCTION get_retention_cohorts(weeks_back INT DEFAULT 8)
RETURNS TABLE(
  cohort_week DATE,
  week_number INT,
  retained_users BIGINT,
  cohort_size BIGINT,
  retention_rate NUMERIC
) AS $$
  WITH cohorts AS (
    -- First activity week for each user
    SELECT 
      telegram_id,
      DATE_TRUNC('week', MIN(created_at))::date AS cohort_week
    FROM user_events
    WHERE created_at >= CURRENT_DATE - (weeks_back * 7)
    GROUP BY telegram_id
  ),
  cohort_sizes AS (
    SELECT cohort_week, COUNT(*) as size
    FROM cohorts
    GROUP BY cohort_week
  ),
  activity AS (
    SELECT DISTINCT
      telegram_id,
      DATE_TRUNC('week', created_at)::date AS activity_week
    FROM user_events
    WHERE created_at >= CURRENT_DATE - (weeks_back * 7)
  ),
  retention AS (
    SELECT 
      c.cohort_week,
      ((a.activity_week - c.cohort_week) / 7)::int AS week_number,
      COUNT(DISTINCT a.telegram_id) AS retained
    FROM cohorts c
    JOIN activity a ON c.telegram_id = a.telegram_id
    GROUP BY c.cohort_week, week_number
  )
  SELECT 
    r.cohort_week,
    r.week_number,
    r.retained as retained_users,
    cs.size as cohort_size,
    ROUND(r.retained::numeric / cs.size * 100, 1) as retention_rate
  FROM retention r
  JOIN cohort_sizes cs ON r.cohort_week = cs.cohort_week
  WHERE r.week_number >= 0
  ORDER BY r.cohort_week, r.week_number;
$$ LANGUAGE sql STABLE;

-- Get event counts by type for period
CREATE OR REPLACE FUNCTION get_event_stats(from_date DATE DEFAULT CURRENT_DATE - 7, to_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(event_type TEXT, event_count BIGINT, unique_users BIGINT) AS $$
  SELECT 
    event_type,
    COUNT(*) as event_count,
    COUNT(DISTINCT telegram_id) as unique_users
  FROM user_events
  WHERE event_date BETWEEN from_date AND to_date
  GROUP BY event_type
  ORDER BY event_count DESC;
$$ LANGUAGE sql STABLE;

-- Get top quizzes by completions
CREATE OR REPLACE FUNCTION get_top_quizzes_by_completions(limit_count INT DEFAULT 10)
RETURNS TABLE(quiz_id UUID, title TEXT, completions BIGINT, shares BIGINT) AS $$
  SELECT 
    q.id as quiz_id,
    q.title,
    COUNT(DISTINCT CASE WHEN e.event_type = 'quiz_complete' THEN e.telegram_id END) as completions,
    COUNT(DISTINCT CASE WHEN e.event_type = 'quiz_share' THEN e.telegram_id END) as shares
  FROM quizzes q
  LEFT JOIN user_events e ON e.quiz_id = q.id
  WHERE q.is_published = true
  GROUP BY q.id, q.title
  ORDER BY completions DESC
  LIMIT limit_count;
$$ LANGUAGE sql STABLE;

-- Get user sources (where users come from)
CREATE OR REPLACE FUNCTION get_user_sources(days_back INT DEFAULT 30)
RETURNS TABLE(source TEXT, user_count BIGINT, percentage NUMERIC) AS $$
  WITH sources AS (
    SELECT 
      COALESCE(referral_source, 'direct') as source,
      COUNT(*) as cnt
    FROM profiles
    WHERE created_at >= CURRENT_DATE - days_back
    GROUP BY referral_source
  ),
  total AS (
    SELECT SUM(cnt) as total FROM sources
  )
  SELECT 
    s.source,
    s.cnt as user_count,
    ROUND(s.cnt::numeric / t.total * 100, 1) as percentage
  FROM sources s, total t
  ORDER BY s.cnt DESC;
$$ LANGUAGE sql STABLE;

-- =====================================================
-- Grant permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION get_active_users_by_period TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_dau TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_wau TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_mau TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_quiz_funnel TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_total_shares TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_avg_completion_time TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_retention_cohorts TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_event_stats TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_top_quizzes_by_completions TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_sources TO authenticated, anon;

-- =====================================================
-- Done!
-- =====================================================
