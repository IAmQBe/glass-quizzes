-- ============================================
-- AI generation quota + payments (Telegram Stars)
-- ============================================
-- Free quota: 3 quiz generations + 3 personality test generations (lifetime, per telegram_id).
-- Paid: credits, 1 credit = 1 generation request (always returns 3 variants).

-- 1) Quotas table
CREATE TABLE IF NOT EXISTS public.ai_generation_quotas (
  telegram_id BIGINT PRIMARY KEY,
  free_quiz_used INT NOT NULL DEFAULT 0,
  free_test_used INT NOT NULL DEFAULT 0,
  paid_credits INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Payments table (idempotency + analytics)
CREATE TABLE IF NOT EXISTS public.ai_generation_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT NOT NULL,
  invoice_payload TEXT NOT NULL,
  currency TEXT NOT NULL,
  total_amount INT NOT NULL,
  telegram_payment_charge_id TEXT NOT NULL UNIQUE,
  provider_payment_charge_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_generation_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_payments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RPC: Get quota snapshot (service-role only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.ai_get_quota(p_telegram_id BIGINT)
RETURNS TABLE (
  free_quiz_used INT,
  free_test_used INT,
  paid_credits INT,
  free_quiz_limit INT,
  free_test_limit INT,
  free_quiz_remaining INT,
  free_test_remaining INT,
  paid_credits_remaining INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quiz_limit INT := 3;
  v_test_limit INT := 3;
  v_row public.ai_generation_quotas%ROWTYPE;
BEGIN
  IF p_telegram_id IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0, v_quiz_limit, v_test_limit, v_quiz_limit, v_test_limit, 0;
    RETURN;
  END IF;

  INSERT INTO public.ai_generation_quotas (telegram_id)
  VALUES (p_telegram_id)
  ON CONFLICT (telegram_id) DO NOTHING;

  SELECT *
  INTO v_row
  FROM public.ai_generation_quotas
  WHERE telegram_id = p_telegram_id;

  RETURN QUERY SELECT
    COALESCE(v_row.free_quiz_used, 0),
    COALESCE(v_row.free_test_used, 0),
    COALESCE(v_row.paid_credits, 0),
    v_quiz_limit,
    v_test_limit,
    GREATEST(v_quiz_limit - COALESCE(v_row.free_quiz_used, 0), 0),
    GREATEST(v_test_limit - COALESCE(v_row.free_test_used, 0), 0),
    GREATEST(COALESCE(v_row.paid_credits, 0), 0);
END;
$$;

-- ============================================================
-- RPC: Consume generation (atomic)
-- ============================================================
CREATE OR REPLACE FUNCTION public.ai_consume_generation(
  p_telegram_id BIGINT,
  p_content_type TEXT
)
RETURNS TABLE (
  allowed BOOLEAN,
  reason_code TEXT,
  free_quiz_remaining INT,
  free_test_remaining INT,
  paid_credits_remaining INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quiz_limit INT := 3;
  v_test_limit INT := 3;
  v_row public.ai_generation_quotas%ROWTYPE;
  v_allowed BOOLEAN := false;
  v_reason TEXT := 'need_payment';
BEGIN
  IF p_telegram_id IS NULL THEN
    RETURN QUERY SELECT false, 'missing_telegram_id', 0, 0, 0;
    RETURN;
  END IF;

  IF p_content_type IS NULL OR p_content_type NOT IN ('quiz', 'personality_test') THEN
    RETURN QUERY SELECT false, 'invalid_content_type', 0, 0, 0;
    RETURN;
  END IF;

  -- Ensure row exists.
  INSERT INTO public.ai_generation_quotas (telegram_id)
  VALUES (p_telegram_id)
  ON CONFLICT (telegram_id) DO NOTHING;

  -- Lock row so concurrent requests can't double-spend.
  SELECT *
  INTO v_row
  FROM public.ai_generation_quotas
  WHERE telegram_id = p_telegram_id
  FOR UPDATE;

  IF p_content_type = 'quiz' THEN
    IF COALESCE(v_row.free_quiz_used, 0) < v_quiz_limit THEN
      UPDATE public.ai_generation_quotas
      SET free_quiz_used = free_quiz_used + 1,
          updated_at = now()
      WHERE telegram_id = p_telegram_id;
      v_allowed := true;
      v_reason := 'free';
    ELSIF COALESCE(v_row.paid_credits, 0) > 0 THEN
      UPDATE public.ai_generation_quotas
      SET paid_credits = paid_credits - 1,
          updated_at = now()
      WHERE telegram_id = p_telegram_id;
      v_allowed := true;
      v_reason := 'paid';
    ELSE
      v_allowed := false;
      v_reason := 'need_payment';
    END IF;
  ELSE
    IF COALESCE(v_row.free_test_used, 0) < v_test_limit THEN
      UPDATE public.ai_generation_quotas
      SET free_test_used = free_test_used + 1,
          updated_at = now()
      WHERE telegram_id = p_telegram_id;
      v_allowed := true;
      v_reason := 'free';
    ELSIF COALESCE(v_row.paid_credits, 0) > 0 THEN
      UPDATE public.ai_generation_quotas
      SET paid_credits = paid_credits - 1,
          updated_at = now()
      WHERE telegram_id = p_telegram_id;
      v_allowed := true;
      v_reason := 'paid';
    ELSE
      v_allowed := false;
      v_reason := 'need_payment';
    END IF;
  END IF;

  SELECT *
  INTO v_row
  FROM public.ai_generation_quotas
  WHERE telegram_id = p_telegram_id;

  RETURN QUERY SELECT
    v_allowed,
    v_reason,
    GREATEST(v_quiz_limit - COALESCE(v_row.free_quiz_used, 0), 0),
    GREATEST(v_test_limit - COALESCE(v_row.free_test_used, 0), 0),
    GREATEST(COALESCE(v_row.paid_credits, 0), 0);
END;
$$;

-- ============================================================
-- RPC: Add paid credits
-- ============================================================
CREATE OR REPLACE FUNCTION public.ai_add_paid_credits(p_telegram_id BIGINT, p_delta INT)
RETURNS TABLE (
  paid_credits INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ai_generation_quotas%ROWTYPE;
  v_delta INT := COALESCE(p_delta, 0);
BEGIN
  IF p_telegram_id IS NULL THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;

  IF v_delta < 0 THEN
    v_delta := 0;
  END IF;

  INSERT INTO public.ai_generation_quotas (telegram_id)
  VALUES (p_telegram_id)
  ON CONFLICT (telegram_id) DO NOTHING;

  UPDATE public.ai_generation_quotas
  SET paid_credits = GREATEST(paid_credits + v_delta, 0),
      updated_at = now()
  WHERE telegram_id = p_telegram_id;

  SELECT *
  INTO v_row
  FROM public.ai_generation_quotas
  WHERE telegram_id = p_telegram_id;

  RETURN QUERY SELECT GREATEST(COALESCE(v_row.paid_credits, 0), 0);
END;
$$;

-- ============================================================
-- RPC: Apply payment (idempotent + adds 1 credit)
-- ============================================================
CREATE OR REPLACE FUNCTION public.ai_apply_payment(
  p_telegram_id BIGINT,
  p_invoice_payload TEXT,
  p_currency TEXT,
  p_total_amount INT,
  p_telegram_payment_charge_id TEXT,
  p_provider_payment_charge_id TEXT DEFAULT NULL,
  p_credit_delta INT DEFAULT 1
)
RETURNS TABLE (
  applied BOOLEAN,
  paid_credits INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted BOOLEAN := false;
  v_row public.ai_generation_quotas%ROWTYPE;
  v_delta INT := COALESCE(p_credit_delta, 1);
BEGIN
  IF p_telegram_id IS NULL OR p_telegram_payment_charge_id IS NULL THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  IF v_delta < 0 THEN
    v_delta := 0;
  END IF;

  INSERT INTO public.ai_generation_payments (
    telegram_id,
    invoice_payload,
    currency,
    total_amount,
    telegram_payment_charge_id,
    provider_payment_charge_id
  )
  VALUES (
    p_telegram_id,
    COALESCE(p_invoice_payload, ''),
    COALESCE(p_currency, ''),
    COALESCE(p_total_amount, 0),
    p_telegram_payment_charge_id,
    p_provider_payment_charge_id
  )
  ON CONFLICT (telegram_payment_charge_id) DO NOTHING;

  v_inserted := FOUND;

  IF v_inserted THEN
    INSERT INTO public.ai_generation_quotas (telegram_id)
    VALUES (p_telegram_id)
    ON CONFLICT (telegram_id) DO NOTHING;

    UPDATE public.ai_generation_quotas
    SET paid_credits = GREATEST(paid_credits + v_delta, 0),
        updated_at = now()
    WHERE telegram_id = p_telegram_id;
  END IF;

  SELECT *
  INTO v_row
  FROM public.ai_generation_quotas
  WHERE telegram_id = p_telegram_id;

  RETURN QUERY SELECT v_inserted, GREATEST(COALESCE(v_row.paid_credits, 0), 0);
END;
$$;

-- Lock down RPCs: default Supabase installs often grant EXECUTE to PUBLIC.
REVOKE ALL ON FUNCTION public.ai_get_quota(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_consume_generation(BIGINT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_add_paid_credits(BIGINT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_apply_payment(BIGINT, TEXT, TEXT, INT, TEXT, TEXT, INT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ai_get_quota(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_consume_generation(BIGINT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_add_paid_credits(BIGINT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_apply_payment(BIGINT, TEXT, TEXT, INT, TEXT, TEXT, INT) TO service_role;

