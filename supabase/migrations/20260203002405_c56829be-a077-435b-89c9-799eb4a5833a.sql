-- Add referral code and notification settings to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS challenge_notifications_enabled BOOLEAN DEFAULT true;

-- Generate referral codes for existing users
UPDATE public.profiles 
SET referral_code = upper(substr(md5(random()::text || id::text), 1, 8))
WHERE referral_code IS NULL;

-- Create function to generate referral code for new users
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := upper(substr(md5(random()::text || NEW.id::text), 1, 8));
    END IF;
    RETURN NEW;
END;
$$;

-- Create trigger to auto-generate referral code
DROP TRIGGER IF EXISTS generate_referral_code_trigger ON public.profiles;
CREATE TRIGGER generate_referral_code_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.generate_referral_code();

-- Create referrals tracking table
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_id UUID NOT NULL,
    referred_id UUID NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Referrals policies
CREATE POLICY "Users can view their referrals"
ON public.referrals FOR SELECT
USING (referrer_id = auth.uid() OR referred_id = auth.uid());

CREATE POLICY "System can create referrals"
ON public.referrals FOR INSERT
WITH CHECK (true);