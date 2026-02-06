-- Prediction create eligibility refresh:
-- 1) robust completion counting fallback,
-- 2) admin bypass for create gating,
-- 3) optional admin-selected squad for create RPC.

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

    SELECT COUNT(*) INTO v_quiz_count
    FROM public.quiz_results qr
    WHERE qr.user_id = p_user_id;

    SELECT COUNT(*) INTO v_test_count
    FROM public.personality_test_completions ptc
    WHERE ptc.user_id = p_user_id;

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

  IF NOT v_is_admin THEN
    IF v_total_completed < v_required_count THEN
      v_blocking_reason := 'need_progress';
    ELSIF NOT v_has_squad THEN
      v_blocking_reason := 'need_squad';
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

DROP FUNCTION IF EXISTS public.prediction_create_poll(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS public.prediction_create_poll(UUID, TEXT, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION public.prediction_create_poll(
  p_user_id UUID,
  p_title TEXT,
  p_option_a_label TEXT,
  p_option_b_label TEXT,
  p_squad_id UUID DEFAULT NULL,
  p_cover_image_url TEXT DEFAULT NULL,
  p_deadline_at TIMESTAMPTZ DEFAULT NULL,
  p_stake_enabled BOOLEAN DEFAULT true,
  p_vote_enabled BOOLEAN DEFAULT true
)
RETURNS TABLE (
  success BOOLEAN,
  poll_id UUID,
  error_code TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eligibility RECORD;
  v_poll_id UUID;
  v_deadline TIMESTAMPTZ;
  v_manual_enabled BOOLEAN := true;
  v_initial_status TEXT := 'pending';
  v_target_squad_id UUID := NULL;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'auth_required', 'Требуется профиль пользователя';
    RETURN;
  END IF;

  SELECT * INTO v_eligibility
  FROM public.prediction_get_creation_eligibility(p_user_id);

  IF COALESCE(v_eligibility.is_admin, false) THEN
    v_target_squad_id := COALESCE(p_squad_id, v_eligibility.squad_id);

    IF v_target_squad_id IS NULL THEN
      RETURN QUERY SELECT false, NULL::UUID, 'need_squad', 'Админу нужно выбрать сквад для публикации';
      RETURN;
    END IF;

    PERFORM 1
    FROM public.squads s
    WHERE s.id = v_target_squad_id;

    IF NOT FOUND THEN
      RETURN QUERY SELECT false, NULL::UUID, 'not_found', 'Сквад не найден';
      RETURN;
    END IF;
  ELSIF NOT COALESCE(v_eligibility.eligible, false) THEN
    RETURN QUERY
    SELECT
      false,
      NULL::UUID,
      COALESCE(v_eligibility.blocking_reason_code, 'forbidden'),
      'Недостаточно прав или не выполнены требования';
    RETURN;
  ELSE
    v_target_squad_id := v_eligibility.squad_id;
  END IF;

  IF trim(COALESCE(p_title, '')) = '' THEN
    RETURN QUERY SELECT false, NULL::UUID, 'validation_error', 'Укажите заголовок прогноза';
    RETURN;
  END IF;

  IF trim(COALESCE(p_option_a_label, '')) = '' OR trim(COALESCE(p_option_b_label, '')) = '' THEN
    RETURN QUERY SELECT false, NULL::UUID, 'validation_error', 'Укажите оба варианта исхода';
    RETURN;
  END IF;

  IF NOT p_stake_enabled AND NOT p_vote_enabled THEN
    RETURN QUERY SELECT false, NULL::UUID, 'validation_error', 'Должен быть включен хотя бы один режим участия';
    RETURN;
  END IF;

  v_deadline := COALESCE(p_deadline_at, now() + INTERVAL '24 hours');
  IF v_deadline <= (now() + INTERVAL '5 minutes') THEN
    RETURN QUERY SELECT false, NULL::UUID, 'validation_error', 'Дедлайн должен быть минимум через 5 минут';
    RETURN;
  END IF;

  v_manual_enabled := public.is_manual_moderation_enabled();
  v_initial_status := CASE WHEN v_manual_enabled THEN 'pending' ELSE 'open' END;

  INSERT INTO public.prediction_polls (
    squad_id,
    title,
    option_a_label,
    option_b_label,
    cover_image_url,
    deadline_at,
    status,
    created_by,
    submitted_at,
    stake_enabled,
    vote_enabled
  )
  VALUES (
    v_target_squad_id,
    trim(p_title),
    trim(p_option_a_label),
    trim(p_option_b_label),
    NULLIF(trim(COALESCE(p_cover_image_url, '')), ''),
    v_deadline,
    v_initial_status,
    p_user_id,
    CASE WHEN v_manual_enabled THEN now() ELSE NULL END,
    p_stake_enabled,
    p_vote_enabled
  )
  RETURNING id INTO v_poll_id;

  RETURN QUERY SELECT true, v_poll_id, NULL::TEXT, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.prediction_create_poll(UUID, TEXT, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ, BOOLEAN, BOOLEAN) TO authenticated;
