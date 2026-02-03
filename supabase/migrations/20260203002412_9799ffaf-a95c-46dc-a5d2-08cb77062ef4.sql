-- Fix the overly permissive INSERT policy on referrals
DROP POLICY IF EXISTS "System can create referrals" ON public.referrals;

-- Only authenticated users can create referrals for themselves
CREATE POLICY "Users can create referrals"
ON public.referrals FOR INSERT
WITH CHECK (referred_id = auth.uid());