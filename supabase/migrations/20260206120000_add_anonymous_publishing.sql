-- Add anonymous publishing flag to quizzes and personality tests
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.personality_tests
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false;

-- Public views with creator masking for anonymous content
CREATE OR REPLACE VIEW public.quizzes_public AS
SELECT
  q.id,
  q.title,
  q.description,
  q.image_url,
  CASE
    WHEN q.is_anonymous = true
      -- Important: auth.uid() can be NULL for anon viewers.
      -- Use COALESCE to avoid three-valued logic leaking created_by.
      AND NOT (COALESCE(q.created_by = auth.uid(), false) OR public.is_admin(auth.uid()))
      THEN NULL
    ELSE q.created_by
  END AS created_by,
  q.question_count,
  q.participant_count,
  q.duration_seconds,
  q.is_published,
  q.created_at,
  q.updated_at,
  q.rating,
  q.rating_count,
  q.like_count,
  q.save_count,
  q.status,
  q.rejection_reason,
  q.submitted_at,
  q.moderated_by,
  q.moderated_at,
  q.is_anonymous
FROM public.quizzes q;

CREATE OR REPLACE VIEW public.personality_tests_public AS
SELECT
  pt.id,
  pt.title,
  pt.description,
  pt.image_url,
  CASE
    WHEN pt.is_anonymous = true
      -- Important: auth.uid() can be NULL for anon viewers.
      -- Use COALESCE to avoid three-valued logic leaking created_by.
      AND NOT (COALESCE(pt.created_by = auth.uid(), false) OR public.is_admin(auth.uid()))
      THEN NULL
    ELSE pt.created_by
  END AS created_by,
  pt.question_count,
  pt.result_count,
  pt.participant_count,
  pt.like_count,
  pt.save_count,
  pt.is_published,
  pt.created_at,
  pt.updated_at,
  pt.is_anonymous
FROM public.personality_tests pt;

GRANT SELECT ON public.quizzes_public TO anon, authenticated;
GRANT SELECT ON public.personality_tests_public TO anon, authenticated;

-- Update leaderboard function to exclude anonymous content
CREATE OR REPLACE FUNCTION public.get_leaderboard_by_popcorns(limit_count INT DEFAULT 100)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  first_name TEXT,
  avatar_url TEXT,
  has_premium BOOLEAN,
  total_popcorns BIGINT,
  quiz_count BIGINT,
  popcorns BIGINT,
  rank BIGINT
) AS $$
  WITH creator_stats AS (
    -- Quiz creators
    SELECT 
      q.created_by as creator_id,
      COALESCE(SUM(q.like_count), 0) as likes,
      COUNT(*) as content_count
    FROM quizzes q
    WHERE (q.status = 'published' OR q.is_published = true)
      AND q.created_by IS NOT NULL
      AND COALESCE(q.is_anonymous, false) = false
    GROUP BY q.created_by
    
    UNION ALL
    
    -- Personality test creators
    SELECT 
      pt.created_by as creator_id,
      COALESCE(SUM(pt.like_count), 0) as likes,
      COUNT(*) as content_count
    FROM personality_tests pt
    WHERE pt.is_published = true
      AND pt.created_by IS NOT NULL
      AND COALESCE(pt.is_anonymous, false) = false
    GROUP BY pt.created_by
  ),
  aggregated AS (
    SELECT 
      creator_id,
      SUM(likes)::BIGINT as total_likes,
      SUM(content_count)::BIGINT as total_content
    FROM creator_stats
    GROUP BY creator_id
  )
  SELECT 
    a.creator_id as user_id,
    p.username,
    p.first_name,
    p.avatar_url,
    p.has_telegram_premium as has_premium,
    a.total_likes as total_popcorns,
    a.total_content as quiz_count,
    a.total_likes as popcorns,
    ROW_NUMBER() OVER (ORDER BY a.total_likes DESC, a.total_content DESC) as rank
  FROM aggregated a
  JOIN profiles p ON p.id = a.creator_id
  ORDER BY total_popcorns DESC, quiz_count DESC
  LIMIT limit_count;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.get_leaderboard_by_popcorns TO authenticated, anon;

-- Ensure PostgREST refreshes schema cache (prevents "schema cache" errors after DDL).
NOTIFY pgrst, 'reload schema';
