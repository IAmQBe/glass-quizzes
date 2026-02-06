-- Global moderation toggle:
-- true  -> user-created content goes to manual moderation
-- false -> user-created content is auto-published

INSERT INTO public.app_settings (key, value)
SELECT 'moderation_settings', '{"manual_moderation_enabled": true}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_settings WHERE key = 'moderation_settings'
);

CREATE OR REPLACE FUNCTION public.is_manual_moderation_enabled()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH settings AS (
    SELECT value
    FROM public.app_settings
    WHERE key = 'moderation_settings'
    LIMIT 1
  )
  SELECT COALESCE(
    (
      SELECT
        CASE
          WHEN jsonb_typeof(value) = 'object'
            AND lower(COALESCE(value->>'manual_moderation_enabled', '')) IN ('true', 'false')
            THEN (value->>'manual_moderation_enabled')::boolean
          WHEN jsonb_typeof(value) = 'object'
            AND lower(COALESCE(value->>'enabled', '')) IN ('true', 'false')
            THEN (value->>'enabled')::boolean
          WHEN jsonb_typeof(value) = 'boolean'
            THEN value::text::boolean
          ELSE true
        END
      FROM settings
    ),
    true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_manual_moderation_enabled() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_quiz_moderation_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manual_enabled BOOLEAN := true;
  v_is_admin BOOLEAN := false;
BEGIN
  v_manual_enabled := public.is_manual_moderation_enabled();

  IF auth.uid() IS NOT NULL THEN
    v_is_admin := public.is_admin(auth.uid());
  END IF;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  IF v_manual_enabled THEN
    NEW.is_published := false;
    NEW.status := 'pending';
    IF NEW.submitted_at IS NULL THEN
      NEW.submitted_at := now();
    END IF;
  ELSE
    NEW.is_published := true;
    NEW.status := 'published';
    NEW.rejection_reason := NULL;
    NEW.moderated_at := COALESCE(NEW.moderated_at, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_quiz_moderation_policy ON public.quizzes;
CREATE TRIGGER trg_apply_quiz_moderation_policy
BEFORE INSERT ON public.quizzes
FOR EACH ROW
EXECUTE FUNCTION public.apply_quiz_moderation_policy();

CREATE OR REPLACE FUNCTION public.apply_personality_test_moderation_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manual_enabled BOOLEAN := true;
  v_is_admin BOOLEAN := false;
BEGIN
  v_manual_enabled := public.is_manual_moderation_enabled();

  IF auth.uid() IS NOT NULL THEN
    v_is_admin := public.is_admin(auth.uid());
  END IF;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  IF v_manual_enabled THEN
    NEW.is_published := false;
  ELSE
    NEW.is_published := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_personality_test_moderation_policy ON public.personality_tests;
CREATE TRIGGER trg_apply_personality_test_moderation_policy
BEFORE INSERT ON public.personality_tests
FOR EACH ROW
EXECUTE FUNCTION public.apply_personality_test_moderation_policy();

CREATE OR REPLACE FUNCTION public.prediction_create_poll(
  p_user_id UUID,
  p_title TEXT,
  p_option_a_label TEXT,
  p_option_b_label TEXT,
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
BEGIN
  IF p_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'auth_required', 'Требуется профиль пользователя';
    RETURN;
  END IF;

  SELECT * INTO v_eligibility
  FROM public.prediction_get_creation_eligibility(p_user_id);

  IF NOT COALESCE(v_eligibility.eligible, false) THEN
    RETURN QUERY
    SELECT
      false,
      NULL::UUID,
      COALESCE(v_eligibility.blocking_reason_code, 'forbidden'),
      'Недостаточно прав или не выполнены требования';
    RETURN;
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
    v_eligibility.squad_id,
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

GRANT EXECUTE ON FUNCTION public.prediction_create_poll(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, BOOLEAN) TO authenticated;
