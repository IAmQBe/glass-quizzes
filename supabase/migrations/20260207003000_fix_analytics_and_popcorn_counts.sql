-- Fix: consistent popcorn counts + reliable analytics sources.
-- 1) Maintain personality_tests.like_count via triggers (matches quiz like_count behavior).
-- 2) Maintain squads.total_popcorns (was never updated, causing 0 in leaderboards/screens).
-- 3) Update legacy analytics RPCs to use user_events + correct quiz_results columns.
-- 4) Patch Analytics+ admin RPCs to avoid overriding user_events with legacy shares/events,
--    and to expose missing KPIs (published quizzes/tests + avg test completion time).

-- ---------------------------------------------------------------------------
-- 1) Personality test likes -> personality_tests.like_count
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_personality_test_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.personality_tests
    SET like_count = like_count + 1
    WHERE id = NEW.test_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.personality_tests
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = OLD.test_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.personality_test_likes') IS NOT NULL
     AND to_regclass('public.personality_tests') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS update_personality_test_likes_count ON public.personality_test_likes;
    CREATE TRIGGER update_personality_test_likes_count
    AFTER INSERT OR DELETE ON public.personality_test_likes
    FOR EACH ROW EXECUTE FUNCTION public.update_personality_test_like_count();
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Squads popcorn cache (likes given by current squad members)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_profiles_squad_id ON public.profiles(squad_id)';
  END IF;

  IF to_regclass('public.quiz_likes') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_quiz_likes_user_id ON public.quiz_likes(user_id)';
  END IF;

  IF to_regclass('public.personality_test_likes') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_personality_test_likes_user_id ON public.personality_test_likes(user_id)';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.recalculate_squad_total_popcorns(UUID);
CREATE OR REPLACE FUNCTION public.recalculate_squad_total_popcorns(p_squad_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quiz_likes BIGINT := 0;
  v_test_likes BIGINT := 0;
BEGIN
  IF p_squad_id IS NULL OR to_regclass('public.squads') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.quiz_likes') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_quiz_likes
    FROM public.quiz_likes ql
    JOIN public.profiles p ON p.id = ql.user_id
    WHERE p.squad_id = p_squad_id;
  END IF;

  IF to_regclass('public.personality_test_likes') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_test_likes
    FROM public.personality_test_likes ptl
    JOIN public.profiles p ON p.id = ptl.user_id
    WHERE p.squad_id = p_squad_id;
  END IF;

  UPDATE public.squads s
  SET total_popcorns = (COALESCE(v_quiz_likes, 0) + COALESCE(v_test_likes, 0))::INT,
      updated_at = now()
  WHERE s.id = p_squad_id;
END;
$$;

DROP FUNCTION IF EXISTS public.recalculate_squad_popcorns_on_quiz_like();
CREATE OR REPLACE FUNCTION public.recalculate_squad_popcorns_on_quiz_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_squad_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.squad_id
  INTO v_squad_id
  FROM public.profiles p
  WHERE p.id = v_user_id;

  PERFORM public.recalculate_squad_total_popcorns(v_squad_id);
  RETURN NULL;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.quiz_likes') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trigger_recalculate_squad_popcorns_on_quiz_like ON public.quiz_likes;
    CREATE TRIGGER trigger_recalculate_squad_popcorns_on_quiz_like
    AFTER INSERT OR DELETE ON public.quiz_likes
    FOR EACH ROW EXECUTE FUNCTION public.recalculate_squad_popcorns_on_quiz_like();
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.recalculate_squad_popcorns_on_test_like();
CREATE OR REPLACE FUNCTION public.recalculate_squad_popcorns_on_test_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_squad_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.squad_id
  INTO v_squad_id
  FROM public.profiles p
  WHERE p.id = v_user_id;

  PERFORM public.recalculate_squad_total_popcorns(v_squad_id);
  RETURN NULL;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.personality_test_likes') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trigger_recalculate_squad_popcorns_on_test_like ON public.personality_test_likes;
    CREATE TRIGGER trigger_recalculate_squad_popcorns_on_test_like
    AFTER INSERT OR DELETE ON public.personality_test_likes
    FOR EACH ROW EXECUTE FUNCTION public.recalculate_squad_popcorns_on_test_like();
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.recalculate_squad_popcorns_on_profile_squad_change();
CREATE OR REPLACE FUNCTION public.recalculate_squad_popcorns_on_profile_squad_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.squad_id IS DISTINCT FROM NEW.squad_id) THEN
    PERFORM public.recalculate_squad_total_popcorns(OLD.squad_id);
    PERFORM public.recalculate_squad_total_popcorns(NEW.squad_id);
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trigger_recalculate_squad_popcorns_on_profile_squad_change ON public.profiles;
    CREATE TRIGGER trigger_recalculate_squad_popcorns_on_profile_squad_change
    AFTER UPDATE OF squad_id ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.recalculate_squad_popcorns_on_profile_squad_change();
  END IF;
END;
$$;

-- Backfill all squads once so UI/leaderboards stop showing 0.
DO $$
DECLARE
  v_squad_id UUID;
BEGIN
  IF to_regclass('public.squads') IS NULL THEN
    RETURN;
  END IF;

  FOR v_squad_id IN SELECT id FROM public.squads LOOP
    PERFORM public.recalculate_squad_total_popcorns(v_squad_id);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Legacy analytics RPCs: move to user_events + fix quiz_results.completed_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dau()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result INTEGER := 0;
BEGIN
  IF to_regclass('public.user_events') IS NOT NULL THEN
    SELECT COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text))::INT
    INTO v_result
    FROM public.user_events ue
    WHERE ue.created_at >= CURRENT_DATE;
  END IF;

  IF COALESCE(v_result, 0) = 0 AND to_regclass('public.events') IS NOT NULL THEN
    SELECT COUNT(DISTINCT e.user_id)::INT
    INTO v_result
    FROM public.events e
    WHERE e.created_at >= CURRENT_DATE
      AND e.user_id IS NOT NULL;
  END IF;

  IF COALESCE(v_result, 0) = 0 AND to_regclass('public.profiles') IS NOT NULL THEN
    SELECT COUNT(*)::INT
    INTO v_result
    FROM public.profiles p
    WHERE p.last_seen_at >= CURRENT_DATE
       OR p.updated_at >= CURRENT_DATE;
  END IF;

  RETURN COALESCE(v_result, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_wau()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result INTEGER := 0;
BEGIN
  IF to_regclass('public.user_events') IS NOT NULL THEN
    SELECT COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text))::INT
    INTO v_result
    FROM public.user_events ue
    WHERE ue.created_at >= (CURRENT_DATE - INTERVAL '7 days');
  END IF;

  IF COALESCE(v_result, 0) = 0 AND to_regclass('public.events') IS NOT NULL THEN
    SELECT COUNT(DISTINCT e.user_id)::INT
    INTO v_result
    FROM public.events e
    WHERE e.created_at >= (CURRENT_DATE - INTERVAL '7 days')
      AND e.user_id IS NOT NULL;
  END IF;

  IF COALESCE(v_result, 0) = 0 AND to_regclass('public.profiles') IS NOT NULL THEN
    SELECT COUNT(*)::INT
    INTO v_result
    FROM public.profiles p
    WHERE p.last_seen_at >= (CURRENT_DATE - INTERVAL '7 days')
       OR p.updated_at >= (CURRENT_DATE - INTERVAL '7 days');
  END IF;

  RETURN COALESCE(v_result, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_mau()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result INTEGER := 0;
BEGIN
  IF to_regclass('public.user_events') IS NOT NULL THEN
    SELECT COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text))::INT
    INTO v_result
    FROM public.user_events ue
    WHERE ue.created_at >= (CURRENT_DATE - INTERVAL '30 days');
  END IF;

  IF COALESCE(v_result, 0) = 0 AND to_regclass('public.events') IS NOT NULL THEN
    SELECT COUNT(DISTINCT e.user_id)::INT
    INTO v_result
    FROM public.events e
    WHERE e.created_at >= (CURRENT_DATE - INTERVAL '30 days')
      AND e.user_id IS NOT NULL;
  END IF;

  IF COALESCE(v_result, 0) = 0 AND to_regclass('public.profiles') IS NOT NULL THEN
    SELECT COUNT(*)::INT
    INTO v_result
    FROM public.profiles p
    WHERE p.last_seen_at >= (CURRENT_DATE - INTERVAL '30 days')
       OR p.updated_at >= (CURRENT_DATE - INTERVAL '30 days')
       OR p.created_at >= (CURRENT_DATE - INTERVAL '30 days');
  END IF;

  RETURN COALESCE(v_result, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_total_shares()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result INTEGER := 0;
BEGIN
  IF to_regclass('public.user_events') IS NOT NULL THEN
    SELECT COUNT(*)::INT
    INTO v_result
    FROM public.user_events ue
    WHERE ue.event_type IN ('quiz_share', 'test_share');
  END IF;

  IF COALESCE(v_result, 0) = 0 AND to_regclass('public.shares') IS NOT NULL THEN
    SELECT COUNT(*)::INT
    INTO v_result
    FROM public.shares s;
  END IF;

  RETURN COALESCE(v_result, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_quiz_funnel(
  from_date DATE DEFAULT (CURRENT_DATE - 7),
  to_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(viewed BIGINT, started BIGINT, completed BIGINT, shared BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewed BIGINT := 0;
  v_started BIGINT := 0;
  v_completed BIGINT := 0;
  v_shared BIGINT := 0;
  v_from_ts TIMESTAMPTZ := from_date::timestamptz;
  v_to_ts TIMESTAMPTZ := (to_date::timestamptz + interval '1 day');
BEGIN
  IF to_regclass('public.user_events') IS NOT NULL THEN
    SELECT
      COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'quiz_view'),
      COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'quiz_start'),
      COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type IN ('quiz_complete', 'quiz_completed')),
      COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'quiz_share')
    INTO v_viewed, v_started, v_completed, v_shared
    FROM public.user_events ue
    WHERE ue.created_at >= v_from_ts
      AND ue.created_at < v_to_ts;
  ELSIF to_regclass('public.events') IS NOT NULL THEN
    SELECT
      COUNT(DISTINCT e.user_id) FILTER (WHERE e.event_type IN ('quiz_view', 'quiz_viewed')),
      COUNT(DISTINCT e.user_id) FILTER (WHERE e.event_type IN ('quiz_start', 'quiz_started')),
      COUNT(DISTINCT e.user_id) FILTER (WHERE e.event_type IN ('quiz_complete', 'quiz_completed')),
      COUNT(DISTINCT e.user_id) FILTER (WHERE e.event_type IN ('quiz_share', 'share_clicked'))
    INTO v_viewed, v_started, v_completed, v_shared
    FROM public.events e
    WHERE e.created_at >= v_from_ts
      AND e.created_at < v_to_ts;
  END IF;

  IF to_regclass('public.quiz_results') IS NOT NULL THEN
    SELECT COUNT(DISTINCT qr.user_id)
    INTO v_completed
    FROM public.quiz_results qr
    WHERE qr.completed_at >= v_from_ts
      AND qr.completed_at < v_to_ts;
  END IF;

  IF v_shared = 0 AND to_regclass('public.shares') IS NOT NULL THEN
    SELECT COUNT(DISTINCT s.user_id)
    INTO v_shared
    FROM public.shares s
    WHERE COALESCE(s.created_at, s.shared_at) >= v_from_ts
      AND COALESCE(s.created_at, s.shared_at) < v_to_ts
      AND COALESCE(s.content_type, 'quiz') = 'quiz';
  END IF;

  RETURN QUERY SELECT v_viewed, v_started, v_completed, v_shared;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_avg_completion_time()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result NUMERIC := NULL;
BEGIN
  -- Prefer persisted quiz_results.time_taken_seconds if it exists and has values.
  IF to_regclass('public.quiz_results') IS NOT NULL
     AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'quiz_results'
        AND column_name = 'time_taken_seconds'
    ) THEN
    SELECT AVG(qr.time_taken_seconds)
    INTO v_result
    FROM public.quiz_results qr
    WHERE qr.time_taken_seconds IS NOT NULL
      AND qr.time_taken_seconds > 0
      AND qr.time_taken_seconds < 600;
  END IF;

  -- Fallback to telemetry time_total_ms.
  IF (v_result IS NULL OR v_result = 0)
     AND to_regclass('public.user_events') IS NOT NULL THEN
    SELECT AVG(((ue.event_data->>'time_total_ms')::numeric) / 1000.0)
    INTO v_result
    FROM public.user_events ue
    WHERE ue.event_type IN ('quiz_complete', 'quiz_completed')
      AND ue.event_data ? 'time_total_ms'
      AND ((ue.event_data->>'time_total_ms')::numeric) > 0
      AND ((ue.event_data->>'time_total_ms')::numeric) < 600000;
  END IF;

  RETURN COALESCE(ROUND(v_result)::INT, 60);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_top_quizzes_by_completions(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(quiz_id UUID, title TEXT, completions BIGINT, shares BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH published_quizzes AS (
    SELECT q.id, q.title
    FROM public.quizzes q
    WHERE (q.status = 'published' OR q.is_published = true)
  ),
  completion_counts AS (
    SELECT qr.quiz_id, COUNT(*)::BIGINT AS completions
    FROM public.quiz_results qr
    GROUP BY qr.quiz_id
  ),
  share_counts AS (
    SELECT ue.quiz_id, COUNT(*)::BIGINT AS shares
    FROM public.user_events ue
    WHERE ue.event_type = 'quiz_share'
      AND ue.quiz_id IS NOT NULL
    GROUP BY ue.quiz_id
  )
  SELECT
    pq.id AS quiz_id,
    pq.title::TEXT AS title,
    COALESCE(cc.completions, 0)::BIGINT AS completions,
    COALESCE(sc.shares, 0)::BIGINT AS shares
  FROM published_quizzes pq
  LEFT JOIN completion_counts cc ON cc.quiz_id = pq.id
  LEFT JOIN share_counts sc ON sc.quiz_id = pq.id
  ORDER BY completions DESC, shares DESC
  LIMIT limit_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_sources(days_back INTEGER DEFAULT 30)
RETURNS TABLE(source TEXT, user_count BIGINT, percentage NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_users BIGINT := 0;
BEGIN
  SELECT COUNT(*) INTO v_total_users
  FROM public.profiles p
  WHERE p.created_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL;

  IF v_total_users = 0 THEN
    v_total_users := 1;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(
      NULLIF(p.referral_source, ''),
      NULLIF(to_jsonb(p)->>'source', ''),
      'direct'
    )::TEXT AS source,
    COUNT(*)::BIGINT AS user_count,
    ROUND((COUNT(*)::NUMERIC / v_total_users) * 100, 1) AS percentage
  FROM public.profiles p
  WHERE p.created_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL
  GROUP BY 1
  ORDER BY user_count DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_users_by_period(days_back INT DEFAULT 30)
RETURNS TABLE(event_date DATE, unique_users BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.user_events') IS NOT NULL THEN
    RETURN QUERY
    SELECT
      ue.event_date,
      COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text))::BIGINT AS unique_users
    FROM public.user_events ue
    WHERE ue.event_date >= CURRENT_DATE - days_back
    GROUP BY ue.event_date
    ORDER BY ue.event_date;
    RETURN;
  END IF;

  IF to_regclass('public.events') IS NOT NULL THEN
    RETURN QUERY
    SELECT
      DATE(e.created_at) AS event_date,
      COUNT(DISTINCT e.user_id)::BIGINT AS unique_users
    FROM public.events e
    WHERE e.created_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL
      AND e.user_id IS NOT NULL
    GROUP BY DATE(e.created_at)
    ORDER BY event_date;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dau() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_wau() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_mau() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_total_shares() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_funnel(DATE, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_avg_completion_time() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_quizzes_by_completions(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_sources(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_users_by_period(INTEGER) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Analytics+ admin RPC fixes: shares fallback + avg test time + content counts
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_analytics_require_admin();
CREATE OR REPLACE FUNCTION public.admin_analytics_require_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_any_admin_exists BOOLEAN := false;
BEGIN
  -- If no admins exist yet, bootstrap first caller as admin (dev-friendly).
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles ur WHERE ur.role = 'admin'
  ) INTO v_any_admin_exists;

  IF NOT v_any_admin_exists AND auth.uid() IS NOT NULL THEN
    BEGIN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (auth.uid(), 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;

  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin_only'
      USING ERRCODE = '42501',
            MESSAGE = 'Admin access required';
  END IF;
END;
$$;

-- Overview: add published quiz/test counts + avg test time, and avoid overwriting user_events shares.
DROP FUNCTION IF EXISTS public.admin_analytics_overview(TIMESTAMPTZ, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION public.admin_analytics_overview(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS TABLE (
  dau BIGINT,
  wau BIGINT,
  mau BIGINT,
  stickiness_pct NUMERIC,
  total_users BIGINT,
  new_users BIGINT,
  referrals BIGINT,
  published_quizzes BIGINT,
  published_tests BIGINT,
  quiz_views BIGINT,
  quiz_starts BIGINT,
  quiz_completes BIGINT,
  quiz_shares BIGINT,
  test_views BIGINT,
  test_starts BIGINT,
  test_completes BIGINT,
  test_shares BIGINT,
  avg_quiz_time_seconds NUMERIC,
  avg_test_time_seconds NUMERIC,
  avg_quiz_score_pct NUMERIC,
  prediction_created BIGINT,
  prediction_pending BIGINT,
  prediction_under_review BIGINT,
  prediction_resolved BIGINT,
  prediction_reports BIGINT,
  task_completions BIGINT,
  unique_task_completers BIGINT,
  error_events BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reference_date DATE := ((p_to AT TIME ZONE 'UTC')::date - 1);
  v_dau BIGINT := 0;
  v_wau BIGINT := 0;
  v_mau BIGINT := 0;
  v_total_users BIGINT := 0;
  v_new_users BIGINT := 0;
  v_referrals BIGINT := 0;
  v_published_quizzes BIGINT := 0;
  v_published_tests BIGINT := 0;
  v_quiz_views BIGINT := 0;
  v_quiz_starts BIGINT := 0;
  v_quiz_completes BIGINT := 0;
  v_quiz_shares BIGINT := 0;
  v_test_views BIGINT := 0;
  v_test_starts BIGINT := 0;
  v_test_completes BIGINT := 0;
  v_test_shares BIGINT := 0;
  v_avg_quiz_time_seconds NUMERIC := 0;
  v_avg_test_time_seconds NUMERIC := 0;
  v_avg_quiz_score_pct NUMERIC := 0;
  v_avg_quiz_time_results NUMERIC := NULL;
  v_prediction_created BIGINT := 0;
  v_prediction_pending BIGINT := 0;
  v_prediction_under_review BIGINT := 0;
  v_prediction_resolved BIGINT := 0;
  v_prediction_reports BIGINT := 0;
  v_task_completions BIGINT := 0;
  v_unique_task_completers BIGINT := 0;
  v_error_events BIGINT := 0;
BEGIN
  PERFORM public.admin_analytics_require_admin();

  IF to_regclass('public.user_events') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text))
      FROM public.user_events ue
      WHERE ue.created_at::date = $1
    $sql$ INTO v_dau USING v_reference_date;

    EXECUTE $sql$
      SELECT COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text))
      FROM public.user_events ue
      WHERE ue.created_at::date >= ($1 - 6)
        AND ue.created_at::date <= $1
    $sql$ INTO v_wau USING v_reference_date;

    EXECUTE $sql$
      SELECT COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text))
      FROM public.user_events ue
      WHERE ue.created_at::date >= ($1 - 29)
        AND ue.created_at::date <= $1
    $sql$ INTO v_mau USING v_reference_date;

    EXECUTE $sql$
      SELECT
        COUNT(*) FILTER (WHERE ue.event_type = 'quiz_view') AS quiz_views,
        COUNT(*) FILTER (WHERE ue.event_type = 'quiz_start') AS quiz_starts,
        COUNT(*) FILTER (WHERE ue.event_type IN ('quiz_complete', 'quiz_completed')) AS quiz_completes,
        COUNT(*) FILTER (WHERE ue.event_type = 'quiz_share') AS quiz_shares,
        COUNT(*) FILTER (WHERE ue.event_type = 'test_view') AS test_views,
        COUNT(*) FILTER (WHERE ue.event_type = 'test_start') AS test_starts,
        COUNT(*) FILTER (WHERE ue.event_type = 'test_complete') AS test_completes,
        COUNT(*) FILTER (WHERE ue.event_type = 'test_share') AS test_shares,
        COUNT(*) FILTER (WHERE ue.event_type = 'error') AS error_events,
        AVG(((ue.event_data->>'time_total_ms')::numeric) / 1000.0)
          FILTER (
            WHERE ue.event_type IN ('quiz_complete', 'quiz_completed')
              AND ue.event_data ? 'time_total_ms'
              AND ((ue.event_data->>'time_total_ms')::numeric) > 0
              AND ((ue.event_data->>'time_total_ms')::numeric) < 3600000
          ) AS avg_quiz_time,
        AVG(
          CASE
            WHEN (ue.event_data->>'max_score')::numeric > 0
              THEN ((ue.event_data->>'score')::numeric / NULLIF((ue.event_data->>'max_score')::numeric, 0)) * 100
            ELSE NULL
          END
        ) FILTER (
          WHERE ue.event_type IN ('quiz_complete', 'quiz_completed')
            AND ue.event_data ? 'score'
            AND ue.event_data ? 'max_score'
        ) AS avg_quiz_score,
        AVG(((ue.event_data->>'time_total_ms')::numeric) / 1000.0)
          FILTER (
            WHERE ue.event_type = 'test_complete'
              AND ue.event_data ? 'time_total_ms'
              AND ((ue.event_data->>'time_total_ms')::numeric) > 0
              AND ((ue.event_data->>'time_total_ms')::numeric) < 3600000
          ) AS avg_test_time
      FROM public.user_events ue
      WHERE ue.created_at >= $1
        AND ue.created_at < $2
    $sql$
    INTO
      v_quiz_views,
      v_quiz_starts,
      v_quiz_completes,
      v_quiz_shares,
      v_test_views,
      v_test_starts,
      v_test_completes,
      v_test_shares,
      v_error_events,
      v_avg_quiz_time_seconds,
      v_avg_quiz_score_pct,
      v_avg_test_time_seconds
    USING p_from, p_to;

    -- If avg test time isn't embedded yet, estimate from start->complete deltas within the same session.
    IF COALESCE(v_avg_test_time_seconds, 0) = 0 THEN
      EXECUTE $sql$
        WITH starts AS (
          SELECT
            COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text) AS actor,
            (ue.event_data->>'test_id')::uuid AS test_id,
            ue.session_id,
            MIN(ue.created_at) AS started_at
          FROM public.user_events ue
          WHERE ue.created_at >= $1
            AND ue.created_at < $2
            AND ue.event_type = 'test_start'
            AND ue.event_data ? 'test_id'
          GROUP BY 1, 2, 3
        ),
        completes AS (
          SELECT
            COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text) AS actor,
            (ue.event_data->>'test_id')::uuid AS test_id,
            ue.session_id,
            MIN(ue.created_at) AS completed_at
          FROM public.user_events ue
          WHERE ue.created_at >= $1
            AND ue.created_at < $2
            AND ue.event_type = 'test_complete'
            AND ue.event_data ? 'test_id'
          GROUP BY 1, 2, 3
        ),
        paired AS (
          SELECT
            EXTRACT(EPOCH FROM (c.completed_at - s.started_at)) AS seconds
          FROM completes c
          JOIN starts s
            ON s.actor = c.actor
           AND s.test_id = c.test_id
           AND (s.session_id IS NOT DISTINCT FROM c.session_id)
          WHERE c.completed_at >= s.started_at
        )
        SELECT AVG(seconds)
        FROM paired
        WHERE seconds > 0 AND seconds < 3600
      $sql$ INTO v_avg_test_time_seconds USING p_from, p_to;
    END IF;
  ELSIF to_regclass('public.events') IS NOT NULL THEN
    SELECT
      COUNT(*) FILTER (WHERE e.event_type IN ('quiz_view', 'quiz_viewed')),
      COUNT(*) FILTER (WHERE e.event_type IN ('quiz_start', 'quiz_started')),
      COUNT(*) FILTER (WHERE e.event_type IN ('quiz_complete', 'quiz_completed')),
      COUNT(*) FILTER (WHERE e.event_type IN ('quiz_share', 'share_clicked')),
      COUNT(*) FILTER (WHERE e.event_type = 'error')
    INTO
      v_quiz_views,
      v_quiz_starts,
      v_quiz_completes,
      v_quiz_shares,
      v_error_events
    FROM public.events e
    WHERE e.created_at >= p_from
      AND e.created_at < p_to;

    SELECT COALESCE(COUNT(DISTINCT e.user_id), 0)
      INTO v_dau
    FROM public.events e
    WHERE e.created_at::date = v_reference_date;

    SELECT COALESCE(COUNT(DISTINCT e.user_id), 0)
      INTO v_wau
    FROM public.events e
    WHERE e.created_at::date >= (v_reference_date - 6)
      AND e.created_at::date <= v_reference_date;

    SELECT COALESCE(COUNT(DISTINCT e.user_id), 0)
      INTO v_mau
    FROM public.events e
    WHERE e.created_at::date >= (v_reference_date - 29)
      AND e.created_at::date <= v_reference_date;
  END IF;

  IF to_regclass('public.quizzes') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_published_quizzes
    FROM public.quizzes q
    WHERE (q.status = 'published' OR q.is_published = true);
  END IF;

  IF to_regclass('public.personality_tests') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_published_tests
    FROM public.personality_tests pt
    WHERE pt.is_published = true;
  END IF;

  IF to_regclass('public.quiz_results') IS NOT NULL THEN
    SELECT COUNT(*),
           AVG((qr.score::numeric / NULLIF(qr.max_score::numeric, 0)) * 100)
    INTO v_quiz_completes, v_avg_quiz_score_pct
    FROM public.quiz_results qr
    WHERE qr.completed_at >= p_from
      AND qr.completed_at < p_to;

    -- Prefer persisted time_taken_seconds when present and populated.
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'quiz_results'
        AND column_name = 'time_taken_seconds'
    ) THEN
      EXECUTE $sql$
        SELECT AVG(qr.time_taken_seconds::numeric)
        FROM public.quiz_results qr
        WHERE qr.completed_at >= $1
          AND qr.completed_at < $2
          AND qr.time_taken_seconds IS NOT NULL
          AND qr.time_taken_seconds > 0
          AND qr.time_taken_seconds < 3600
      $sql$
      INTO v_avg_quiz_time_results
      USING p_from, p_to;

      IF v_avg_quiz_time_results IS NOT NULL AND v_avg_quiz_time_results > 0 THEN
        v_avg_quiz_time_seconds := v_avg_quiz_time_results;
      END IF;
    END IF;
  END IF;

  IF to_regclass('public.personality_test_completions') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_test_completes
    FROM public.personality_test_completions ptc
    WHERE ptc.completed_at >= p_from
      AND ptc.completed_at < p_to;
  ELSIF to_regclass('public.user_personality_results') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_test_completes
    FROM public.user_personality_results upr
    WHERE upr.completed_at >= p_from
      AND upr.completed_at < p_to;
  END IF;

  -- Shares table is legacy fallback (new client tracks shares via user_events).
  IF (COALESCE(v_quiz_shares, 0) = 0 OR COALESCE(v_test_shares, 0) = 0)
     AND to_regclass('public.shares') IS NOT NULL THEN
    SELECT
      COUNT(*) FILTER (WHERE COALESCE(s.content_type, 'quiz') = 'quiz'),
      COUNT(*) FILTER (WHERE COALESCE(s.content_type, 'quiz') = 'personality_test')
    INTO v_quiz_shares, v_test_shares
    FROM public.shares s
    WHERE COALESCE(s.created_at, s.shared_at) >= p_from
      AND COALESCE(s.created_at, s.shared_at) < p_to;
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_total_users FROM public.profiles;
    SELECT COUNT(*)
    INTO v_new_users
    FROM public.profiles p
    WHERE p.created_at >= p_from
      AND p.created_at < p_to;
  END IF;

  IF to_regclass('public.referrals') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_referrals
    FROM public.referrals r
    WHERE r.created_at >= p_from
      AND r.created_at < p_to;
  END IF;

  IF to_regclass('public.prediction_polls') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_prediction_created
    FROM public.prediction_polls pp
    WHERE pp.created_at >= p_from
      AND pp.created_at < p_to;

    SELECT COUNT(*) INTO v_prediction_pending FROM public.prediction_polls WHERE status = 'pending';
    SELECT COUNT(*) INTO v_prediction_under_review FROM public.prediction_polls WHERE status = 'under_review';
    SELECT COUNT(*) INTO v_prediction_resolved FROM public.prediction_polls WHERE status = 'resolved';
  END IF;

  IF to_regclass('public.prediction_reports') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_prediction_reports
    FROM public.prediction_reports pr
    WHERE pr.created_at >= p_from
      AND pr.created_at < p_to;
  END IF;

  IF to_regclass('public.user_tasks') IS NOT NULL THEN
    SELECT COUNT(*), COUNT(DISTINCT ut.user_id)
    INTO v_task_completions, v_unique_task_completers
    FROM public.user_tasks ut
    WHERE ut.completed_at >= p_from
      AND ut.completed_at < p_to;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(v_dau, 0),
    COALESCE(v_wau, 0),
    COALESCE(v_mau, 0),
    CASE WHEN COALESCE(v_mau, 0) > 0 THEN ROUND((v_dau::numeric / v_mau::numeric) * 100, 1) ELSE 0 END,
    COALESCE(v_total_users, 0),
    COALESCE(v_new_users, 0),
    COALESCE(v_referrals, 0),
    COALESCE(v_published_quizzes, 0),
    COALESCE(v_published_tests, 0),
    COALESCE(v_quiz_views, 0),
    COALESCE(v_quiz_starts, 0),
    COALESCE(v_quiz_completes, 0),
    COALESCE(v_quiz_shares, 0),
    COALESCE(v_test_views, 0),
    COALESCE(v_test_starts, 0),
    COALESCE(v_test_completes, 0),
    COALESCE(v_test_shares, 0),
    ROUND(COALESCE(v_avg_quiz_time_seconds, 0), 1),
    ROUND(COALESCE(v_avg_test_time_seconds, 0), 1),
    ROUND(COALESCE(v_avg_quiz_score_pct, 0), 1),
    COALESCE(v_prediction_created, 0),
    COALESCE(v_prediction_pending, 0),
    COALESCE(v_prediction_under_review, 0),
    COALESCE(v_prediction_resolved, 0),
    COALESCE(v_prediction_reports, 0),
    COALESCE(v_task_completions, 0),
    COALESCE(v_unique_task_completers, 0),
    COALESCE(v_error_events, 0);
END;
$$;

-- Timeseries: don't overwrite share counts from user_events with legacy shares table unless needed.
DROP FUNCTION IF EXISTS public.admin_analytics_timeseries(DATE, DATE);
CREATE OR REPLACE FUNCTION public.admin_analytics_timeseries(
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (
  metric_date DATE,
  dau BIGINT,
  quiz_completes BIGINT,
  test_completes BIGINT,
  shares BIGINT,
  prediction_reports BIGINT,
  task_completions BIGINT,
  error_events BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day DATE;
  v_has_user_events BOOLEAN := to_regclass('public.user_events') IS NOT NULL;
  v_share_fallback BIGINT := 0;
BEGIN
  PERFORM public.admin_analytics_require_admin();

  FOR v_day IN
    SELECT gs::date
    FROM generate_series(p_from, p_to, interval '1 day') gs
  LOOP
    metric_date := v_day;
    dau := 0;
    quiz_completes := 0;
    test_completes := 0;
    shares := 0;
    prediction_reports := 0;
    task_completions := 0;
    error_events := 0;

    IF v_has_user_events THEN
      EXECUTE $sql$
        SELECT
          COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) AS dau,
          COUNT(*) FILTER (WHERE ue.event_type IN ('quiz_complete', 'quiz_completed')) AS quiz_completes,
          COUNT(*) FILTER (WHERE ue.event_type = 'test_complete') AS test_completes,
          COUNT(*) FILTER (WHERE ue.event_type IN ('quiz_share', 'test_share')) AS shares,
          COUNT(*) FILTER (WHERE ue.event_type = 'error') AS error_events
        FROM public.user_events ue
        WHERE ue.created_at >= $1
          AND ue.created_at < ($1 + interval '1 day')
      $sql$
      INTO dau, quiz_completes, test_completes, shares, error_events
      USING v_day::timestamptz;
    ELSIF to_regclass('public.events') IS NOT NULL THEN
      SELECT
        COALESCE(COUNT(DISTINCT e.user_id), 0),
        COALESCE(COUNT(*) FILTER (WHERE e.event_type IN ('quiz_complete', 'quiz_completed')), 0),
        COALESCE(COUNT(*) FILTER (WHERE e.event_type IN ('quiz_share', 'share_clicked')), 0),
        COALESCE(COUNT(*) FILTER (WHERE e.event_type = 'error'), 0)
      INTO dau, quiz_completes, shares, error_events
      FROM public.events e
      WHERE e.created_at >= v_day::timestamptz
        AND e.created_at < (v_day::timestamptz + interval '1 day');
    END IF;

    IF to_regclass('public.quiz_results') IS NOT NULL THEN
      SELECT COALESCE(COUNT(*), 0)
      INTO quiz_completes
      FROM public.quiz_results qr
      WHERE qr.completed_at >= v_day::timestamptz
        AND qr.completed_at < (v_day::timestamptz + interval '1 day');
    END IF;

    IF to_regclass('public.personality_test_completions') IS NOT NULL THEN
      SELECT COALESCE(COUNT(*), 0)
      INTO test_completes
      FROM public.personality_test_completions ptc
      WHERE ptc.completed_at >= v_day::timestamptz
        AND ptc.completed_at < (v_day::timestamptz + interval '1 day');
    ELSIF to_regclass('public.user_personality_results') IS NOT NULL THEN
      SELECT COALESCE(COUNT(*), 0)
      INTO test_completes
      FROM public.user_personality_results upr
      WHERE upr.completed_at >= v_day::timestamptz
        AND upr.completed_at < (v_day::timestamptz + interval '1 day');
    END IF;

    IF shares = 0 AND to_regclass('public.shares') IS NOT NULL THEN
      SELECT COALESCE(COUNT(*), 0)
      INTO v_share_fallback
      FROM public.shares s
      WHERE COALESCE(s.created_at, s.shared_at) >= v_day::timestamptz
        AND COALESCE(s.created_at, s.shared_at) < (v_day::timestamptz + interval '1 day');

      shares := COALESCE(v_share_fallback, 0);
    END IF;

    IF to_regclass('public.prediction_reports') IS NOT NULL THEN
      SELECT COALESCE(COUNT(*), 0)
      INTO prediction_reports
      FROM public.prediction_reports pr
      WHERE pr.created_at >= v_day::timestamptz
        AND pr.created_at < (v_day::timestamptz + interval '1 day');
    END IF;

    IF to_regclass('public.user_tasks') IS NOT NULL THEN
      SELECT COALESCE(COUNT(*), 0)
      INTO task_completions
      FROM public.user_tasks ut
      WHERE ut.completed_at >= v_day::timestamptz
        AND ut.completed_at < (v_day::timestamptz + interval '1 day');
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$$;

-- Funnels: shares table only as fallback.
DROP FUNCTION IF EXISTS public.admin_analytics_funnel_quiz(DATE, DATE);
CREATE OR REPLACE FUNCTION public.admin_analytics_funnel_quiz(
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (
  stage TEXT,
  users BIGINT,
  conversion_from_prev NUMERIC,
  conversion_from_first NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewed BIGINT := 0;
  v_started BIGINT := 0;
  v_completed BIGINT := 0;
  v_shared BIGINT := 0;
BEGIN
  PERFORM public.admin_analytics_require_admin();

  IF to_regclass('public.user_events') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT
        COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'quiz_view') AS viewed,
        COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'quiz_start') AS started,
        COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type IN ('quiz_complete', 'quiz_completed')) AS completed,
        COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'quiz_share') AS shared
      FROM public.user_events ue
      WHERE ue.created_at::date >= $1
        AND ue.created_at::date <= $2
    $sql$
    INTO v_viewed, v_started, v_completed, v_shared
    USING p_from, p_to;
  ELSIF to_regclass('public.events') IS NOT NULL THEN
    SELECT
      COALESCE(COUNT(DISTINCT e.user_id) FILTER (WHERE e.event_type IN ('quiz_view', 'quiz_viewed')), 0),
      COALESCE(COUNT(DISTINCT e.user_id) FILTER (WHERE e.event_type IN ('quiz_start', 'quiz_started')), 0),
      COALESCE(COUNT(DISTINCT e.user_id) FILTER (WHERE e.event_type IN ('quiz_complete', 'quiz_completed')), 0),
      COALESCE(COUNT(DISTINCT e.user_id) FILTER (WHERE e.event_type IN ('quiz_share', 'share_clicked')), 0)
    INTO v_viewed, v_started, v_completed, v_shared
    FROM public.events e
    WHERE e.created_at::date >= p_from
      AND e.created_at::date <= p_to;
  END IF;

  IF to_regclass('public.quiz_results') IS NOT NULL THEN
    SELECT COALESCE(COUNT(DISTINCT qr.user_id), 0)
    INTO v_completed
    FROM public.quiz_results qr
    WHERE qr.completed_at::date >= p_from
      AND qr.completed_at::date <= p_to;
  END IF;

  IF v_shared = 0 AND to_regclass('public.shares') IS NOT NULL THEN
    SELECT COALESCE(COUNT(DISTINCT s.user_id), 0)
    INTO v_shared
    FROM public.shares s
    WHERE COALESCE(s.created_at, s.shared_at)::date >= p_from
      AND COALESCE(s.created_at, s.shared_at)::date <= p_to
      AND COALESCE(s.content_type, 'quiz') = 'quiz';
  END IF;

  IF v_viewed = 0 AND v_started > 0 THEN
    v_viewed := v_started;
  END IF;

  RETURN QUERY
  SELECT 'viewed', v_viewed, 100::numeric, 100::numeric
  UNION ALL
  SELECT 'started', v_started,
    CASE WHEN v_viewed > 0 THEN ROUND((v_started::numeric / v_viewed::numeric) * 100, 1) ELSE 0 END,
    CASE WHEN v_viewed > 0 THEN ROUND((v_started::numeric / v_viewed::numeric) * 100, 1) ELSE 0 END
  UNION ALL
  SELECT 'completed', v_completed,
    CASE WHEN v_started > 0 THEN ROUND((v_completed::numeric / v_started::numeric) * 100, 1) ELSE 0 END,
    CASE WHEN v_viewed > 0 THEN ROUND((v_completed::numeric / v_viewed::numeric) * 100, 1) ELSE 0 END
  UNION ALL
  SELECT 'shared', v_shared,
    CASE WHEN v_completed > 0 THEN ROUND((v_shared::numeric / v_completed::numeric) * 100, 1) ELSE 0 END,
    CASE WHEN v_viewed > 0 THEN ROUND((v_shared::numeric / v_viewed::numeric) * 100, 1) ELSE 0 END;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_analytics_funnel_tests(DATE, DATE);
CREATE OR REPLACE FUNCTION public.admin_analytics_funnel_tests(
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (
  stage TEXT,
  users BIGINT,
  conversion_from_prev NUMERIC,
  conversion_from_first NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewed BIGINT := 0;
  v_started BIGINT := 0;
  v_completed BIGINT := 0;
  v_shared BIGINT := 0;
BEGIN
  PERFORM public.admin_analytics_require_admin();

  IF to_regclass('public.user_events') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT
        COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'test_view') AS viewed,
        COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'test_start') AS started,
        COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'test_complete') AS completed,
        COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'test_share') AS shared
      FROM public.user_events ue
      WHERE ue.created_at::date >= $1
        AND ue.created_at::date <= $2
    $sql$
    INTO v_viewed, v_started, v_completed, v_shared
    USING p_from, p_to;
  END IF;

  IF to_regclass('public.personality_test_completions') IS NOT NULL THEN
    SELECT COALESCE(COUNT(DISTINCT ptc.user_id), 0)
    INTO v_completed
    FROM public.personality_test_completions ptc
    WHERE ptc.completed_at::date >= p_from
      AND ptc.completed_at::date <= p_to;
  ELSIF to_regclass('public.user_personality_results') IS NOT NULL THEN
    SELECT COALESCE(COUNT(DISTINCT upr.user_id), 0)
    INTO v_completed
    FROM public.user_personality_results upr
    WHERE upr.completed_at::date >= p_from
      AND upr.completed_at::date <= p_to;
  END IF;

  IF v_shared = 0 AND to_regclass('public.shares') IS NOT NULL THEN
    SELECT COALESCE(COUNT(DISTINCT s.user_id), 0)
    INTO v_shared
    FROM public.shares s
    WHERE COALESCE(s.created_at, s.shared_at)::date >= p_from
      AND COALESCE(s.created_at, s.shared_at)::date <= p_to
      AND COALESCE(s.content_type, 'quiz') = 'personality_test';
  END IF;

  IF v_viewed = 0 AND v_started > 0 THEN
    v_viewed := v_started;
  END IF;

  RETURN QUERY
  SELECT 'viewed', v_viewed, 100::numeric, 100::numeric
  UNION ALL
  SELECT 'started', v_started,
    CASE WHEN v_viewed > 0 THEN ROUND((v_started::numeric / v_viewed::numeric) * 100, 1) ELSE 0 END,
    CASE WHEN v_viewed > 0 THEN ROUND((v_started::numeric / v_viewed::numeric) * 100, 1) ELSE 0 END
  UNION ALL
  SELECT 'completed', v_completed,
    CASE WHEN v_started > 0 THEN ROUND((v_completed::numeric / v_started::numeric) * 100, 1) ELSE 0 END,
    CASE WHEN v_viewed > 0 THEN ROUND((v_completed::numeric / v_viewed::numeric) * 100, 1) ELSE 0 END
  UNION ALL
  SELECT 'shared', v_shared,
    CASE WHEN v_completed > 0 THEN ROUND((v_shared::numeric / v_completed::numeric) * 100, 1) ELSE 0 END,
    CASE WHEN v_viewed > 0 THEN ROUND((v_shared::numeric / v_viewed::numeric) * 100, 1) ELSE 0 END;
END;
$$;

-- Top quizzes: compute shares from user_events first, shares table as fallback; avg time from telemetry if needed.
DROP FUNCTION IF EXISTS public.admin_analytics_top_quizzes(DATE, DATE, INT);
CREATE OR REPLACE FUNCTION public.admin_analytics_top_quizzes(
  p_from DATE,
  p_to DATE,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  quiz_id UUID,
  title TEXT,
  views BIGINT,
  starts BIGINT,
  completes BIGINT,
  shares BIGINT,
  avg_score_pct NUMERIC,
  avg_time_seconds NUMERIC,
  completion_rate NUMERIC,
  share_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_analytics_require_admin();

  RETURN QUERY
  WITH quiz_base AS (
    SELECT q.id, q.title
    FROM public.quizzes q
    WHERE (q.status = 'published' OR q.is_published = true)
  ),
  event_stats AS (
    SELECT
      ue.quiz_id,
      COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'quiz_view') AS views,
      COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'quiz_start') AS starts
    FROM public.user_events ue
    WHERE to_regclass('public.user_events') IS NOT NULL
      AND ue.created_at::date >= p_from
      AND ue.created_at::date <= p_to
      AND ue.quiz_id IS NOT NULL
    GROUP BY ue.quiz_id
  ),
  result_stats AS (
    SELECT
      qr.quiz_id,
      COUNT(DISTINCT qr.user_id) AS completes,
      AVG((qr.score::numeric / NULLIF(qr.max_score::numeric, 0)) * 100) AS avg_score_pct,
      AVG(qr.time_taken_seconds::numeric) FILTER (WHERE qr.time_taken_seconds IS NOT NULL AND qr.time_taken_seconds > 0 AND qr.time_taken_seconds < 3600) AS avg_time_seconds
    FROM public.quiz_results qr
    WHERE to_regclass('public.quiz_results') IS NOT NULL
      AND qr.completed_at::date >= p_from
      AND qr.completed_at::date <= p_to
    GROUP BY qr.quiz_id
  ),
  completion_events AS (
    SELECT
      ue.quiz_id,
      AVG(((ue.event_data->>'time_total_ms')::numeric) / 1000.0)
        FILTER (WHERE ue.event_data ? 'time_total_ms' AND ((ue.event_data->>'time_total_ms')::numeric) > 0 AND ((ue.event_data->>'time_total_ms')::numeric) < 3600000) AS avg_time_seconds
    FROM public.user_events ue
    WHERE to_regclass('public.user_events') IS NOT NULL
      AND ue.created_at::date >= p_from
      AND ue.created_at::date <= p_to
      AND ue.event_type IN ('quiz_complete', 'quiz_completed')
      AND ue.quiz_id IS NOT NULL
    GROUP BY ue.quiz_id
  ),
  share_events AS (
    SELECT
      ue.quiz_id,
      COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) AS shares
    FROM public.user_events ue
    WHERE to_regclass('public.user_events') IS NOT NULL
      AND ue.created_at::date >= p_from
      AND ue.created_at::date <= p_to
      AND ue.event_type = 'quiz_share'
      AND ue.quiz_id IS NOT NULL
    GROUP BY ue.quiz_id
  ),
  share_legacy AS (
    SELECT
      COALESCE(s.content_id, s.quiz_id) AS quiz_id,
      COUNT(DISTINCT s.user_id) AS shares
    FROM public.shares s
    WHERE to_regclass('public.shares') IS NOT NULL
      AND COALESCE(s.created_at, s.shared_at)::date >= p_from
      AND COALESCE(s.created_at, s.shared_at)::date <= p_to
      AND COALESCE(s.content_type, 'quiz') = 'quiz'
    GROUP BY COALESCE(s.content_id, s.quiz_id)
  )
  SELECT
    qb.id,
    qb.title,
    COALESCE(es.views, 0)::BIGINT,
    COALESCE(es.starts, 0)::BIGINT,
    COALESCE(rs.completes, 0)::BIGINT,
    CASE
      WHEN COALESCE(se.shares, 0) > 0 THEN COALESCE(se.shares, 0)::BIGINT
      ELSE COALESCE(sl.shares, 0)::BIGINT
    END AS shares,
    ROUND(COALESCE(rs.avg_score_pct, 0), 1),
    ROUND(COALESCE(NULLIF(rs.avg_time_seconds, 0), ce.avg_time_seconds, 0), 1),
    CASE WHEN COALESCE(es.starts, 0) > 0 THEN ROUND((COALESCE(rs.completes, 0)::numeric / es.starts::numeric) * 100, 1) ELSE 0 END,
    CASE WHEN COALESCE(rs.completes, 0) > 0 THEN ROUND(((
      CASE WHEN COALESCE(se.shares, 0) > 0 THEN COALESCE(se.shares, 0) ELSE COALESCE(sl.shares, 0) END
    )::numeric / rs.completes::numeric) * 100, 1) ELSE 0 END
  FROM quiz_base qb
  LEFT JOIN event_stats es ON es.quiz_id = qb.id
  LEFT JOIN result_stats rs ON rs.quiz_id = qb.id
  LEFT JOIN completion_events ce ON ce.quiz_id = qb.id
  LEFT JOIN share_events se ON se.quiz_id = qb.id
  LEFT JOIN share_legacy sl ON sl.quiz_id = qb.id
  ORDER BY COALESCE(rs.completes, 0) DESC, (
    CASE WHEN COALESCE(se.shares, 0) > 0 THEN COALESCE(se.shares, 0) ELSE COALESCE(sl.shares, 0) END
  ) DESC
  LIMIT p_limit;
END;
$$;

-- Top tests: shares from user_events first, legacy shares as fallback.
DROP FUNCTION IF EXISTS public.admin_analytics_top_tests(DATE, DATE, INT);
CREATE OR REPLACE FUNCTION public.admin_analytics_top_tests(
  p_from DATE,
  p_to DATE,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  test_id UUID,
  title TEXT,
  views BIGINT,
  starts BIGINT,
  completes BIGINT,
  shares BIGINT,
  completion_rate NUMERIC,
  share_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completion_sql TEXT;
  v_share_sql TEXT;
  v_sql TEXT;
BEGIN
  PERFORM public.admin_analytics_require_admin();

  IF to_regclass('public.personality_tests') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.personality_test_completions') IS NOT NULL THEN
    v_completion_sql := '
      SELECT
        ptc.test_id,
        COUNT(DISTINCT ptc.user_id)::BIGINT AS completes
      FROM public.personality_test_completions ptc
      WHERE ptc.completed_at::date >= $1
        AND ptc.completed_at::date <= $2
      GROUP BY ptc.test_id
    ';
  ELSIF to_regclass('public.user_personality_results') IS NOT NULL THEN
    v_completion_sql := '
      SELECT
        upr.test_id,
        COUNT(DISTINCT upr.user_id)::BIGINT AS completes
      FROM public.user_personality_results upr
      WHERE upr.completed_at::date >= $1
        AND upr.completed_at::date <= $2
      GROUP BY upr.test_id
    ';
  ELSE
    v_completion_sql := 'SELECT NULL::uuid AS test_id, 0::BIGINT AS completes WHERE false';
  END IF;

  IF to_regclass('public.user_events') IS NOT NULL THEN
    v_share_sql := '
      SELECT
        (ue.event_data->>''test_id'')::uuid AS test_id,
        COUNT(DISTINCT COALESCE(ue.user_id::text, ''tg:'' || ue.telegram_id::text))::BIGINT AS shares
      FROM public.user_events ue
      WHERE ue.created_at::date >= $1
        AND ue.created_at::date <= $2
        AND ue.event_type = ''test_share''
        AND ue.event_data ? ''test_id''
      GROUP BY (ue.event_data->>''test_id'')::uuid
    ';
  ELSIF to_regclass('public.shares') IS NOT NULL THEN
    v_share_sql := '
      SELECT
        COALESCE(s.content_id, s.quiz_id) AS test_id,
        COUNT(DISTINCT s.user_id)::BIGINT AS shares
      FROM public.shares s
      WHERE COALESCE(s.created_at, s.shared_at)::date >= $1
        AND COALESCE(s.created_at, s.shared_at)::date <= $2
        AND COALESCE(s.content_type, ''quiz'') = ''personality_test''
      GROUP BY COALESCE(s.content_id, s.quiz_id)
    ';
  ELSE
    v_share_sql := 'SELECT NULL::uuid AS test_id, 0::BIGINT AS shares WHERE false';
  END IF;

  v_sql := '
    WITH test_base AS (
      SELECT pt.id, pt.title
      FROM public.personality_tests pt
      WHERE pt.is_published = true
    ),
    event_stats AS (
      SELECT
        (ue.event_data->>''test_id'')::uuid AS test_id,
        COUNT(DISTINCT COALESCE(ue.user_id::text, ''tg:'' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = ''test_view'') AS views,
        COUNT(DISTINCT COALESCE(ue.user_id::text, ''tg:'' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = ''test_start'') AS starts
      FROM public.user_events ue
      WHERE to_regclass(''public.user_events'') IS NOT NULL
        AND ue.created_at::date >= $1
        AND ue.created_at::date <= $2
        AND ue.event_data ? ''test_id''
      GROUP BY (ue.event_data->>''test_id'')::uuid
    ),
    completion_agg AS (' || v_completion_sql || '),
    share_stats AS (' || v_share_sql || ')
    SELECT
      tb.id,
      tb.title,
      COALESCE(es.views, 0)::BIGINT AS views,
      COALESCE(es.starts, 0)::BIGINT AS starts,
      COALESCE(ca.completes, 0)::BIGINT AS completes,
      COALESCE(ss.shares, 0)::BIGINT AS shares,
      CASE WHEN COALESCE(es.starts, 0) > 0
        THEN ROUND((COALESCE(ca.completes, 0)::numeric / es.starts::numeric) * 100, 1)
        ELSE 0 END AS completion_rate,
      CASE WHEN COALESCE(ca.completes, 0) > 0
        THEN ROUND((COALESCE(ss.shares, 0)::numeric / ca.completes::numeric) * 100, 1)
        ELSE 0 END AS share_rate
    FROM test_base tb
    LEFT JOIN event_stats es ON es.test_id = tb.id
    LEFT JOIN completion_agg ca ON ca.test_id = tb.id
    LEFT JOIN share_stats ss ON ss.test_id = tb.id
    ORDER BY COALESCE(ca.completes, 0) DESC, COALESCE(ss.shares, 0) DESC
    LIMIT $3
  ';

  RETURN QUERY EXECUTE v_sql USING p_from, p_to, p_limit;
END;
$$;

-- Permissions: keep admin analytics RPCs authenticated-only.
REVOKE ALL ON FUNCTION public.admin_analytics_require_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_overview(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_timeseries(DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_funnel_quiz(DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_funnel_tests(DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_top_quizzes(DATE, DATE, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_top_tests(DATE, DATE, INT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_analytics_overview(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_timeseries(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_funnel_quiz(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_funnel_tests(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_top_quizzes(DATE, DATE, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_top_tests(DATE, DATE, INT) TO authenticated;

-- Ensure PostgREST refreshes schema cache (prevents "schema cache" errors after DDL).
NOTIFY pgrst, 'reload schema';

