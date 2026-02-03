-- Create storage bucket for quiz images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quiz-images', 
  'quiz-images', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for quiz-images bucket
CREATE POLICY "Anyone can view quiz images" ON storage.objects
FOR SELECT USING (bucket_id = 'quiz-images');

CREATE POLICY "Authenticated users can upload quiz images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'quiz-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own quiz images" ON storage.objects
FOR UPDATE USING (bucket_id = 'quiz-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own quiz images" ON storage.objects
FOR DELETE USING (bucket_id = 'quiz-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- RPC Functions for Leaderboard
-- ============================================

-- Leaderboard by completed tests count
CREATE OR REPLACE FUNCTION get_leaderboard_by_tests(limit_count INT DEFAULT 100)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  first_name TEXT,
  avatar_url TEXT,
  has_premium BOOLEAN,
  count BIGINT,
  rank BIGINT
) AS $$
  SELECT 
    qr.user_id,
    p.username,
    p.first_name,
    p.avatar_url,
    p.has_telegram_premium as has_premium,
    COUNT(*) as count,
    RANK() OVER (ORDER BY COUNT(*) DESC) as rank
  FROM quiz_results qr
  JOIN profiles p ON p.id = qr.user_id
  GROUP BY qr.user_id, p.username, p.first_name, p.avatar_url, p.has_telegram_premium
  ORDER BY count DESC
  LIMIT limit_count;
$$ LANGUAGE sql STABLE;

-- Leaderboard by challenge wins
CREATE OR REPLACE FUNCTION get_leaderboard_by_challenges(limit_count INT DEFAULT 100)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  first_name TEXT,
  avatar_url TEXT,
  has_premium BOOLEAN,
  wins BIGINT,
  rank BIGINT
) AS $$
  SELECT 
    c.winner_id as user_id,
    p.username,
    p.first_name,
    p.avatar_url,
    p.has_telegram_premium as has_premium,
    COUNT(*) as wins,
    RANK() OVER (ORDER BY COUNT(*) DESC) as rank
  FROM challenges c
  JOIN profiles p ON p.id = c.winner_id
  WHERE c.status = 'completed' AND c.winner_id IS NOT NULL
  GROUP BY c.winner_id, p.username, p.first_name, p.avatar_url, p.has_telegram_premium
  ORDER BY wins DESC
  LIMIT limit_count;
$$ LANGUAGE sql STABLE;

-- Leaderboard by popcorns (likes received for created quizzes)
CREATE OR REPLACE FUNCTION get_leaderboard_by_popcorns(limit_count INT DEFAULT 100)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  first_name TEXT,
  avatar_url TEXT,
  has_premium BOOLEAN,
  total_popcorns BIGINT,
  quiz_count BIGINT,
  rank BIGINT
) AS $$
  SELECT 
    q.created_by as user_id,
    p.username,
    p.first_name,
    p.avatar_url,
    p.has_telegram_premium as has_premium,
    COALESCE(SUM(q.like_count), 0)::BIGINT as total_popcorns,
    COUNT(*)::BIGINT as quiz_count,
    RANK() OVER (ORDER BY COALESCE(SUM(q.like_count), 0) DESC) as rank
  FROM quizzes q
  JOIN profiles p ON p.id = q.created_by
  WHERE q.status = 'published'
  GROUP BY q.created_by, p.username, p.first_name, p.avatar_url, p.has_telegram_premium
  HAVING COALESCE(SUM(q.like_count), 0) > 0
  ORDER BY total_popcorns DESC
  LIMIT limit_count;
$$ LANGUAGE sql STABLE;

-- Leaderboard by total score
CREATE OR REPLACE FUNCTION get_leaderboard_by_score(limit_count INT DEFAULT 100)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  first_name TEXT,
  avatar_url TEXT,
  has_premium BOOLEAN,
  total_score BIGINT,
  tests_count BIGINT,
  rank BIGINT
) AS $$
  SELECT 
    qr.user_id,
    p.username,
    p.first_name,
    p.avatar_url,
    p.has_telegram_premium as has_premium,
    COALESCE(SUM(qr.score), 0)::BIGINT as total_score,
    COUNT(*)::BIGINT as tests_count,
    RANK() OVER (ORDER BY COALESCE(SUM(qr.score), 0) DESC) as rank
  FROM quiz_results qr
  JOIN profiles p ON p.id = qr.user_id
  GROUP BY qr.user_id, p.username, p.first_name, p.avatar_url, p.has_telegram_premium
  ORDER BY total_score DESC
  LIMIT limit_count;
$$ LANGUAGE sql STABLE;

-- ============================================
-- RPC Function for User Stats
-- ============================================

CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  target_user_id UUID;
  result JSON;
BEGIN
  -- Use provided user_id or fall back to auth.uid()
  target_user_id := COALESCE(p_user_id, auth.uid());
  
  IF target_user_id IS NULL THEN
    RETURN json_build_object(
      'best_score', 0,
      'tests_completed', 0,
      'global_rank', 0,
      'active_challenges', 0,
      'trophies', 0,
      'total_popcorns', 0
    );
  END IF;

  SELECT json_build_object(
    'best_score', COALESCE((
      SELECT MAX(score) FROM quiz_results WHERE user_id = target_user_id
    ), 0),
    'tests_completed', COALESCE((
      SELECT COUNT(*) FROM quiz_results WHERE user_id = target_user_id
    ), 0),
    'global_rank', COALESCE((
      SELECT rank FROM (
        SELECT user_id, RANK() OVER (ORDER BY COUNT(*) DESC) as rank 
        FROM quiz_results GROUP BY user_id
      ) r WHERE r.user_id = target_user_id
    ), 0),
    'active_challenges', COALESCE((
      SELECT COUNT(*) FROM challenges WHERE 
        (challenger_id = target_user_id OR challenged_id = target_user_id) 
        AND status = 'pending'
    ), 0),
    'challenge_wins', COALESCE((
      SELECT COUNT(*) FROM challenges WHERE 
        winner_id = target_user_id AND status = 'completed'
    ), 0),
    'trophies', 0,  -- TODO: implement trophy logic based on seasons
    'total_popcorns', COALESCE((
      SELECT SUM(like_count) FROM quizzes WHERE created_by = target_user_id AND status = 'published'
    ), 0)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_leaderboard_by_tests TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_leaderboard_by_challenges TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_leaderboard_by_popcorns TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_leaderboard_by_score TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_stats TO authenticated, anon;
