-- Analytics+ admin RPC layer, fallback-safe over mixed schemas.

-- ---------------------------------------------------------------------------
-- Indexes for analytics-heavy reads
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.user_events') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_events_type_created_at ON public.user_events(event_type, created_at)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_events_quiz_created_at ON public.user_events(quiz_id, created_at)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_events_screen_name ON public.user_events((event_data->>''screen_name''))';
  END IF;

  IF to_regclass('public.quiz_results') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_quiz_results_completed_at_quiz_id ON public.quiz_results(completed_at, quiz_id)';
  END IF;

  IF to_regclass('public.personality_test_completions') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ptc_completed_at_test_id ON public.personality_test_completions(completed_at, test_id)';
  END IF;

  IF to_regclass('public.prediction_polls') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_prediction_polls_status_created_at_analytics ON public.prediction_polls(status, created_at)';
  END IF;

  IF to_regclass('public.user_tasks') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_tasks_completed_at_task_id ON public.user_tasks(completed_at, task_id)';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_analytics_require_admin();
CREATE OR REPLACE FUNCTION public.admin_analytics_require_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin_only'
      USING ERRCODE = '42501',
            MESSAGE = 'Admin access required';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_analytics_active_users_count(TIMESTAMPTZ, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION public.admin_analytics_active_users_count(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT := 0;
  v_union_sql TEXT := '';
BEGIN
  IF to_regclass('public.user_events') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text))
      FROM public.user_events ue
      WHERE ue.created_at >= $1
        AND ue.created_at < $2
    $sql$
    INTO v_count
    USING p_from, p_to;
  END IF;

  IF COALESCE(v_count, 0) = 0 THEN
    IF to_regclass('public.quiz_results') IS NOT NULL THEN
      v_union_sql := v_union_sql || '
        SELECT DISTINCT qr.user_id::text AS actor
        FROM public.quiz_results qr
        WHERE qr.completed_at >= $1
          AND qr.completed_at < $2
      ';
    END IF;

    IF to_regclass('public.personality_test_completions') IS NOT NULL THEN
      IF v_union_sql <> '' THEN
        v_union_sql := v_union_sql || ' UNION ';
      END IF;
      v_union_sql := v_union_sql || '
        SELECT DISTINCT ptc.user_id::text AS actor
        FROM public.personality_test_completions ptc
        WHERE ptc.completed_at >= $1
          AND ptc.completed_at < $2
      ';
    ELSIF to_regclass('public.user_personality_results') IS NOT NULL THEN
      IF v_union_sql <> '' THEN
        v_union_sql := v_union_sql || ' UNION ';
      END IF;
      v_union_sql := v_union_sql || '
        SELECT DISTINCT upr.user_id::text AS actor
        FROM public.user_personality_results upr
        WHERE upr.completed_at >= $1
          AND upr.completed_at < $2
      ';
    END IF;

    IF to_regclass('public.user_tasks') IS NOT NULL THEN
      IF v_union_sql <> '' THEN
        v_union_sql := v_union_sql || ' UNION ';
      END IF;
      v_union_sql := v_union_sql || '
        SELECT DISTINCT ut.user_id::text AS actor
        FROM public.user_tasks ut
        WHERE ut.completed_at >= $1
          AND ut.completed_at < $2
      ';
    END IF;

    IF v_union_sql <> '' THEN
      EXECUTE 'SELECT COUNT(*) FROM (' || v_union_sql || ') ids'
      INTO v_count
      USING p_from, p_to;
    END IF;
  END IF;

  RETURN COALESCE(v_count, 0);
END;
$$;

-- ---------------------------------------------------------------------------
-- 1) Overview
-- ---------------------------------------------------------------------------
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
  quiz_views BIGINT,
  quiz_starts BIGINT,
  quiz_completes BIGINT,
  quiz_shares BIGINT,
  test_views BIGINT,
  test_starts BIGINT,
  test_completes BIGINT,
  test_shares BIGINT,
  avg_quiz_time_seconds NUMERIC,
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
  v_quiz_views BIGINT := 0;
  v_quiz_starts BIGINT := 0;
  v_quiz_completes BIGINT := 0;
  v_quiz_shares BIGINT := 0;
  v_test_views BIGINT := 0;
  v_test_starts BIGINT := 0;
  v_test_completes BIGINT := 0;
  v_test_shares BIGINT := 0;
  v_avg_quiz_time_seconds NUMERIC := 0;
  v_avg_quiz_score_pct NUMERIC := 0;
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
        COALESCE(AVG(((ue.event_data->>'time_total_ms')::numeric) / 1000)
          FILTER (WHERE ue.event_type IN ('quiz_complete', 'quiz_completed') AND ue.event_data ? 'time_total_ms'), 0) AS avg_time,
        COALESCE(AVG(
          CASE
            WHEN (ue.event_data->>'max_score')::numeric > 0
              THEN ((ue.event_data->>'score')::numeric / NULLIF((ue.event_data->>'max_score')::numeric, 0)) * 100
            ELSE NULL
          END
        ) FILTER (WHERE ue.event_type IN ('quiz_complete', 'quiz_completed') AND ue.event_data ? 'score' AND ue.event_data ? 'max_score'), 0) AS avg_score
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
      v_avg_quiz_score_pct
    USING p_from, p_to;
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

  IF to_regclass('public.quiz_results') IS NOT NULL THEN
    SELECT COUNT(*),
           COALESCE(AVG(qr.time_taken_seconds::numeric), 0),
           COALESCE(AVG((qr.score::numeric / NULLIF(qr.max_score::numeric, 0)) * 100), 0)
    INTO v_quiz_completes, v_avg_quiz_time_seconds, v_avg_quiz_score_pct
    FROM public.quiz_results qr
    WHERE qr.completed_at >= p_from
      AND qr.completed_at < p_to;
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

  IF to_regclass('public.shares') IS NOT NULL THEN
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
    COALESCE(v_quiz_views, 0),
    COALESCE(v_quiz_starts, 0),
    COALESCE(v_quiz_completes, 0),
    COALESCE(v_quiz_shares, 0),
    COALESCE(v_test_views, 0),
    COALESCE(v_test_starts, 0),
    COALESCE(v_test_completes, 0),
    COALESCE(v_test_shares, 0),
    ROUND(COALESCE(v_avg_quiz_time_seconds, 0), 1),
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

-- ---------------------------------------------------------------------------
-- 2) Timeseries
-- ---------------------------------------------------------------------------
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

    IF to_regclass('public.shares') IS NOT NULL THEN
      SELECT COALESCE(COUNT(*), 0)
      INTO shares
      FROM public.shares s
      WHERE COALESCE(s.created_at, s.shared_at) >= v_day::timestamptz
        AND COALESCE(s.created_at, s.shared_at) < (v_day::timestamptz + interval '1 day');
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

-- ---------------------------------------------------------------------------
-- 3) Funnel: Quiz
-- ---------------------------------------------------------------------------
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

  IF to_regclass('public.shares') IS NOT NULL THEN
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

-- ---------------------------------------------------------------------------
-- 4) Funnel: Tests
-- ---------------------------------------------------------------------------
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

  IF to_regclass('public.shares') IS NOT NULL THEN
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

-- ---------------------------------------------------------------------------
-- 5) Top quizzes
-- ---------------------------------------------------------------------------
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

  IF to_regclass('public.user_events') IS NOT NULL THEN
    RETURN QUERY
    WITH quiz_base AS (
      SELECT q.id, q.title
      FROM public.quizzes q
      WHERE q.is_published = true
         OR COALESCE(NULLIF(to_jsonb(q)->>'status', ''), '') = 'published'
    ),
    event_stats AS (
      SELECT
        ue.quiz_id,
        COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'quiz_view') AS views,
        COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'quiz_start') AS starts
      FROM public.user_events ue
      WHERE ue.created_at::date >= p_from
        AND ue.created_at::date <= p_to
        AND ue.quiz_id IS NOT NULL
      GROUP BY ue.quiz_id
    ),
    result_stats AS (
      SELECT
        qr.quiz_id,
        COUNT(DISTINCT qr.user_id) AS completes,
        COALESCE(AVG((qr.score::numeric / NULLIF(qr.max_score::numeric, 0)) * 100), 0) AS avg_score_pct,
        COALESCE(AVG(qr.time_taken_seconds::numeric), 0) AS avg_time_seconds
      FROM public.quiz_results qr
      WHERE qr.completed_at::date >= p_from
        AND qr.completed_at::date <= p_to
      GROUP BY qr.quiz_id
    ),
    share_stats AS (
      SELECT
        COALESCE(s.content_id, s.quiz_id) AS quiz_id,
        COUNT(DISTINCT s.user_id) AS shares
      FROM public.shares s
      WHERE COALESCE(s.created_at, s.shared_at)::date >= p_from
        AND COALESCE(s.created_at, s.shared_at)::date <= p_to
        AND COALESCE(s.content_type, 'quiz') = 'quiz'
      GROUP BY COALESCE(s.content_id, s.quiz_id)
    )
    SELECT
      qb.id,
      qb.title,
      COALESCE(es.views, 0),
      COALESCE(es.starts, 0),
      COALESCE(rs.completes, 0),
      COALESCE(ss.shares, 0),
      ROUND(COALESCE(rs.avg_score_pct, 0), 1),
      ROUND(COALESCE(rs.avg_time_seconds, 0), 1),
      CASE WHEN COALESCE(es.starts, 0) > 0 THEN ROUND((COALESCE(rs.completes, 0)::numeric / es.starts::numeric) * 100, 1) ELSE 0 END,
      CASE WHEN COALESCE(rs.completes, 0) > 0 THEN ROUND((COALESCE(ss.shares, 0)::numeric / rs.completes::numeric) * 100, 1) ELSE 0 END
    FROM quiz_base qb
    LEFT JOIN event_stats es ON es.quiz_id = qb.id
    LEFT JOIN result_stats rs ON rs.quiz_id = qb.id
    LEFT JOIN share_stats ss ON ss.quiz_id = qb.id
    ORDER BY COALESCE(rs.completes, 0) DESC, COALESCE(ss.shares, 0) DESC
    LIMIT p_limit;
  ELSE
    RETURN QUERY
    WITH quiz_base AS (
      SELECT q.id, q.title
      FROM public.quizzes q
      WHERE q.is_published = true
         OR COALESCE(NULLIF(to_jsonb(q)->>'status', ''), '') = 'published'
    ),
    result_stats AS (
      SELECT
        qr.quiz_id,
        COUNT(DISTINCT qr.user_id) AS completes,
        COALESCE(AVG((qr.score::numeric / NULLIF(qr.max_score::numeric, 0)) * 100), 0) AS avg_score_pct,
        COALESCE(AVG(qr.time_taken_seconds::numeric), 0) AS avg_time_seconds
      FROM public.quiz_results qr
      WHERE qr.completed_at::date >= p_from
        AND qr.completed_at::date <= p_to
      GROUP BY qr.quiz_id
    ),
    share_stats AS (
      SELECT
        COALESCE(s.content_id, s.quiz_id) AS quiz_id,
        COUNT(DISTINCT s.user_id) AS shares
      FROM public.shares s
      WHERE COALESCE(s.created_at, s.shared_at)::date >= p_from
        AND COALESCE(s.created_at, s.shared_at)::date <= p_to
        AND COALESCE(s.content_type, 'quiz') = 'quiz'
      GROUP BY COALESCE(s.content_id, s.quiz_id)
    )
    SELECT
      qb.id,
      qb.title,
      0::BIGINT,
      0::BIGINT,
      COALESCE(rs.completes, 0),
      COALESCE(ss.shares, 0),
      ROUND(COALESCE(rs.avg_score_pct, 0), 1),
      ROUND(COALESCE(rs.avg_time_seconds, 0), 1),
      0::NUMERIC,
      CASE WHEN COALESCE(rs.completes, 0) > 0 THEN ROUND((COALESCE(ss.shares, 0)::numeric / rs.completes::numeric) * 100, 1) ELSE 0 END
    FROM quiz_base qb
    LEFT JOIN result_stats rs ON rs.quiz_id = qb.id
    LEFT JOIN share_stats ss ON ss.quiz_id = qb.id
    ORDER BY COALESCE(rs.completes, 0) DESC, COALESCE(ss.shares, 0) DESC
    LIMIT p_limit;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) Top tests
-- ---------------------------------------------------------------------------
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
  v_has_user_events BOOLEAN := to_regclass('public.user_events') IS NOT NULL;
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

  IF to_regclass('public.shares') IS NOT NULL THEN
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

  IF v_has_user_events THEN
    v_sql := '
      WITH test_base AS (
        SELECT pt.id, pt.title
        FROM public.personality_tests pt
        WHERE pt.is_published = true
           OR COALESCE(NULLIF(to_jsonb(pt)->>''status'', ''''), '''') = ''published''
      ),
      event_stats AS (
        SELECT
          (ue.event_data->>''test_id'')::uuid AS test_id,
          COUNT(DISTINCT COALESCE(ue.user_id::text, ''tg:'' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = ''test_view'') AS views,
          COUNT(DISTINCT COALESCE(ue.user_id::text, ''tg:'' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = ''test_start'') AS starts,
          COUNT(DISTINCT COALESCE(ue.user_id::text, ''tg:'' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = ''test_complete'') AS completes,
          COUNT(DISTINCT COALESCE(ue.user_id::text, ''tg:'' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = ''test_share'') AS shares
        FROM public.user_events ue
        WHERE ue.created_at::date >= $1
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
        GREATEST(COALESCE(es.completes, 0), COALESCE(ca.completes, 0))::BIGINT AS completes,
        GREATEST(COALESCE(es.shares, 0), COALESCE(ss.shares, 0))::BIGINT AS shares,
        CASE WHEN COALESCE(es.starts, 0) > 0
          THEN ROUND((GREATEST(COALESCE(es.completes, 0), COALESCE(ca.completes, 0))::numeric / es.starts::numeric) * 100, 1)
          ELSE 0 END AS completion_rate,
        CASE WHEN GREATEST(COALESCE(es.completes, 0), COALESCE(ca.completes, 0)) > 0
          THEN ROUND((GREATEST(COALESCE(es.shares, 0), COALESCE(ss.shares, 0))::numeric / GREATEST(COALESCE(es.completes, 0), COALESCE(ca.completes, 0))::numeric) * 100, 1)
          ELSE 0 END AS share_rate
      FROM test_base tb
      LEFT JOIN event_stats es ON es.test_id = tb.id
      LEFT JOIN completion_agg ca ON ca.test_id = tb.id
      LEFT JOIN share_stats ss ON ss.test_id = tb.id
      ORDER BY GREATEST(COALESCE(es.completes, 0), COALESCE(ca.completes, 0)) DESC,
               GREATEST(COALESCE(es.shares, 0), COALESCE(ss.shares, 0)) DESC
      LIMIT $3
    ';
  ELSE
    v_sql := '
      WITH test_base AS (
        SELECT pt.id, pt.title
        FROM public.personality_tests pt
        WHERE pt.is_published = true
           OR COALESCE(NULLIF(to_jsonb(pt)->>''status'', ''''), '''') = ''published''
      ),
      completion_agg AS (' || v_completion_sql || '),
      share_stats AS (' || v_share_sql || ')
      SELECT
        tb.id,
        tb.title,
        0::BIGINT AS views,
        0::BIGINT AS starts,
        COALESCE(ca.completes, 0)::BIGINT AS completes,
        COALESCE(ss.shares, 0)::BIGINT AS shares,
        0::NUMERIC AS completion_rate,
        CASE WHEN COALESCE(ca.completes, 0) > 0
          THEN ROUND((COALESCE(ss.shares, 0)::numeric / ca.completes::numeric) * 100, 1)
          ELSE 0 END AS share_rate
      FROM test_base tb
      LEFT JOIN completion_agg ca ON ca.test_id = tb.id
      LEFT JOIN share_stats ss ON ss.test_id = tb.id
      ORDER BY COALESCE(ca.completes, 0) DESC, COALESCE(ss.shares, 0) DESC
      LIMIT $3
    ';
  END IF;

  RETURN QUERY EXECUTE v_sql USING p_from, p_to, p_limit;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7) Acquisition sources
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_analytics_sources(DATE, DATE);
CREATE OR REPLACE FUNCTION public.admin_analytics_sources(
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (
  source TEXT,
  user_count BIGINT,
  percentage NUMERIC,
  referred_users BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_analytics_require_admin();

  IF to_regclass('public.user_events') IS NOT NULL THEN
    RETURN QUERY
    WITH source_events AS (
      SELECT DISTINCT ON (COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text))
        COALESCE(NULLIF(ue.event_data->>'source', ''), 'unknown') AS src,
        COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text) AS actor
      FROM public.user_events ue
      WHERE ue.created_at::date >= p_from
        AND ue.created_at::date <= p_to
        AND ue.event_type IN ('app_open', 'deep_link_open')
      ORDER BY COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text), ue.created_at
    ),
    source_counts AS (
      SELECT se.src AS source, COUNT(*)::BIGINT AS user_count
      FROM source_events se
      GROUP BY se.src
    ),
    referral_counts AS (
      SELECT
        COALESCE(NULLIF(to_jsonb(p)::jsonb->>'referral_source', ''), NULLIF(to_jsonb(p)::jsonb->>'source', ''), 'unknown') AS source,
        COUNT(*)::BIGINT AS referred_users
      FROM public.referrals r
      JOIN public.profiles p ON p.id = r.referred_id
      WHERE r.created_at::date >= p_from
        AND r.created_at::date <= p_to
      GROUP BY 1
    ),
    total AS (
      SELECT COALESCE(SUM(sc.user_count), 0)::NUMERIC AS total_users
      FROM source_counts sc
    )
    SELECT
      sc.source,
      sc.user_count,
      CASE WHEN t.total_users > 0 THEN ROUND((sc.user_count::NUMERIC / t.total_users) * 100, 1) ELSE 0 END AS percentage,
      COALESCE(rc.referred_users, 0) AS referred_users
    FROM source_counts sc
    CROSS JOIN total t
    LEFT JOIN referral_counts rc ON rc.source = sc.source
    ORDER BY sc.user_count DESC;
  ELSE
    RETURN QUERY
    WITH source_counts AS (
      SELECT
        COALESCE(NULLIF(to_jsonb(p)::jsonb->>'referral_source', ''), NULLIF(to_jsonb(p)::jsonb->>'source', ''), 'unknown') AS source,
        COUNT(*)::BIGINT AS user_count
      FROM public.profiles p
      WHERE p.created_at::date >= p_from
        AND p.created_at::date <= p_to
      GROUP BY 1
    ),
    referral_counts AS (
      SELECT
        COALESCE(NULLIF(to_jsonb(p)::jsonb->>'referral_source', ''), NULLIF(to_jsonb(p)::jsonb->>'source', ''), 'unknown') AS source,
        COUNT(*)::BIGINT AS referred_users
      FROM public.referrals r
      JOIN public.profiles p ON p.id = r.referred_id
      WHERE r.created_at::date >= p_from
        AND r.created_at::date <= p_to
      GROUP BY 1
    ),
    total AS (
      SELECT COALESCE(SUM(sc.user_count), 0)::NUMERIC AS total_users
      FROM source_counts sc
    )
    SELECT
      sc.source,
      sc.user_count,
      CASE WHEN t.total_users > 0 THEN ROUND((sc.user_count::NUMERIC / t.total_users) * 100, 1) ELSE 0 END AS percentage,
      COALESCE(rc.referred_users, 0) AS referred_users
    FROM source_counts sc
    CROSS JOIN total t
    LEFT JOIN referral_counts rc ON rc.source = sc.source
    ORDER BY sc.user_count DESC;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8) Screen transitions
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_analytics_screen_transitions(DATE, DATE, INT);
CREATE OR REPLACE FUNCTION public.admin_analytics_screen_transitions(
  p_from DATE,
  p_to DATE,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  from_screen TEXT,
  to_screen TEXT,
  transitions BIGINT,
  unique_users BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_analytics_require_admin();

  IF to_regclass('public.user_events') IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(NULLIF(ue.event_data->>'previous_screen', ''), 'unknown') AS from_screen,
    COALESCE(NULLIF(ue.event_data->>'screen_name', ''), 'unknown') AS to_screen,
    COUNT(*)::BIGINT AS transitions,
    COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text))::BIGINT AS unique_users
  FROM public.user_events ue
  WHERE ue.created_at::date >= p_from
    AND ue.created_at::date <= p_to
    AND ue.event_type = 'screen_view'
  GROUP BY 1, 2
  ORDER BY transitions DESC
  LIMIT p_limit;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9) Prediction operations summary
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_analytics_predictions(DATE, DATE);
CREATE OR REPLACE FUNCTION public.admin_analytics_predictions(
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (
  created_total BIGINT,
  pending_total BIGINT,
  under_review_total BIGINT,
  resolved_total BIGINT,
  rejected_total BIGINT,
  cancelled_total BIGINT,
  total_reports_current BIGINT,
  reports_created_in_range BIGINT,
  avg_time_to_moderation_hours NUMERIC,
  avg_time_to_resolution_hours NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created_total BIGINT := 0;
  v_pending_total BIGINT := 0;
  v_under_review_total BIGINT := 0;
  v_resolved_total BIGINT := 0;
  v_rejected_total BIGINT := 0;
  v_cancelled_total BIGINT := 0;
  v_total_reports_current BIGINT := 0;
  v_reports_created_in_range BIGINT := 0;
  v_avg_time_to_moderation_hours NUMERIC := 0;
  v_avg_time_to_resolution_hours NUMERIC := 0;
BEGIN
  PERFORM public.admin_analytics_require_admin();

  IF to_regclass('public.prediction_polls') IS NULL THEN
    RETURN QUERY SELECT 0,0,0,0,0,0,0,0,0::numeric,0::numeric;
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO v_created_total
  FROM public.prediction_polls pp
  WHERE pp.created_at::date >= p_from
    AND pp.created_at::date <= p_to;

  SELECT COUNT(*) INTO v_pending_total FROM public.prediction_polls WHERE status = 'pending';
  SELECT COUNT(*) INTO v_under_review_total FROM public.prediction_polls WHERE status = 'under_review';
  SELECT COUNT(*) INTO v_resolved_total FROM public.prediction_polls WHERE status = 'resolved';
  SELECT COUNT(*) INTO v_rejected_total FROM public.prediction_polls WHERE status = 'rejected';
  SELECT COUNT(*) INTO v_cancelled_total FROM public.prediction_polls WHERE status = 'cancelled';

  SELECT COALESCE(SUM(pp.report_count), 0)
  INTO v_total_reports_current
  FROM public.prediction_polls pp;

  IF to_regclass('public.prediction_reports') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_reports_created_in_range
    FROM public.prediction_reports pr
    WHERE pr.created_at::date >= p_from
      AND pr.created_at::date <= p_to;
  END IF;

  SELECT
    COALESCE(AVG(EXTRACT(EPOCH FROM (pp.moderated_at - COALESCE(pp.submitted_at, pp.created_at))) / 3600.0), 0),
    COALESCE(AVG(EXTRACT(EPOCH FROM (pp.resolved_at - COALESCE(pp.moderated_at, pp.created_at))) / 3600.0), 0)
  INTO v_avg_time_to_moderation_hours, v_avg_time_to_resolution_hours
  FROM public.prediction_polls pp
  WHERE pp.created_at::date >= p_from
    AND pp.created_at::date <= p_to
    AND pp.moderated_at IS NOT NULL;

  RETURN QUERY
  SELECT
    COALESCE(v_created_total, 0),
    COALESCE(v_pending_total, 0),
    COALESCE(v_under_review_total, 0),
    COALESCE(v_resolved_total, 0),
    COALESCE(v_rejected_total, 0),
    COALESCE(v_cancelled_total, 0),
    COALESCE(v_total_reports_current, 0),
    COALESCE(v_reports_created_in_range, 0),
    ROUND(COALESCE(v_avg_time_to_moderation_hours, 0), 1),
    ROUND(COALESCE(v_avg_time_to_resolution_hours, 0), 1);
END;
$$;

-- ---------------------------------------------------------------------------
-- 10) Tasks analytics
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_analytics_tasks(DATE, DATE, INT);
CREATE OR REPLACE FUNCTION public.admin_analytics_tasks(
  p_from DATE,
  p_to DATE,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  task_id UUID,
  title TEXT,
  completions BIGINT,
  unique_users BIGINT,
  completion_rate NUMERIC,
  last_completed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_ts TIMESTAMPTZ := p_from::timestamptz;
  v_to_ts TIMESTAMPTZ := (p_to::timestamptz + interval '1 day');
  v_active_users BIGINT := 0;
BEGIN
  PERFORM public.admin_analytics_require_admin();

  IF to_regclass('public.tasks') IS NULL OR to_regclass('public.user_tasks') IS NULL THEN
    RETURN;
  END IF;

  v_active_users := public.admin_analytics_active_users_count(v_from_ts, v_to_ts);

  RETURN QUERY
  SELECT
    t.id,
    t.title,
    COALESCE(COUNT(ut.id), 0)::BIGINT AS completions,
    COALESCE(COUNT(DISTINCT ut.user_id), 0)::BIGINT AS unique_users,
    CASE WHEN v_active_users > 0
      THEN ROUND((COUNT(DISTINCT ut.user_id)::numeric / v_active_users::numeric) * 100, 1)
      ELSE 0 END AS completion_rate,
    MAX(ut.completed_at) AS last_completed_at
  FROM public.tasks t
  LEFT JOIN public.user_tasks ut
    ON ut.task_id = t.id
   AND ut.completed_at >= v_from_ts
   AND ut.completed_at < v_to_ts
  GROUP BY t.id, t.title
  ORDER BY completions DESC, unique_users DESC
  LIMIT p_limit;
END;
$$;

-- ---------------------------------------------------------------------------
-- 11) Event health
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_analytics_event_health(DATE, DATE);
CREATE OR REPLACE FUNCTION public.admin_analytics_event_health(
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (
  event_type TEXT,
  event_count BIGINT,
  unique_users BIGINT,
  with_user_id_pct NUMERIC,
  last_seen_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_analytics_require_admin();

  IF to_regclass('public.user_events') IS NOT NULL THEN
    RETURN QUERY
    SELECT
      ue.event_type,
      COUNT(*)::BIGINT AS event_count,
      COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text))::BIGINT AS unique_users,
      ROUND((COUNT(*) FILTER (WHERE ue.user_id IS NOT NULL)::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100, 1) AS with_user_id_pct,
      MAX(ue.created_at) AS last_seen_at
    FROM public.user_events ue
    WHERE ue.created_at::date >= p_from
      AND ue.created_at::date <= p_to
    GROUP BY ue.event_type
    ORDER BY event_count DESC;
    RETURN;
  END IF;

  IF to_regclass('public.events') IS NOT NULL THEN
    RETURN QUERY
    SELECT
      e.event_type,
      COUNT(*)::BIGINT AS event_count,
      COUNT(DISTINCT e.user_id)::BIGINT AS unique_users,
      ROUND((COUNT(*) FILTER (WHERE e.user_id IS NOT NULL)::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100, 1) AS with_user_id_pct,
      MAX(e.created_at) AS last_seen_at
    FROM public.events e
    WHERE e.created_at::date >= p_from
      AND e.created_at::date <= p_to
    GROUP BY e.event_type
    ORDER BY event_count DESC;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Permissions (authenticated only)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.admin_analytics_require_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_active_users_count(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.admin_analytics_overview(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_timeseries(DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_funnel_quiz(DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_funnel_tests(DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_top_quizzes(DATE, DATE, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_top_tests(DATE, DATE, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_sources(DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_screen_transitions(DATE, DATE, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_predictions(DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_tasks(DATE, DATE, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_event_health(DATE, DATE) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_analytics_overview(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_timeseries(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_funnel_quiz(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_funnel_tests(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_top_quizzes(DATE, DATE, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_top_tests(DATE, DATE, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_sources(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_screen_transitions(DATE, DATE, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_predictions(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_tasks(DATE, DATE, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_event_health(DATE, DATE) TO authenticated;
