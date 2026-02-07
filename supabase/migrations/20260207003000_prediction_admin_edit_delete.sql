-- Prediction polls: admin edit/delete helpers

-- Admin can update core poll fields. Uses SECURITY DEFINER because prediction_polls has RLS.
CREATE OR REPLACE FUNCTION public.prediction_admin_update_poll(
  p_poll_id UUID,
  p_title TEXT DEFAULT NULL,
  p_option_a_label TEXT DEFAULT NULL,
  p_option_b_label TEXT DEFAULT NULL,
  p_cover_image_url TEXT DEFAULT NULL,
  p_deadline_at TIMESTAMPTZ DEFAULT NULL,
  p_stake_enabled BOOLEAN DEFAULT NULL,
  p_vote_enabled BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  poll_id UUID,
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
  v_title TEXT;
  v_option_a TEXT;
  v_option_b TEXT;
  v_cover TEXT;
  v_deadline TIMESTAMPTZ;
  v_stake BOOLEAN;
  v_vote BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false, p_poll_id, 'auth_required', 'Нужна авторизация', NULL::JSONB;
    RETURN;
  END IF;

  IF NOT public.is_admin(auth.uid()) THEN
    RETURN QUERY SELECT false, p_poll_id, 'forbidden', 'Только админ может редактировать событие', NULL::JSONB;
    RETURN;
  END IF;

  SELECT *
  INTO v_poll
  FROM public.prediction_polls
  WHERE id = p_poll_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, p_poll_id, 'not_found', 'Событие не найдено', NULL::JSONB;
    RETURN;
  END IF;

  v_title := COALESCE(NULLIF(trim(COALESCE(p_title, '')), ''), v_poll.title);
  v_option_a := COALESCE(NULLIF(trim(COALESCE(p_option_a_label, '')), ''), v_poll.option_a_label);
  v_option_b := COALESCE(NULLIF(trim(COALESCE(p_option_b_label, '')), ''), v_poll.option_b_label);

  v_cover := CASE
    WHEN p_cover_image_url IS NULL THEN v_poll.cover_image_url
    WHEN trim(p_cover_image_url) = '' THEN NULL
    ELSE trim(p_cover_image_url)
  END;

  v_deadline := COALESCE(p_deadline_at, v_poll.deadline_at);
  v_stake := COALESCE(p_stake_enabled, v_poll.stake_enabled);
  v_vote := COALESCE(p_vote_enabled, v_poll.vote_enabled);

  IF v_stake IS FALSE AND v_vote IS FALSE THEN
    RETURN QUERY SELECT false, v_poll.id, 'validation_error', 'Должен быть включен хотя бы один режим участия', to_jsonb(v_poll);
    RETURN;
  END IF;

  IF v_deadline < (now() - INTERVAL '1 minute') THEN
    RETURN QUERY SELECT false, v_poll.id, 'validation_error', 'Дедлайн не может быть в прошлом', to_jsonb(v_poll);
    RETURN;
  END IF;

  UPDATE public.prediction_polls
  SET
    title = v_title,
    option_a_label = v_option_a,
    option_b_label = v_option_b,
    cover_image_url = v_cover,
    deadline_at = v_deadline,
    stake_enabled = v_stake,
    vote_enabled = v_vote,
    moderated_by = auth.uid(),
    moderated_at = now()
  WHERE id = v_poll.id
  RETURNING * INTO v_poll;

  RETURN QUERY SELECT true, v_poll.id, NULL::TEXT, NULL::TEXT, to_jsonb(v_poll);
END;
$$;

GRANT EXECUTE ON FUNCTION public.prediction_admin_update_poll(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, BOOLEAN) TO authenticated;

-- Admin delete helper: hard delete only when there are no participants/pool.
-- Otherwise, cancel + hide to keep referential integrity and avoid accidental loss of data.
CREATE OR REPLACE FUNCTION public.prediction_admin_delete_poll(
  p_poll_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  poll_id UUID,
  operation TEXT,
  error_code TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_poll public.prediction_polls%ROWTYPE;
  v_participations INT := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false, p_poll_id, NULL::TEXT, 'auth_required', 'Нужна авторизация';
    RETURN;
  END IF;

  IF NOT public.is_admin(auth.uid()) THEN
    RETURN QUERY SELECT false, p_poll_id, NULL::TEXT, 'forbidden', 'Только админ может удалять событие';
    RETURN;
  END IF;

  SELECT *
  INTO v_poll
  FROM public.prediction_polls
  WHERE id = p_poll_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, p_poll_id, NULL::TEXT, 'not_found', 'Событие не найдено';
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO v_participations
  FROM public.prediction_participations pp
  WHERE pp.poll_id = v_poll.id;

  IF v_participations = 0 AND v_poll.pool_a = 0 AND v_poll.pool_b = 0 THEN
    DELETE FROM public.prediction_polls
    WHERE id = v_poll.id;

    RETURN QUERY SELECT true, v_poll.id, 'deleted', NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  UPDATE public.prediction_polls
  SET
    status = 'cancelled',
    is_hidden = true,
    moderated_by = auth.uid(),
    moderated_at = now()
  WHERE id = v_poll.id;

  RETURN QUERY SELECT true, v_poll.id, 'cancelled_hidden', NULL::TEXT, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.prediction_admin_delete_poll(UUID) TO authenticated;

