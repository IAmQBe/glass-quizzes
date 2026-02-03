-- Fix leaderboard functions

-- 1. Fix creators leaderboard - include ALL creators with published content (even with 0 likes)
-- Also include personality tests
CREATE OR REPLACE FUNCTION get_leaderboard_by_popcorns(limit_count INT DEFAULT 100)
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
    WHERE q.status = 'published' AND q.created_by IS NOT NULL
    GROUP BY q.created_by
    
    UNION ALL
    
    -- Personality test creators
    SELECT 
      pt.created_by as creator_id,
      COALESCE(SUM(pt.like_count), 0) as likes,
      COUNT(*) as content_count
    FROM personality_tests pt
    WHERE pt.status = 'published' AND pt.created_by IS NOT NULL
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

-- 2. Fix squad leaderboard - also show squads with 0 popcorns
CREATE OR REPLACE FUNCTION public.get_squad_leaderboard(p_limit INT DEFAULT 10)
RETURNS TABLE (
    id UUID,
    title TEXT,
    username TEXT,
    avatar_url TEXT,
    member_count INT,
    total_popcorns INT,
    invite_link TEXT,
    rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.title,
        s.username,
        s.avatar_url,
        s.member_count,
        s.total_popcorns,
        s.invite_link,
        ROW_NUMBER() OVER (ORDER BY s.total_popcorns DESC, s.member_count DESC)::BIGINT as rank
    FROM squads s
    WHERE s.is_active = true
    ORDER BY s.total_popcorns DESC, s.member_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_leaderboard_by_popcorns TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_squad_leaderboard TO authenticated, anon;

-- 3. Update squad member count when user joins/leaves
CREATE OR REPLACE FUNCTION public.update_squad_member_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update old squad member count (if leaving)
    IF OLD.squad_id IS NOT NULL AND (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        UPDATE squads SET member_count = (
            SELECT COUNT(*) FROM profiles WHERE squad_id = OLD.squad_id
        ) WHERE id = OLD.squad_id;
    END IF;
    
    -- Update new squad member count (if joining)
    IF NEW.squad_id IS NOT NULL AND (TG_OP = 'UPDATE' OR TG_OP = 'INSERT') THEN
        UPDATE squads SET member_count = (
            SELECT COUNT(*) FROM profiles WHERE squad_id = NEW.squad_id
        ) WHERE id = NEW.squad_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for squad member count
DROP TRIGGER IF EXISTS trigger_update_squad_member_count ON profiles;
CREATE TRIGGER trigger_update_squad_member_count
AFTER INSERT OR UPDATE OF squad_id OR DELETE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_squad_member_count();
