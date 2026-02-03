-- ========================================
-- Analytics RPC Functions + Data Fixes
-- ========================================

-- Add events table for tracking if not exists
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);

-- Add shares table if not exists
CREATE TABLE IF NOT EXISTS shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  content_type TEXT DEFAULT 'quiz', -- 'quiz' or 'personality_test'
  content_id UUID,
  share_type TEXT DEFAULT 'inline', -- 'inline', 'link', 'direct'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to shares if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shares' AND column_name = 'content_type') THEN
    ALTER TABLE shares ADD COLUMN content_type TEXT DEFAULT 'quiz';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shares' AND column_name = 'content_id') THEN
    ALTER TABLE shares ADD COLUMN content_id UUID;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shares' AND column_name = 'share_type') THEN
    ALTER TABLE shares ADD COLUMN share_type TEXT DEFAULT 'inline';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shares_user_id ON shares(user_id);
CREATE INDEX IF NOT EXISTS idx_shares_content ON shares(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_shares_created_at ON shares(created_at);

-- RLS for events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own events" ON events;
CREATE POLICY "Users can view own events" ON events FOR SELECT USING (auth.uid() = user_id OR auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Users can insert events" ON events;
CREATE POLICY "Users can insert events" ON events FOR INSERT WITH CHECK (true);

-- RLS for shares
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view shares" ON shares;
CREATE POLICY "Anyone can view shares" ON shares FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert shares" ON shares;
CREATE POLICY "Anyone can insert shares" ON shares FOR INSERT WITH CHECK (true);

-- ========================================
-- DAU/WAU/MAU Functions
-- ========================================

CREATE OR REPLACE FUNCTION get_dau()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT COUNT(DISTINCT user_id)
  INTO result
  FROM events
  WHERE created_at >= CURRENT_DATE;
  
  -- Fallback: count profiles with recent activity
  IF result = 0 THEN
    SELECT COUNT(*)
    INTO result
    FROM profiles
    WHERE last_seen_at >= CURRENT_DATE
       OR updated_at >= CURRENT_DATE;
  END IF;
  
  RETURN COALESCE(result, 0);
END;
$$;

CREATE OR REPLACE FUNCTION get_wau()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT COUNT(DISTINCT user_id)
  INTO result
  FROM events
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';
  
  IF result = 0 THEN
    SELECT COUNT(*)
    INTO result
    FROM profiles
    WHERE last_seen_at >= CURRENT_DATE - INTERVAL '7 days'
       OR updated_at >= CURRENT_DATE - INTERVAL '7 days';
  END IF;
  
  RETURN COALESCE(result, 0);
END;
$$;

CREATE OR REPLACE FUNCTION get_mau()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT COUNT(DISTINCT user_id)
  INTO result
  FROM events
  WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';
  
  IF result = 0 THEN
    SELECT COUNT(*)
    INTO result
    FROM profiles
    WHERE last_seen_at >= CURRENT_DATE - INTERVAL '30 days'
       OR updated_at >= CURRENT_DATE - INTERVAL '30 days'
       OR created_at >= CURRENT_DATE - INTERVAL '30 days';
  END IF;
  
  RETURN COALESCE(result, 0);
END;
$$;

-- ========================================
-- Shares Function
-- ========================================

CREATE OR REPLACE FUNCTION get_total_shares()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO result
  FROM shares;
  
  RETURN COALESCE(result, 0);
END;
$$;

-- ========================================
-- Quiz Funnel
-- ========================================

CREATE OR REPLACE FUNCTION get_quiz_funnel(
  from_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days',
  to_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(viewed BIGINT, started BIGINT, completed BIGINT, shared BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Viewed: count of unique users who opened any quiz
    (SELECT COUNT(DISTINCT user_id) FROM events 
     WHERE event_type = 'quiz_viewed' 
     AND created_at BETWEEN from_date AND to_date + INTERVAL '1 day')::BIGINT as viewed,
    
    -- Started: count of unique users who started a quiz
    (SELECT COUNT(DISTINCT user_id) FROM events 
     WHERE event_type = 'quiz_started' 
     AND created_at BETWEEN from_date AND to_date + INTERVAL '1 day')::BIGINT as started,
    
    -- Completed: count of quiz_results in period
    (SELECT COUNT(*) FROM quiz_results 
     WHERE created_at BETWEEN from_date AND to_date + INTERVAL '1 day')::BIGINT as completed,
    
    -- Shared: count of shares in period (safe check for content_type column)
    (SELECT COUNT(*) FROM shares 
     WHERE (content_type IS NULL OR content_type = 'quiz')
     AND created_at BETWEEN from_date AND to_date + INTERVAL '1 day')::BIGINT as shared;
END;
$$;

-- ========================================
-- Average Completion Time
-- ========================================

CREATE OR REPLACE FUNCTION get_avg_completion_time()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result NUMERIC;
BEGIN
  SELECT AVG(time_taken_seconds)
  INTO result
  FROM quiz_results
  WHERE time_taken_seconds IS NOT NULL
    AND time_taken_seconds > 0
    AND time_taken_seconds < 600; -- Exclude outliers > 10 min
  
  RETURN COALESCE(ROUND(result), 60);
END;
$$;

-- ========================================
-- Top Quizzes by Completions
-- ========================================

CREATE OR REPLACE FUNCTION get_top_quizzes_by_completions(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(quiz_id UUID, title TEXT, completions BIGINT, shares BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.id as quiz_id,
    q.title::TEXT,
    COUNT(DISTINCT qr.id)::BIGINT as completions,
    COALESCE((
      SELECT COUNT(*) FROM shares s 
      WHERE (s.content_type IS NULL OR s.content_type = 'quiz') 
        AND s.content_id = q.id
    ), 0)::BIGINT as shares
  FROM quizzes q
  LEFT JOIN quiz_results qr ON qr.quiz_id = q.id
  WHERE q.is_published = true
  GROUP BY q.id, q.title
  ORDER BY completions DESC
  LIMIT limit_count;
END;
$$;

-- ========================================
-- User Sources (from referrals)
-- ========================================

CREATE OR REPLACE FUNCTION get_user_sources(days_back INTEGER DEFAULT 30)
RETURNS TABLE(source TEXT, user_count BIGINT, percentage NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_users BIGINT;
BEGIN
  SELECT COUNT(*) INTO total_users
  FROM profiles
  WHERE created_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL;
  
  IF total_users = 0 THEN
    total_users := 1;
  END IF;

  RETURN QUERY
  SELECT 
    COALESCE(NULLIF(p.source, ''), 'direct')::TEXT as source,
    COUNT(*)::BIGINT as user_count,
    ROUND((COUNT(*)::NUMERIC / total_users) * 100, 1) as percentage
  FROM profiles p
  WHERE p.created_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL
  GROUP BY COALESCE(NULLIF(p.source, ''), 'direct')
  ORDER BY user_count DESC;
END;
$$;

-- ========================================
-- Active Users by Period
-- ========================================

CREATE OR REPLACE FUNCTION get_active_users_by_period(days_back INTEGER DEFAULT 30)
RETURNS TABLE(event_date DATE, unique_users BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(e.created_at) as event_date,
    COUNT(DISTINCT e.user_id)::BIGINT as unique_users
  FROM events e
  WHERE e.created_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL
  GROUP BY DATE(e.created_at)
  ORDER BY event_date;
END;
$$;

-- ========================================
-- Add missing columns to profiles
-- ========================================

-- Add source column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'source') THEN
    ALTER TABLE profiles ADD COLUMN source TEXT;
  END IF;
END $$;

-- Add last_seen_at if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'last_seen_at') THEN
    ALTER TABLE profiles ADD COLUMN last_seen_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Add time_taken_seconds to quiz_results if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quiz_results' AND column_name = 'time_taken_seconds') THEN
    ALTER TABLE quiz_results ADD COLUMN time_taken_seconds INTEGER;
  END IF;
END $$;

-- ========================================
-- Grant execute permissions
-- ========================================

GRANT EXECUTE ON FUNCTION get_dau() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_wau() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_mau() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_total_shares() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_quiz_funnel(DATE, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_avg_completion_time() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_top_quizzes_by_completions(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_sources(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_active_users_by_period(INTEGER) TO anon, authenticated;
