-- Hotfix: eligibility counting + admin bypass bootstrap for prediction create flow

CREATE OR REPLACE FUNCTION public.prediction_get_creation_eligibility(p_user_id UUID)
RETURNS TABLE (
  eligible BOOLEAN,
  required_completed_count INT,
  completed_count INT,
  has_squad BOOLEAN,
  squad_id UUID,
  squad_title TEXT,
  is_squad_captain BOOLEAN,
  is_admin BOOLEAN,
  monthly_limit INT,
  used_this_month INT,
  remaining_this_month INT,
  cooldown_hours_left INT,
  next_available_at TIMESTAMPTZ,
  blocking_reason_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required_count INT := 3;
  v_quiz_count INT := 0;
  v_quiz_event_count INT := 0;
  v_test_count INT := 0;
  v_has_squad BOOLEAN := false;
  v_squad_id UUID := NULL;
  v_squad_title TEXT := NULL;
  v_is_captain BOOLEAN := false;
  v_is_admin BOOLEAN := false;
  v_monthly_limit INT := 5;
  v_used_this_month INT := 0;
  v_remaining_this_month INT := 5;
  v_cooldown_hours_left INT := 0;
  v_next_available_at TIMESTAMPTZ := NULL;
  v_blocking_reason TEXT := NULL;
  v_last_created_at TIMESTAMPTZ := NULL;
  v_total_completed INT := 0;
  v_profile_exists BOOLEAN := false;
  v_telegram_id BIGINT := NULL;
  v_any_admin_exists BOOLEAN := false;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN QUERY SELECT
      false, v_required_count, 0, false, NULL::UUID, NULL::TEXT, false, false, 5, 0, 5, 0, NULL::TIMESTAMPTZ, 'need_squad';
    RETURN;
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
  )
  INTO v_profile_exists;

  SELECT EXISTS(
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role = 'admin'
  )
  INTO v_is_admin;

  IF v_profile_exists THEN
    SELECT p.squad_id, s.title, (s.created_by = p_user_id), p.telegram_id
    INTO v_squad_id, v_squad_title, v_is_captain, v_telegram_id
    FROM public.profiles p
    LEFT JOIN public.squads s ON s.id = p.squad_id
    WHERE p.id = p_user_id;

    v_has_squad := v_squad_id IS NOT NULL;

    -- Base completion sources
    SELECT COUNT(*) INTO v_quiz_count
    FROM public.quiz_results qr
    WHERE qr.user_id = p_user_id;

    SELECT COUNT(*) INTO v_test_count
    FROM public.personality_test_completions ptc
    WHERE ptc.user_id = p_user_id;

    -- Fallback: track quiz completions by telemetry events if quiz_results not present
    IF v_telegram_id IS NOT NULL AND to_regclass('public.user_events') IS NOT NULL THEN
      SELECT COUNT(DISTINCT ue.quiz_id)
      INTO v_quiz_event_count
      FROM public.user_events ue
      WHERE ue.telegram_id = v_telegram_id
        AND ue.quiz_id IS NOT NULL
        AND ue.event_type IN ('quiz_complete', 'quiz_completed');

      v_quiz_count := GREATEST(v_quiz_count, v_quiz_event_count);
    END IF;
  END IF;

  -- Admin bootstrap for testing/dev environments: if no admins exist, current caller becomes admin.
  SELECT EXISTS(
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.role = 'admin'
  )
  INTO v_any_admin_exists;

  IF NOT v_is_admin AND NOT v_any_admin_exists THEN
    v_is_admin := true;

    BEGIN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (p_user_id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    EXCEPTION
      WHEN others THEN
        -- If role insert is unavailable in this environment, keep virtual admin for this response.
        NULL;
    END;
  END IF;

  v_total_completed := v_quiz_count + v_test_count;

  IF v_has_squad THEN
    SELECT q.monthly_limit, q.used_this_month, q.remaining_this_month
    INTO v_monthly_limit, v_used_this_month, v_remaining_this_month
    FROM public.prediction_get_squad_monthly_quota(v_squad_id) q;

    SELECT MAX(pp.created_at)
    INTO v_last_created_at
    FROM public.prediction_polls pp
    WHERE pp.squad_id = v_squad_id;

    IF v_last_created_at IS NOT NULL AND (v_last_created_at + INTERVAL '48 hours') > now() THEN
      v_next_available_at := v_last_created_at + INTERVAL '48 hours';
      v_cooldown_hours_left := CEIL(EXTRACT(EPOCH FROM (v_next_available_at - now())) / 3600.0);
    END IF;
  ELSE
    v_monthly_limit := public.prediction_get_monthly_create_limit();
    v_used_this_month := 0;
    v_remaining_this_month := v_monthly_limit;
  END IF;

  -- Admin bypass: skips progress/captain/month-limit/cooldown checks, but still requires squad context.
  IF NOT v_has_squad THEN
    v_blocking_reason := 'need_squad';
  ELSIF NOT v_is_admin THEN
    IF v_total_completed < v_required_count THEN
      v_blocking_reason := 'need_progress';
    ELSIF NOT v_is_captain THEN
      v_blocking_reason := 'need_captain';
    ELSIF v_remaining_this_month <= 0 THEN
      v_blocking_reason := 'month_limit';
    ELSIF v_cooldown_hours_left > 0 THEN
      v_blocking_reason := 'cooldown';
    END IF;
  END IF;

  RETURN QUERY SELECT
    v_blocking_reason IS NULL,
    v_required_count,
    v_total_completed,
    v_has_squad,
    v_squad_id,
    v_squad_title,
    v_is_captain,
    v_is_admin,
    v_monthly_limit,
    v_used_this_month,
    v_remaining_this_month,
    v_cooldown_hours_left,
    v_next_available_at,
    v_blocking_reason;
END;
$$;
