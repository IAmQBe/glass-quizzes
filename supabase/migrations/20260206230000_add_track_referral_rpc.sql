-- Safe referral tracking RPC for Telegram start_param flows.
-- Avoids direct client inserts into referrals under strict RLS.

CREATE OR REPLACE FUNCTION public.track_referral(
  p_referrer_profile_id UUID,
  p_referred_profile_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_count INT := 0;
BEGIN
  IF p_referrer_profile_id IS NULL OR p_referred_profile_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Do not allow self-referral.
  IF p_referrer_profile_id = p_referred_profile_id THEN
    RETURN FALSE;
  END IF;

  -- Ensure both profiles exist.
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_referrer_profile_id) THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_referred_profile_id) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.referrals (referrer_id, referred_id)
  VALUES (p_referrer_profile_id, p_referred_profile_id)
  ON CONFLICT (referred_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.track_referral(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_referral(UUID, UUID) TO anon, authenticated, service_role;
