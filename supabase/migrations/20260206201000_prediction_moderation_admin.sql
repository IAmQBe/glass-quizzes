-- Prediction moderation: pre/post admin workflow, reporting and visibility rules

-- 1) Extend status model for pre-moderation
ALTER TABLE public.prediction_polls
DROP CONSTRAINT IF EXISTS prediction_polls_status_check;

ALTER TABLE public.prediction_polls
ADD CONSTRAINT prediction_polls_status_check CHECK (status IN (
  'draft',
  'pending',
  'rejected',
  'open',
  'locked',
  'pending_resolution',
  'resolved',
  'cancelled',
  'invalid',
  'under_review'
));

-- 2) Moderation metadata
ALTER TABLE public.prediction_polls
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

UPDATE public.prediction_polls
SET submitted_at = COALESCE(submitted_at, created_at)
WHERE submitted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_prediction_polls_status_created_at
  ON public.prediction_polls(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_polls_report_count
  ON public.prediction_polls(report_count);
CREATE INDEX IF NOT EXISTS idx_prediction_reports_poll_id
  ON public.prediction_reports(poll_id);

-- 3) Visibility policy: pending/rejected only for admin + author
DROP POLICY IF EXISTS "Anyone can read prediction polls" ON public.prediction_polls;
DROP POLICY IF EXISTS "Prediction polls visibility with moderation" ON public.prediction_polls;

CREATE POLICY "Prediction polls visibility with moderation"
ON public.prediction_polls FOR SELECT
USING (
  status NOT IN ('pending', 'rejected')
  OR created_by = auth.uid()
  OR public.is_admin(auth.uid())
);

-- 4) Reporting insert policy
DROP POLICY IF EXISTS "Users can report prediction polls" ON public.prediction_reports;

CREATE POLICY "Users can report prediction polls"
ON public.prediction_reports FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- 5) Create poll in pending state
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
    'pending',
    p_user_id,
    now(),
    p_stake_enabled,
    p_vote_enabled
  )
  RETURNING id INTO v_poll_id;

  RETURN QUERY SELECT true, v_poll_id, NULL::TEXT, NULL::TEXT;
END;
$$;

-- 6) Unified admin moderation action RPC
CREATE OR REPLACE FUNCTION public.prediction_admin_moderate_poll(
  p_poll_id UUID,
  p_action TEXT,
  p_resolved_option TEXT DEFAULT NULL,
  p_proof_url TEXT DEFAULT NULL,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  poll_id UUID,
  next_status TEXT,
  error_code TEXT,
  error_message TEXT,
  updated_poll JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_poll public.prediction_polls%ROWTYPE;
  v_action TEXT := lower(trim(COALESCE(p_action, '')));
  v_rejection_reason TEXT := NULLIF(trim(COALESCE(p_rejection_reason, '')), '');
  v_proof_url TEXT := NULLIF(trim(COALESCE(p_proof_url, '')), '');
  v_outcome TEXT := upper(trim(COALESCE(p_resolved_option, '')));
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false, p_poll_id, NULL::TEXT, 'auth_required', 'Нужна авторизация', NULL::JSONB;
    RETURN;
  END IF;

  IF NOT public.is_admin(auth.uid()) THEN
    RETURN QUERY SELECT false, p_poll_id, NULL::TEXT, 'forbidden', 'Только админ может модерировать прогноз', NULL::JSONB;
    RETURN;
  END IF;

  SELECT *
  INTO v_poll
  FROM public.prediction_polls
  WHERE id = p_poll_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, p_poll_id, NULL::TEXT, 'not_found', 'Прогноз не найден', NULL::JSONB;
    RETURN;
  END IF;

  IF v_action = 'approve' THEN
    IF v_poll.status NOT IN ('pending', 'rejected') THEN
      RETURN QUERY SELECT false, v_poll.id, v_poll.status, 'invalid_transition', 'Approve доступен только для pending/rejected', to_jsonb(v_poll);
      RETURN;
    END IF;

    UPDATE public.prediction_polls
    SET
      status = 'open',
      rejection_reason = NULL,
      moderated_by = auth.uid(),
      moderated_at = now()
    WHERE id = v_poll.id
    RETURNING * INTO v_poll;

  ELSIF v_action = 'reject' THEN
    IF v_poll.status <> 'pending' THEN
      RETURN QUERY SELECT false, v_poll.id, v_poll.status, 'invalid_transition', 'Reject доступен только для pending', to_jsonb(v_poll);
      RETURN;
    END IF;

    IF v_rejection_reason IS NULL THEN
      RETURN QUERY SELECT false, v_poll.id, v_poll.status, 'validation_error', 'Причина отклонения обязательна', to_jsonb(v_poll);
      RETURN;
    END IF;

    UPDATE public.prediction_polls
    SET
      status = 'rejected',
      rejection_reason = v_rejection_reason,
      moderated_by = auth.uid(),
      moderated_at = now()
    WHERE id = v_poll.id
    RETURNING * INTO v_poll;

  ELSIF v_action = 'close_stakes' THEN
    IF v_poll.status <> 'open' THEN
      RETURN QUERY SELECT false, v_poll.id, v_poll.status, 'invalid_transition', 'Close stakes доступен только для open', to_jsonb(v_poll);
      RETURN;
    END IF;

    UPDATE public.prediction_polls
    SET
      status = 'locked',
      moderated_by = auth.uid(),
      moderated_at = now()
    WHERE id = v_poll.id
    RETURNING * INTO v_poll;

  ELSIF v_action = 'set_pending_resolution' THEN
    IF v_poll.status NOT IN ('locked', 'under_review') THEN
      RETURN QUERY SELECT false, v_poll.id, v_poll.status, 'invalid_transition', 'set_pending_resolution доступен только для locked/under_review', to_jsonb(v_poll);
      RETURN;
    END IF;

    UPDATE public.prediction_polls
    SET
      status = 'pending_resolution',
      moderated_by = auth.uid(),
      moderated_at = now()
    WHERE id = v_poll.id
    RETURNING * INTO v_poll;

  ELSIF v_action = 'set_under_review' THEN
    IF v_poll.status NOT IN ('open', 'locked', 'pending_resolution') THEN
      RETURN QUERY SELECT false, v_poll.id, v_poll.status, 'invalid_transition', 'set_under_review доступен только для open/locked/pending_resolution', to_jsonb(v_poll);
      RETURN;
    END IF;

    UPDATE public.prediction_polls
    SET
      status = 'under_review',
      moderated_by = auth.uid(),
      moderated_at = now()
    WHERE id = v_poll.id
    RETURNING * INTO v_poll;

  ELSIF v_action = 'resolve' THEN
    IF v_poll.status NOT IN ('locked', 'pending_resolution', 'under_review') THEN
      RETURN QUERY SELECT false, v_poll.id, v_poll.status, 'invalid_transition', 'Resolve доступен только для locked/pending_resolution/under_review', to_jsonb(v_poll);
      RETURN;
    END IF;

    IF v_outcome NOT IN ('A', 'B') THEN
      RETURN QUERY SELECT false, v_poll.id, v_poll.status, 'validation_error', 'Укажите исход A или B', to_jsonb(v_poll);
      RETURN;
    END IF;

    IF v_proof_url IS NULL OR v_proof_url !~* '^https?://' THEN
      RETURN QUERY SELECT false, v_poll.id, v_poll.status, 'validation_error', 'Нужна валидная ссылка-dоказательство (http/https)', to_jsonb(v_poll);
      RETURN;
    END IF;

    UPDATE public.prediction_polls
    SET
      status = 'resolved',
      resolved_option = v_outcome,
      proof_url = v_proof_url,
      resolved_by = auth.uid(),
      resolved_at = now(),
      moderated_by = auth.uid(),
      moderated_at = now()
    WHERE id = v_poll.id
    RETURNING * INTO v_poll;

  ELSIF v_action = 'cancel' THEN
    IF v_poll.status NOT IN ('pending', 'open', 'locked', 'pending_resolution', 'under_review') THEN
      RETURN QUERY SELECT false, v_poll.id, v_poll.status, 'invalid_transition', 'Cancel недоступен для текущего статуса', to_jsonb(v_poll);
      RETURN;
    END IF;

    UPDATE public.prediction_polls
    SET
      status = 'cancelled',
      moderated_by = auth.uid(),
      moderated_at = now()
    WHERE id = v_poll.id
    RETURNING * INTO v_poll;

  ELSIF v_action = 'toggle_hidden' THEN
    UPDATE public.prediction_polls
    SET
      is_hidden = NOT v_poll.is_hidden,
      moderated_by = auth.uid(),
      moderated_at = now()
    WHERE id = v_poll.id
    RETURNING * INTO v_poll;

  ELSE
    RETURN QUERY SELECT false, v_poll.id, v_poll.status, 'invalid_action', 'Неизвестное действие модерации', to_jsonb(v_poll);
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_poll.id, v_poll.status, NULL::TEXT, NULL::TEXT, to_jsonb(v_poll);
END;
$$;

-- 7) Report RPC with auto-transition to under_review
CREATE OR REPLACE FUNCTION public.prediction_report_poll(
  p_poll_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  poll_id UUID,
  report_count INT,
  transitioned_to_under_review BOOLEAN,
  next_status TEXT,
  error_code TEXT,
  error_message TEXT,
  updated_poll JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_poll public.prediction_polls%ROWTYPE;
  v_rows INT := 0;
  v_report_count INT := 0;
  v_transitioned BOOLEAN := false;
  v_reason TEXT := NULLIF(trim(COALESCE(p_reason, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false, p_poll_id, 0, false, NULL::TEXT, 'auth_required', 'Нужна авторизация', NULL::JSONB;
    RETURN;
  END IF;

  SELECT *
  INTO v_poll
  FROM public.prediction_polls
  WHERE id = p_poll_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, p_poll_id, 0, false, NULL::TEXT, 'not_found', 'Прогноз не найден', NULL::JSONB;
    RETURN;
  END IF;

  IF v_poll.status NOT IN ('open', 'locked', 'pending_resolution', 'under_review') THEN
    RETURN QUERY SELECT false, v_poll.id, v_poll.report_count, false, v_poll.status, 'invalid_state', 'Репорт доступен только для активных прогнозов', to_jsonb(v_poll);
    RETURN;
  END IF;

  INSERT INTO public.prediction_reports (poll_id, user_id, reason)
  VALUES (v_poll.id, auth.uid(), v_reason)
  ON CONFLICT (poll_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RETURN QUERY SELECT false, v_poll.id, v_poll.report_count, false, v_poll.status, 'already_reported', 'Вы уже отправляли репорт по этому прогнозу', to_jsonb(v_poll);
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO v_report_count
  FROM public.prediction_reports
  WHERE poll_id = v_poll.id;

  IF v_report_count >= 5 AND v_poll.status IN ('open', 'locked', 'pending_resolution') THEN
    UPDATE public.prediction_polls
    SET
      report_count = v_report_count,
      status = 'under_review'
    WHERE id = v_poll.id
    RETURNING * INTO v_poll;

    v_transitioned := true;
  ELSE
    UPDATE public.prediction_polls
    SET report_count = v_report_count
    WHERE id = v_poll.id
    RETURNING * INTO v_poll;
  END IF;

  RETURN QUERY SELECT true, v_poll.id, v_poll.report_count, v_transitioned, v_poll.status, NULL::TEXT, NULL::TEXT, to_jsonb(v_poll);
END;
$$;

GRANT EXECUTE ON FUNCTION public.prediction_admin_moderate_poll(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prediction_report_poll(UUID, TEXT) TO authenticated;
