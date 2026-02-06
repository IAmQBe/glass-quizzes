-- Prediction market: gated create, eligibility checks and monthly quota

-- Ensure configurable monthly limit exists
INSERT INTO public.app_settings (key, value)
SELECT 'prediction_monthly_create_limit', '5'::json
WHERE NOT EXISTS (
  SELECT 1
  FROM public.app_settings
  WHERE key = 'prediction_monthly_create_limit'
);

-- Core prediction poll table
CREATE TABLE IF NOT EXISTS public.prediction_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  option_a_label TEXT NOT NULL,
  option_b_label TEXT NOT NULL,
  cover_image_url TEXT,
  deadline_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'draft',
    'open',
    'locked',
    'pending_resolution',
    'resolved',
    'cancelled',
    'invalid',
    'under_review'
  )),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  pool_a INT NOT NULL DEFAULT 0 CHECK (pool_a >= 0),
  pool_b INT NOT NULL DEFAULT 0 CHECK (pool_b >= 0),
  participant_count INT NOT NULL DEFAULT 0 CHECK (participant_count >= 0),

  resolved_option TEXT CHECK (resolved_option IN ('A', 'B')),
  proof_url TEXT,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  report_count INT NOT NULL DEFAULT 0 CHECK (report_count >= 0),
  is_hidden BOOLEAN NOT NULL DEFAULT false,

  fee_total_bp INT NOT NULL DEFAULT 700 CHECK (fee_total_bp >= 0),
  fee_creator_bp INT NOT NULL DEFAULT 200 CHECK (fee_creator_bp >= 0),
  refund_rate_bp INT NOT NULL DEFAULT 1500 CHECK (refund_rate_bp >= 0),
  min_participants INT NOT NULL DEFAULT 10 CHECK (min_participants >= 0),
  min_pool INT NOT NULL DEFAULT 500 CHECK (min_pool >= 0),
  stake_enabled BOOLEAN NOT NULL DEFAULT true,
  vote_enabled BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_prediction_polls_squad_id ON public.prediction_polls(squad_id);
CREATE INDEX IF NOT EXISTS idx_prediction_polls_status_deadline ON public.prediction_polls(status, deadline_at);
CREATE INDEX IF NOT EXISTS idx_prediction_polls_created_at ON public.prediction_polls(created_at DESC);

-- Per-user participation in a poll (stake or vote, never both)
CREATE TABLE IF NOT EXISTS public.prediction_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.prediction_polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('stake', 'vote')),
  option_choice TEXT NOT NULL CHECK (option_choice IN ('A', 'B')),
  stake_amount INT NOT NULL DEFAULT 0 CHECK (stake_amount >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'settled', 'cancelled')),
  payout_amount INT NOT NULL DEFAULT 0 CHECK (payout_amount >= 0),
  refund_amount INT NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
  reputation_reward INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ,
  UNIQUE(poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_prediction_participations_user_id ON public.prediction_participations(user_id);

-- User wallet for prediction market
CREATE TABLE IF NOT EXISTS public.prediction_wallets (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  available_balance INT NOT NULL DEFAULT 0,
  frozen_balance INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wallet ledger for auditable balance changes
CREATE TABLE IF NOT EXISTS public.prediction_wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  poll_id UUID REFERENCES public.prediction_polls(id) ON DELETE SET NULL,
  participation_id UUID REFERENCES public.prediction_participations(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'seed',
    'stake_freeze',
    'stake_unfreeze',
    'refund',
    'payout',
    'admin_adjustment'
  )),
  amount INT NOT NULL,
  available_after INT NOT NULL,
  frozen_after INT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prediction_wallet_ledger_user_id ON public.prediction_wallet_ledger(user_id, created_at DESC);

-- Moderation reports for polls
CREATE TABLE IF NOT EXISTS public.prediction_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.prediction_polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

-- Keep updated_at fresh
DROP TRIGGER IF EXISTS trigger_prediction_polls_updated_at ON public.prediction_polls;
CREATE TRIGGER trigger_prediction_polls_updated_at
BEFORE UPDATE ON public.prediction_polls
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_prediction_wallets_updated_at ON public.prediction_wallets;
CREATE TRIGGER trigger_prediction_wallets_updated_at
BEFORE UPDATE ON public.prediction_wallets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.prediction_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read prediction polls" ON public.prediction_polls;
CREATE POLICY "Anyone can read prediction polls"
ON public.prediction_polls FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Anyone can read prediction participations" ON public.prediction_participations;
CREATE POLICY "Anyone can read prediction participations"
ON public.prediction_participations FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Anyone can read prediction wallets" ON public.prediction_wallets;
CREATE POLICY "Anyone can read prediction wallets"
ON public.prediction_wallets FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Anyone can read prediction wallet ledger" ON public.prediction_wallet_ledger;
CREATE POLICY "Anyone can read prediction wallet ledger"
ON public.prediction_wallet_ledger FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Anyone can read prediction reports" ON public.prediction_reports;
CREATE POLICY "Anyone can read prediction reports"
ON public.prediction_reports FOR SELECT
USING (true);

-- Helper: monthly limit from app_settings
CREATE OR REPLACE FUNCTION public.prediction_get_monthly_create_limit()
RETURNS INT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_value JSONB;
  v_limit INT;
BEGIN
  SELECT value::jsonb
  INTO v_value
  FROM public.app_settings
  WHERE key = 'prediction_monthly_create_limit'
  LIMIT 1;

  IF v_value IS NULL THEN
    RETURN 5;
  END IF;

  IF jsonb_typeof(v_value) = 'number' THEN
    RETURN GREATEST((v_value::text)::int, 1);
  END IF;

  IF jsonb_typeof(v_value) = 'string' THEN
    RETURN GREATEST((trim(BOTH '"' FROM v_value::text))::int, 1);
  END IF;

  IF jsonb_typeof(v_value) = 'object' AND v_value ? 'limit' THEN
    RETURN GREATEST((v_value->>'limit')::int, 1);
  END IF;

  RETURN 5;
EXCEPTION
  WHEN others THEN
    RETURN 5;
END;
$$;

-- Quota by squad (calendar month in UTC)
CREATE OR REPLACE FUNCTION public.prediction_get_squad_monthly_quota(p_squad_id UUID)
RETURNS TABLE (
  monthly_limit INT,
  used_this_month INT,
  remaining_this_month INT,
  resets_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT;
  v_used INT := 0;
  v_month_start_utc TIMESTAMP;
  v_month_start TIMESTAMPTZ;
  v_month_end TIMESTAMPTZ;
BEGIN
  v_limit := public.prediction_get_monthly_create_limit();
  v_month_start_utc := date_trunc('month', now() AT TIME ZONE 'UTC');
  v_month_start := v_month_start_utc AT TIME ZONE 'UTC';
  v_month_end := (v_month_start_utc + INTERVAL '1 month') AT TIME ZONE 'UTC';

  IF p_squad_id IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_used
    FROM public.prediction_polls pp
    WHERE pp.squad_id = p_squad_id
      AND pp.created_at >= v_month_start
      AND pp.created_at < v_month_end;
  END IF;

  RETURN QUERY
  SELECT
    v_limit,
    v_used,
    GREATEST(v_limit - v_used, 0),
    v_month_end;
END;
$$;

-- Eligibility for create flow (N=3, squad captain/admin, monthly quota, cooldown)
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
    SELECT p.squad_id, s.title, (s.created_by = p_user_id)
    INTO v_squad_id, v_squad_title, v_is_captain
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

  IF v_total_completed < v_required_count AND NOT v_is_admin THEN
    v_blocking_reason := 'need_progress';
  ELSIF NOT v_has_squad THEN
    v_blocking_reason := 'need_squad';
  ELSIF NOT (v_is_captain OR v_is_admin) THEN
    v_blocking_reason := 'need_captain';
  ELSIF v_remaining_this_month <= 0 THEN
    v_blocking_reason := 'month_limit';
  ELSIF v_cooldown_hours_left > 0 THEN
    v_blocking_reason := 'cooldown';
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

-- Create poll with server-side eligibility checks
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
    'open',
    p_user_id,
    p_stake_enabled,
    p_vote_enabled
  )
  RETURNING id INTO v_poll_id;

  RETURN QUERY SELECT true, v_poll_id, NULL::TEXT, NULL::TEXT;
END;
$$;

-- Wallet bootstrap/read API for frontend
CREATE OR REPLACE FUNCTION public.prediction_get_user_wallet(p_user_id UUID)
RETURNS TABLE (
  available_balance INT,
  frozen_balance INT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN QUERY SELECT 0, 0, now();
    RETURN;
  END IF;

  INSERT INTO public.prediction_wallets (user_id, available_balance, frozen_balance)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY
  SELECT w.available_balance, w.frozen_balance, w.updated_at
  FROM public.prediction_wallets w
  WHERE w.user_id = p_user_id
  LIMIT 1;
END;
$$;

