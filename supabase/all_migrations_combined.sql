-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    telegram_id BIGINT UNIQUE,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create quizzes table
CREATE TABLE public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_count INTEGER NOT NULL DEFAULT 0,
    participant_count INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER NOT NULL DEFAULT 60,
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create questions table
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    image_url TEXT,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    correct_answer INTEGER NOT NULL DEFAULT 0,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create quiz results table
CREATE TABLE public.quiz_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL DEFAULT 0,
    max_score INTEGER NOT NULL DEFAULT 100,
    percentile INTEGER NOT NULL DEFAULT 50,
    answers JSONB DEFAULT '[]'::jsonb,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(quiz_id, user_id)
);

-- Create banners table
CREATE TABLE public.banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    link_url TEXT,
    link_type TEXT NOT NULL DEFAULT 'internal' CHECK (link_type IN ('internal', 'external')),
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create security definer function to check admin role
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = check_user_id AND role = 'admin'
    )
$$;

-- Create function to check quiz ownership
CREATE OR REPLACE FUNCTION public.is_quiz_owner(check_quiz_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.quizzes
        WHERE id = check_quiz_id AND created_by = check_user_id
    )
$$;

-- Create function to check if user already took quiz
CREATE OR REPLACE FUNCTION public.has_taken_quiz(check_quiz_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.quiz_results
        WHERE quiz_id = check_quiz_id AND user_id = check_user_id
    )
$$;

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_roles (only admins can view roles)
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- RLS Policies for profiles
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- RLS Policies for quizzes
CREATE POLICY "Published quizzes are viewable by everyone"
ON public.quizzes FOR SELECT
USING (is_published = true OR created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can create quizzes"
ON public.quizzes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners and admins can update quizzes"
ON public.quizzes FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Owners and admins can delete quizzes"
ON public.quizzes FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

-- RLS Policies for questions
CREATE POLICY "Questions are viewable with quiz access"
ON public.questions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.quizzes q 
        WHERE q.id = quiz_id 
        AND (q.is_published = true OR q.created_by = auth.uid() OR public.is_admin(auth.uid()))
    )
);

CREATE POLICY "Quiz owners can manage questions"
ON public.questions FOR INSERT TO authenticated
WITH CHECK (public.is_quiz_owner(quiz_id, auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY "Quiz owners can update questions"
ON public.questions FOR UPDATE TO authenticated
USING (public.is_quiz_owner(quiz_id, auth.uid()) OR public.is_admin(auth.uid()))
WITH CHECK (public.is_quiz_owner(quiz_id, auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY "Quiz owners can delete questions"
ON public.questions FOR DELETE TO authenticated
USING (public.is_quiz_owner(quiz_id, auth.uid()) OR public.is_admin(auth.uid()));

-- RLS Policies for quiz_results
CREATE POLICY "Users can view own results and quiz owners can view all"
ON public.quiz_results FOR SELECT TO authenticated
USING (
    user_id = auth.uid() 
    OR public.is_quiz_owner(quiz_id, auth.uid()) 
    OR public.is_admin(auth.uid())
);

CREATE POLICY "Users can insert own results"
ON public.quiz_results FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = user_id 
    AND NOT public.has_taken_quiz(quiz_id, auth.uid())
);

-- RLS Policies for banners
CREATE POLICY "Banners are viewable by everyone"
ON public.banners FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage banners"
ON public.banners FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Create trigger to update participant count
CREATE OR REPLACE FUNCTION public.update_participant_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.quizzes 
    SET participant_count = participant_count + 1
    WHERE id = NEW.quiz_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_quiz_result_insert
AFTER INSERT ON public.quiz_results
FOR EACH ROW
EXECUTE FUNCTION public.update_participant_count();

-- Create trigger to update question count
CREATE OR REPLACE FUNCTION public.update_question_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.quizzes SET question_count = question_count + 1 WHERE id = NEW.quiz_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.quizzes SET question_count = question_count - 1 WHERE id = OLD.quiz_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_question_change
AFTER INSERT OR DELETE ON public.questions
FOR EACH ROW
EXECUTE FUNCTION public.update_question_count();

-- Create trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quizzes_updated_at
BEFORE UPDATE ON public.quizzes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_banners_updated_at
BEFORE UPDATE ON public.banners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();-- Fix banners policy to allow unauthenticated access
DROP POLICY IF EXISTS "Banners are viewable by everyone" ON public.banners;

CREATE POLICY "Banners are viewable by everyone"
ON public.banners FOR SELECT
USING (is_active = true);

-- Also fix quizzes to be viewable without auth if published
DROP POLICY IF EXISTS "Published quizzes are viewable by everyone" ON public.quizzes;

CREATE POLICY "Published quizzes are viewable by everyone"
ON public.quizzes FOR SELECT
USING (is_published = true OR created_by = auth.uid() OR public.is_admin(auth.uid()));

-- Fix questions to be viewable for published quizzes
DROP POLICY IF EXISTS "Questions are viewable with quiz access" ON public.questions;

CREATE POLICY "Questions are viewable with quiz access"
ON public.questions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.quizzes q 
        WHERE q.id = quiz_id 
        AND (q.is_published = true OR q.created_by = auth.uid() OR public.is_admin(auth.uid()))
    )
);-- Add rating system to quizzes
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;

-- Add Telegram premium to profiles  
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS has_telegram_premium BOOLEAN DEFAULT false;

-- Create favorites table
CREATE TABLE public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, quiz_id)
);

-- Create quiz ratings table
CREATE TABLE public.quiz_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, quiz_id)
);

-- Enable RLS
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_ratings ENABLE ROW LEVEL SECURITY;

-- Favorites policies
CREATE POLICY "Users can view own favorites"
ON public.favorites FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can add favorites"
ON public.favorites FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove favorites"
ON public.favorites FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Quiz ratings policies
CREATE POLICY "Ratings are viewable by everyone"
ON public.quiz_ratings FOR SELECT
USING (true);

CREATE POLICY "Users can rate quizzes"
ON public.quiz_ratings FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own rating"
ON public.quiz_ratings FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Trigger to update quiz rating average
CREATE OR REPLACE FUNCTION public.update_quiz_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.quizzes 
    SET 
        rating = (SELECT COALESCE(AVG(rating), 0) FROM public.quiz_ratings WHERE quiz_id = NEW.quiz_id),
        rating_count = (SELECT COUNT(*) FROM public.quiz_ratings WHERE quiz_id = NEW.quiz_id)
    WHERE id = NEW.quiz_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_quiz_rating_change
AFTER INSERT OR UPDATE ON public.quiz_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_quiz_rating();-- Create leaderboard_seasons table for configurable season durations
CREATE TABLE public.leaderboard_seasons (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leaderboard_seasons ENABLE ROW LEVEL SECURITY;

-- Public can view seasons
CREATE POLICY "Seasons are viewable by everyone" 
ON public.leaderboard_seasons 
FOR SELECT 
USING (true);

-- Only admins can manage seasons
CREATE POLICY "Admins can manage seasons" 
ON public.leaderboard_seasons 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Create settings table for global app settings
CREATE TABLE public.app_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Public can view settings
CREATE POLICY "Settings are viewable by everyone" 
ON public.app_settings 
FOR SELECT 
USING (true);

-- Only admins can manage settings
CREATE POLICY "Admins can manage settings" 
ON public.app_settings 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Insert default season duration setting (in days)
INSERT INTO public.app_settings (key, value) 
VALUES ('leaderboard_config', '{"season_duration_days": 30, "cup_thresholds": {"gold": 1000, "silver": 500, "bronze": 100}}');

-- Add trigger for updated_at
CREATE TRIGGER update_leaderboard_seasons_updated_at
BEFORE UPDATE ON public.leaderboard_seasons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();-- Drop the foreign key constraint on created_by since we need flexibility for sample data
ALTER TABLE public.quizzes DROP CONSTRAINT IF EXISTS quizzes_created_by_fkey;-- Add likes (popcorn) and saves columns to quizzes
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS save_count INTEGER NOT NULL DEFAULT 0;

-- Create quiz_likes table for tracking unique likes (popcorn)
CREATE TABLE public.quiz_likes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(quiz_id, user_id)
);

-- Enable RLS
ALTER TABLE public.quiz_likes ENABLE ROW LEVEL SECURITY;

-- RLS policies for quiz_likes
CREATE POLICY "Users can view likes" 
ON public.quiz_likes FOR SELECT USING (true);

CREATE POLICY "Users can like quizzes" 
ON public.quiz_likes FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can unlike quizzes" 
ON public.quiz_likes FOR DELETE 
USING (user_id = auth.uid());

-- Function to update like_count
CREATE OR REPLACE FUNCTION public.update_quiz_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.quizzes SET like_count = like_count + 1 WHERE id = NEW.quiz_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.quizzes SET like_count = like_count - 1 WHERE id = OLD.quiz_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for like_count
CREATE TRIGGER update_quiz_likes_count
AFTER INSERT OR DELETE ON public.quiz_likes
FOR EACH ROW EXECUTE FUNCTION public.update_quiz_like_count();

-- Function to update save_count  
CREATE OR REPLACE FUNCTION public.update_quiz_save_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.quizzes SET save_count = save_count + 1 WHERE id = NEW.quiz_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.quizzes SET save_count = save_count - 1 WHERE id = OLD.quiz_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for save_count (on favorites table)
CREATE TRIGGER update_quiz_saves_count
AFTER INSERT OR DELETE ON public.favorites
FOR EACH ROW EXECUTE FUNCTION public.update_quiz_save_count();

-- Create live_quizzes table for online real-time quizzes
CREATE TABLE public.live_quizzes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    host_user_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished')),
    current_question INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    max_participants INTEGER DEFAULT 100,
    is_paid BOOLEAN NOT NULL DEFAULT false,
    price_stars INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create live_quiz_participants table
CREATE TABLE public.live_quiz_participants (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    live_quiz_id UUID NOT NULL REFERENCES public.live_quizzes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    correct_answers INTEGER NOT NULL DEFAULT 0,
    total_time_ms INTEGER NOT NULL DEFAULT 0,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(live_quiz_id, user_id)
);

-- Create live_quiz_answers table for real-time tracking
CREATE TABLE public.live_quiz_answers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    live_quiz_id UUID NOT NULL REFERENCES public.live_quizzes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    question_index INTEGER NOT NULL,
    answer_index INTEGER NOT NULL,
    is_correct BOOLEAN NOT NULL,
    time_ms INTEGER NOT NULL,
    answered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create live_quiz_reactions for emoji reactions
CREATE TABLE public.live_quiz_reactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    live_quiz_id UUID NOT NULL REFERENCES public.live_quizzes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all live quiz tables
ALTER TABLE public.live_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_quiz_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_quiz_reactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for live_quizzes
CREATE POLICY "Live quizzes are viewable by everyone" 
ON public.live_quizzes FOR SELECT USING (true);

CREATE POLICY "Users can create live quizzes" 
ON public.live_quizzes FOR INSERT 
WITH CHECK (host_user_id = auth.uid());

CREATE POLICY "Hosts can update their live quizzes" 
ON public.live_quizzes FOR UPDATE 
USING (host_user_id = auth.uid());

CREATE POLICY "Hosts can delete their live quizzes" 
ON public.live_quizzes FOR DELETE 
USING (host_user_id = auth.uid());

-- RLS policies for participants
CREATE POLICY "Participants are viewable by everyone" 
ON public.live_quiz_participants FOR SELECT USING (true);

CREATE POLICY "Users can join live quizzes" 
ON public.live_quiz_participants FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own participation" 
ON public.live_quiz_participants FOR UPDATE 
USING (user_id = auth.uid());

-- RLS policies for answers
CREATE POLICY "Answers viewable by host and participant" 
ON public.live_quiz_answers FOR SELECT 
USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.live_quizzes WHERE id = live_quiz_id AND host_user_id = auth.uid()
));

CREATE POLICY "Users can submit answers" 
ON public.live_quiz_answers FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- RLS policies for reactions
CREATE POLICY "Reactions are viewable by everyone" 
ON public.live_quiz_reactions FOR SELECT USING (true);

CREATE POLICY "Users can send reactions" 
ON public.live_quiz_reactions FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Enable realtime for live quiz tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_quizzes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_quiz_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_quiz_answers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_quiz_reactions;

-- Add onboarding_completed to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;-- Create challenges table
CREATE TABLE public.challenges (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    challenger_id UUID NOT NULL,
    opponent_id UUID NOT NULL,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    category TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, declined, completed, expired
    challenger_score INTEGER,
    opponent_score INTEGER,
    winner_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Create PvP rooms table for competitive mode
CREATE TABLE public.pvp_rooms (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE, -- 6 character room code
    host_id UUID NOT NULL,
    guest_id UUID,
    category TEXT,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'waiting', -- waiting, selecting, playing, completed
    host_score INTEGER DEFAULT 0,
    guest_score INTEGER DEFAULT 0,
    current_question INTEGER DEFAULT 0,
    winner_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pvp_rooms ENABLE ROW LEVEL SECURITY;

-- Challenges policies
CREATE POLICY "Users can view their challenges"
ON public.challenges FOR SELECT
USING (challenger_id = auth.uid() OR opponent_id = auth.uid());

CREATE POLICY "Users can create challenges"
ON public.challenges FOR INSERT
WITH CHECK (challenger_id = auth.uid());

CREATE POLICY "Participants can update challenges"
ON public.challenges FOR UPDATE
USING (challenger_id = auth.uid() OR opponent_id = auth.uid());

-- PvP rooms policies
CREATE POLICY "PvP rooms are viewable by participants"
ON public.pvp_rooms FOR SELECT
USING (host_id = auth.uid() OR guest_id = auth.uid() OR guest_id IS NULL);

CREATE POLICY "Users can create PvP rooms"
ON public.pvp_rooms FOR INSERT
WITH CHECK (host_id = auth.uid());

CREATE POLICY "Participants can update PvP rooms"
ON public.pvp_rooms FOR UPDATE
USING (host_id = auth.uid() OR guest_id = auth.uid());

CREATE POLICY "Host can delete PvP rooms"
ON public.pvp_rooms FOR DELETE
USING (host_id = auth.uid());

-- Enable realtime for PvP
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pvp_rooms;

-- Function to check challenge cooldown (1 hour between challenges to same person)
CREATE OR REPLACE FUNCTION public.can_challenge_user(challenger UUID, opponent UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT NOT EXISTS (
        SELECT 1 FROM public.challenges
        WHERE challenger_id = challenger 
        AND opponent_id = opponent
        AND created_at > now() - interval '1 hour'
    )
$$;

-- Function to generate random room code
CREATE OR REPLACE FUNCTION public.generate_room_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
    chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result text := '';
    i integer;
BEGIN
    FOR i IN 1..6 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$;-- Add referral code and notification settings to profiles
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
WITH CHECK (true);-- Fix the overly permissive INSERT policy on referrals
DROP POLICY IF EXISTS "System can create referrals" ON public.referrals;

-- Only authenticated users can create referrals for themselves
CREATE POLICY "Users can create referrals"
ON public.referrals FOR INSERT
WITH CHECK (referred_id = auth.uid());-- Create tasks table for admin-managed tasks
CREATE TABLE public.tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    reward_type TEXT NOT NULL DEFAULT 'popcorns', -- popcorns, badge, etc.
    reward_amount INTEGER NOT NULL DEFAULT 10,
    task_type TEXT NOT NULL DEFAULT 'link', -- link, subscribe, invite, daily
    action_url TEXT, -- URL to open or channel to subscribe
    icon TEXT DEFAULT '🎯', -- emoji icon
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user task completions tracking
CREATE TABLE public.user_tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, task_id)
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

-- Tasks policies
CREATE POLICY "Tasks are viewable by everyone"
ON public.tasks FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage tasks"
ON public.tasks FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- User tasks policies
CREATE POLICY "Users can view own completed tasks"
ON public.user_tasks FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can complete tasks"
ON public.user_tasks FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();-- Add verdicts table for score-to-verdict mapping per quiz
CREATE TABLE IF NOT EXISTS public.verdicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    min_score INTEGER NOT NULL DEFAULT 0,
    max_score INTEGER NOT NULL DEFAULT 100,
    title TEXT NOT NULL,
    description TEXT,
    emoji TEXT DEFAULT '✨',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_score_range CHECK (min_score <= max_score)
);

-- Add shares table for tracking viral metrics
CREATE TABLE IF NOT EXISTS public.shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,
    result_id UUID REFERENCES public.quiz_results(id) ON DELETE SET NULL,
    chat_type TEXT, -- 'private', 'group', 'supergroup', 'channel'
    source TEXT, -- 'result', 'challenge', 'inline', 'profile'
    ref_user_id UUID, -- who invited this user
    shared_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_verdicts_quiz_id ON public.verdicts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_verdicts_score_range ON public.verdicts(quiz_id, min_score, max_score);
CREATE INDEX IF NOT EXISTS idx_shares_user_id ON public.shares(user_id);
CREATE INDEX IF NOT EXISTS idx_shares_quiz_id ON public.shares(quiz_id);
CREATE INDEX IF NOT EXISTS idx_shares_shared_at ON public.shares(shared_at);

-- Enable RLS
ALTER TABLE public.verdicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

-- Verdicts policies
CREATE POLICY "Verdicts are viewable by everyone"
ON public.verdicts FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.quizzes q 
        WHERE q.id = quiz_id 
        AND q.is_published = true
    )
);

CREATE POLICY "Quiz owners can manage verdicts"
ON public.verdicts FOR ALL TO authenticated
USING (public.is_quiz_owner(quiz_id, auth.uid()) OR public.is_admin(auth.uid()))
WITH CHECK (public.is_quiz_owner(quiz_id, auth.uid()) OR public.is_admin(auth.uid()));

-- Shares policies (users can only insert their own shares)
CREATE POLICY "Users can insert their own shares"
ON public.shares FOR INSERT TO authenticated
WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view their own shares"
ON public.shares FOR SELECT TO authenticated
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can view all shares"
ON public.shares FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

-- Insert default verdicts for existing quizzes (optional)
-- This creates a standard verdict scale that can be customized per quiz
INSERT INTO public.verdicts (quiz_id, min_score, max_score, title, description, emoji)
SELECT 
    q.id,
    v.min_score,
    v.max_score,
    v.title,
    v.description,
    v.emoji
FROM public.quizzes q
CROSS JOIN (
    VALUES 
        (0, 30, 'Beginner', 'Still finding your path', '🌱'),
        (31, 50, 'Learning', 'Growing stronger each day', '🔥'),
        (51, 70, 'Skilled', 'A force to be reckoned with', '⚡'),
        (71, 85, 'Expert', 'Rare level of clarity', '💎'),
        (86, 100, 'Master', 'Top 1% mental fortitude', '🏆')
) AS v(min_score, max_score, title, description, emoji)
WHERE NOT EXISTS (
    SELECT 1 FROM public.verdicts WHERE verdicts.quiz_id = q.id
);

-- Function to get verdict for a score
CREATE OR REPLACE FUNCTION public.get_verdict(p_quiz_id UUID, p_score INTEGER)
RETURNS TABLE (
    title TEXT,
    description TEXT,
    emoji TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT v.title, v.description, v.emoji
    FROM public.verdicts v
    WHERE v.quiz_id = p_quiz_id
      AND p_score >= v.min_score
      AND p_score <= v.max_score
    LIMIT 1;
$$;
