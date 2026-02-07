-- Squad member leaderboard (completions + popcorns given)
-- Note: quiz_results has RLS; we return only aggregated counts via SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.get_squad_member_leaderboard(
  p_squad_id UUID,
  p_limit INT DEFAULT 25
)
RETURNS TABLE (
  user_id UUID,
  telegram_id BIGINT,
  username TEXT,
  first_name TEXT,
  avatar_url TEXT,
  has_premium BOOLEAN,
  completed_count BIGINT,
  quiz_completed_count BIGINT,
  test_completed_count BIGINT,
  popcorns BIGINT,
  rank BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH members AS (
    SELECT
      p.id,
      p.telegram_id,
      p.username,
      p.first_name,
      p.avatar_url,
      p.has_telegram_premium
    FROM public.profiles p
    WHERE p.squad_id = p_squad_id
  ),
  quiz_done AS (
    SELECT qr.user_id, COUNT(*)::BIGINT AS cnt
    FROM public.quiz_results qr
    JOIN members m ON m.id = qr.user_id
    GROUP BY qr.user_id
  ),
  test_done AS (
    SELECT ptc.user_id, COUNT(*)::BIGINT AS cnt
    FROM public.personality_test_completions ptc
    JOIN members m ON m.id = ptc.user_id
    GROUP BY ptc.user_id
  ),
  quiz_likes AS (
    SELECT ql.user_id, COUNT(*)::BIGINT AS cnt
    FROM public.quiz_likes ql
    JOIN members m ON m.id = ql.user_id
    GROUP BY ql.user_id
  ),
  test_likes AS (
    SELECT ptl.user_id, COUNT(*)::BIGINT AS cnt
    FROM public.personality_test_likes ptl
    JOIN members m ON m.id = ptl.user_id
    GROUP BY ptl.user_id
  ),
  combined AS (
    SELECT
      m.id AS user_id,
      m.telegram_id,
      m.username,
      m.first_name,
      m.avatar_url,
      m.has_telegram_premium AS has_premium,
      COALESCE(qd.cnt, 0) AS quiz_completed_count,
      COALESCE(td.cnt, 0) AS test_completed_count,
      (COALESCE(qd.cnt, 0) + COALESCE(td.cnt, 0)) AS completed_count,
      (COALESCE(ql.cnt, 0) + COALESCE(tl.cnt, 0)) AS popcorns
    FROM members m
    LEFT JOIN quiz_done qd ON qd.user_id = m.id
    LEFT JOIN test_done td ON td.user_id = m.id
    LEFT JOIN quiz_likes ql ON ql.user_id = m.id
    LEFT JOIN test_likes tl ON tl.user_id = m.id
  )
  SELECT
    c.user_id,
    c.telegram_id,
    c.username,
    c.first_name,
    c.avatar_url,
    c.has_premium,
    c.completed_count,
    c.quiz_completed_count,
    c.test_completed_count,
    c.popcorns,
    ROW_NUMBER() OVER (ORDER BY c.popcorns DESC, c.completed_count DESC, c.user_id)::BIGINT AS rank
  FROM combined c
  ORDER BY c.popcorns DESC, c.completed_count DESC, c.user_id
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.get_squad_member_leaderboard(UUID, INT) TO authenticated, anon;

