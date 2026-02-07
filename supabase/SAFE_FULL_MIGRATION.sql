-- =============================================================================
-- SAFE FULL MIGRATION (AUTO-GENERATED)
-- =============================================================================
-- Generated at: 2026-02-06 18:42:29 UTC
-- Source files: supabase/migrations/*.sql + supabase/seed_data.sql
-- Order: lexical sort by filename (Supabase migration order)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260202233436_fb8050b7-6997-43df-ba4e-454401a1300d.sql
-- -----------------------------------------------------------------------------
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
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- END FILE: supabase/migrations/20260202233436_fb8050b7-6997-43df-ba4e-454401a1300d.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260202233825_40cba617-7801-4926-bbc2-6b604258931c.sql
-- -----------------------------------------------------------------------------
-- Fix banners policy to allow unauthenticated access
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
);
-- END FILE: supabase/migrations/20260202233825_40cba617-7801-4926-bbc2-6b604258931c.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260202234221_e0059c21-91b9-43ac-9f15-8aca57adb5a3.sql
-- -----------------------------------------------------------------------------
-- Add rating system to quizzes
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
EXECUTE FUNCTION public.update_quiz_rating();
-- END FILE: supabase/migrations/20260202234221_e0059c21-91b9-43ac-9f15-8aca57adb5a3.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260202234917_89f92931-9905-4002-9f5d-724b27805253.sql
-- -----------------------------------------------------------------------------
-- Create leaderboard_seasons table for configurable season durations
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
EXECUTE FUNCTION public.update_updated_at_column();
-- END FILE: supabase/migrations/20260202234917_89f92931-9905-4002-9f5d-724b27805253.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260202235022_02cf87e4-2fba-478d-b4a9-36f50bcfad47.sql
-- -----------------------------------------------------------------------------
-- Drop the foreign key constraint on created_by since we need flexibility for sample data
ALTER TABLE public.quizzes DROP CONSTRAINT IF EXISTS quizzes_created_by_fkey;
-- END FILE: supabase/migrations/20260202235022_02cf87e4-2fba-478d-b4a9-36f50bcfad47.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260203000025_3a9fbfd5-dcab-42bd-bd92-1fe67c5a1b7f.sql
-- -----------------------------------------------------------------------------
-- Add likes (popcorn) and saves columns to quizzes
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
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;
-- END FILE: supabase/migrations/20260203000025_3a9fbfd5-dcab-42bd-bd92-1fe67c5a1b7f.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260203001911_98845cd5-8b02-41b1-899f-a1135455a495.sql
-- -----------------------------------------------------------------------------
-- Create challenges table
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
$$;
-- END FILE: supabase/migrations/20260203001911_98845cd5-8b02-41b1-899f-a1135455a495.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260203002405_c56829be-a077-435b-89c9-799eb4a5833a.sql
-- -----------------------------------------------------------------------------
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
-- END FILE: supabase/migrations/20260203002405_c56829be-a077-435b-89c9-799eb4a5833a.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260203002412_9799ffaf-a95c-46dc-a5d2-08cb77062ef4.sql
-- -----------------------------------------------------------------------------
-- Fix the overly permissive INSERT policy on referrals
DROP POLICY IF EXISTS "System can create referrals" ON public.referrals;

-- Only authenticated users can create referrals for themselves
CREATE POLICY "Users can create referrals"
ON public.referrals FOR INSERT
WITH CHECK (referred_id = auth.uid());
-- END FILE: supabase/migrations/20260203002412_9799ffaf-a95c-46dc-a5d2-08cb77062ef4.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260203002642_422e0415-4c77-49ba-a718-18b1351eeabd.sql
-- -----------------------------------------------------------------------------
-- Create tasks table for admin-managed tasks
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
EXECUTE FUNCTION public.update_updated_at_column();
-- END FILE: supabase/migrations/20260203002642_422e0415-4c77-49ba-a718-18b1351eeabd.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260203100000_add_verdicts_and_shares.sql
-- -----------------------------------------------------------------------------
-- Add verdicts table for score-to-verdict mapping per quiz
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

-- END FILE: supabase/migrations/20260203100000_add_verdicts_and_shares.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260203110000_add_quiz_moderation.sql
-- -----------------------------------------------------------------------------
-- Add moderation fields to quizzes table
-- This enables quiz review workflow: draft -> pending -> published/rejected

-- Add status field with CHECK constraint
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' 
  CHECK (status IN ('draft', 'pending', 'published', 'rejected'));

-- Add moderation-related fields
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS moderated_by TEXT,
ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;

-- Migrate existing data based on is_published flag
UPDATE public.quizzes SET status = 'published' WHERE is_published = true AND status IS NULL;
UPDATE public.quizzes SET status = 'draft' WHERE is_published = false AND status IS NULL;

-- Create index for faster filtering by status
CREATE INDEX IF NOT EXISTS idx_quizzes_status ON public.quizzes(status);

-- Comment for documentation
COMMENT ON COLUMN public.quizzes.status IS 'Quiz moderation status: draft, pending, published, rejected';
COMMENT ON COLUMN public.quizzes.rejection_reason IS 'Reason for rejection (if status=rejected)';
COMMENT ON COLUMN public.quizzes.submitted_at IS 'When the quiz was submitted for review';
COMMENT ON COLUMN public.quizzes.moderated_by IS 'Telegram ID of admin who moderated';
COMMENT ON COLUMN public.quizzes.moderated_at IS 'When the quiz was moderated';

-- END FILE: supabase/migrations/20260203110000_add_quiz_moderation.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260203110001_add_storage_and_rpc.sql
-- -----------------------------------------------------------------------------
-- Create storage bucket for quiz images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quiz-images', 
  'quiz-images', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for quiz-images bucket
CREATE POLICY "Anyone can view quiz images" ON storage.objects
FOR SELECT USING (bucket_id = 'quiz-images');

CREATE POLICY "Authenticated users can upload quiz images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'quiz-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own quiz images" ON storage.objects
FOR UPDATE USING (bucket_id = 'quiz-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own quiz images" ON storage.objects
FOR DELETE USING (bucket_id = 'quiz-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- RPC Functions for Leaderboard
-- ============================================

-- Leaderboard by completed tests count
CREATE OR REPLACE FUNCTION get_leaderboard_by_tests(limit_count INT DEFAULT 100)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  first_name TEXT,
  avatar_url TEXT,
  has_premium BOOLEAN,
  count BIGINT,
  rank BIGINT
) AS $$
  SELECT 
    qr.user_id,
    p.username,
    p.first_name,
    p.avatar_url,
    p.has_telegram_premium as has_premium,
    COUNT(*) as count,
    RANK() OVER (ORDER BY COUNT(*) DESC) as rank
  FROM quiz_results qr
  JOIN profiles p ON p.id = qr.user_id
  GROUP BY qr.user_id, p.username, p.first_name, p.avatar_url, p.has_telegram_premium
  ORDER BY count DESC
  LIMIT limit_count;
$$ LANGUAGE sql STABLE;

-- Leaderboard by challenge wins
CREATE OR REPLACE FUNCTION get_leaderboard_by_challenges(limit_count INT DEFAULT 100)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  first_name TEXT,
  avatar_url TEXT,
  has_premium BOOLEAN,
  wins BIGINT,
  rank BIGINT
) AS $$
  SELECT 
    c.winner_id as user_id,
    p.username,
    p.first_name,
    p.avatar_url,
    p.has_telegram_premium as has_premium,
    COUNT(*) as wins,
    RANK() OVER (ORDER BY COUNT(*) DESC) as rank
  FROM challenges c
  JOIN profiles p ON p.id = c.winner_id
  WHERE c.status = 'completed' AND c.winner_id IS NOT NULL
  GROUP BY c.winner_id, p.username, p.first_name, p.avatar_url, p.has_telegram_premium
  ORDER BY wins DESC
  LIMIT limit_count;
$$ LANGUAGE sql STABLE;

-- Leaderboard by popcorns (likes received for created quizzes)
CREATE OR REPLACE FUNCTION get_leaderboard_by_popcorns(limit_count INT DEFAULT 100)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  first_name TEXT,
  avatar_url TEXT,
  has_premium BOOLEAN,
  total_popcorns BIGINT,
  quiz_count BIGINT,
  rank BIGINT
) AS $$
  SELECT 
    q.created_by as user_id,
    p.username,
    p.first_name,
    p.avatar_url,
    p.has_telegram_premium as has_premium,
    COALESCE(SUM(q.like_count), 0)::BIGINT as total_popcorns,
    COUNT(*)::BIGINT as quiz_count,
    RANK() OVER (ORDER BY COALESCE(SUM(q.like_count), 0) DESC) as rank
  FROM quizzes q
  JOIN profiles p ON p.id = q.created_by
  WHERE q.status = 'published'
  GROUP BY q.created_by, p.username, p.first_name, p.avatar_url, p.has_telegram_premium
  HAVING COALESCE(SUM(q.like_count), 0) > 0
  ORDER BY total_popcorns DESC
  LIMIT limit_count;
$$ LANGUAGE sql STABLE;

-- Leaderboard by total score
CREATE OR REPLACE FUNCTION get_leaderboard_by_score(limit_count INT DEFAULT 100)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  first_name TEXT,
  avatar_url TEXT,
  has_premium BOOLEAN,
  total_score BIGINT,
  tests_count BIGINT,
  rank BIGINT
) AS $$
  SELECT 
    qr.user_id,
    p.username,
    p.first_name,
    p.avatar_url,
    p.has_telegram_premium as has_premium,
    COALESCE(SUM(qr.score), 0)::BIGINT as total_score,
    COUNT(*)::BIGINT as tests_count,
    RANK() OVER (ORDER BY COALESCE(SUM(qr.score), 0) DESC) as rank
  FROM quiz_results qr
  JOIN profiles p ON p.id = qr.user_id
  GROUP BY qr.user_id, p.username, p.first_name, p.avatar_url, p.has_telegram_premium
  ORDER BY total_score DESC
  LIMIT limit_count;
$$ LANGUAGE sql STABLE;

-- ============================================
-- RPC Function for User Stats
-- ============================================

CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  target_user_id UUID;
  result JSON;
BEGIN
  -- Use provided user_id or fall back to auth.uid()
  target_user_id := COALESCE(p_user_id, auth.uid());
  
  IF target_user_id IS NULL THEN
    RETURN json_build_object(
      'best_score', 0,
      'tests_completed', 0,
      'global_rank', 0,
      'active_challenges', 0,
      'trophies', 0,
      'total_popcorns', 0
    );
  END IF;

  SELECT json_build_object(
    'best_score', COALESCE((
      SELECT MAX(score) FROM quiz_results WHERE user_id = target_user_id
    ), 0),
    'tests_completed', COALESCE((
      SELECT COUNT(*) FROM quiz_results WHERE user_id = target_user_id
    ), 0),
    'global_rank', COALESCE((
      SELECT rank FROM (
        SELECT user_id, RANK() OVER (ORDER BY COUNT(*) DESC) as rank 
        FROM quiz_results GROUP BY user_id
      ) r WHERE r.user_id = target_user_id
    ), 0),
    'active_challenges', COALESCE((
      SELECT COUNT(*) FROM challenges WHERE 
        (challenger_id = target_user_id OR challenged_id = target_user_id) 
        AND status = 'pending'
    ), 0),
    'challenge_wins', COALESCE((
      SELECT COUNT(*) FROM challenges WHERE 
        winner_id = target_user_id AND status = 'completed'
    ), 0),
    'trophies', 0,  -- TODO: implement trophy logic based on seasons
    'total_popcorns', COALESCE((
      SELECT SUM(like_count) FROM quizzes WHERE created_by = target_user_id AND status = 'published'
    ), 0)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_leaderboard_by_tests TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_leaderboard_by_challenges TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_leaderboard_by_popcorns TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_leaderboard_by_score TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_stats TO authenticated, anon;

-- END FILE: supabase/migrations/20260203110001_add_storage_and_rpc.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260203_analytics_and_fixes.sql
-- -----------------------------------------------------------------------------
-- ========================================
-- Analytics RPC Functions + Data Fixes
-- ========================================

-- Add events table for tracking if not exists
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);

-- Add shares table if not exists
CREATE TABLE IF NOT EXISTS shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  content_type TEXT DEFAULT 'quiz', -- 'quiz' or 'personality_test'
  content_id UUID,
  share_type TEXT DEFAULT 'inline', -- 'inline', 'link', 'direct'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to shares if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shares' AND column_name = 'content_type') THEN
    ALTER TABLE shares ADD COLUMN content_type TEXT DEFAULT 'quiz';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shares' AND column_name = 'content_id') THEN
    ALTER TABLE shares ADD COLUMN content_id UUID;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shares' AND column_name = 'share_type') THEN
    ALTER TABLE shares ADD COLUMN share_type TEXT DEFAULT 'inline';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shares' AND column_name = 'created_at') THEN
    ALTER TABLE shares ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shares_user_id ON shares(user_id);
-- Only create index if columns exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shares' AND column_name = 'content_type') 
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shares' AND column_name = 'content_id') THEN
    CREATE INDEX IF NOT EXISTS idx_shares_content ON shares(content_type, content_id);
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shares' AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_shares_created_at ON shares(created_at);
  END IF;
END $$;

-- RLS for events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own events" ON events;
CREATE POLICY "Users can view own events" ON events FOR SELECT USING (auth.uid() = user_id OR auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Users can insert events" ON events;
CREATE POLICY "Users can insert events" ON events FOR INSERT WITH CHECK (true);

-- RLS for shares
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view shares" ON shares;
CREATE POLICY "Anyone can view shares" ON shares FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert shares" ON shares;
CREATE POLICY "Anyone can insert shares" ON shares FOR INSERT WITH CHECK (true);

-- ========================================
-- DAU/WAU/MAU Functions
-- ========================================

CREATE OR REPLACE FUNCTION get_dau()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT COUNT(DISTINCT user_id)
  INTO result
  FROM events
  WHERE created_at >= CURRENT_DATE;
  
  -- Fallback: count profiles with recent activity
  IF result = 0 THEN
    SELECT COUNT(*)
    INTO result
    FROM profiles
    WHERE last_seen_at >= CURRENT_DATE
       OR updated_at >= CURRENT_DATE;
  END IF;
  
  RETURN COALESCE(result, 0);
END;
$$;

CREATE OR REPLACE FUNCTION get_wau()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT COUNT(DISTINCT user_id)
  INTO result
  FROM events
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';
  
  IF result = 0 THEN
    SELECT COUNT(*)
    INTO result
    FROM profiles
    WHERE last_seen_at >= CURRENT_DATE - INTERVAL '7 days'
       OR updated_at >= CURRENT_DATE - INTERVAL '7 days';
  END IF;
  
  RETURN COALESCE(result, 0);
END;
$$;

CREATE OR REPLACE FUNCTION get_mau()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT COUNT(DISTINCT user_id)
  INTO result
  FROM events
  WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';
  
  IF result = 0 THEN
    SELECT COUNT(*)
    INTO result
    FROM profiles
    WHERE last_seen_at >= CURRENT_DATE - INTERVAL '30 days'
       OR updated_at >= CURRENT_DATE - INTERVAL '30 days'
       OR created_at >= CURRENT_DATE - INTERVAL '30 days';
  END IF;
  
  RETURN COALESCE(result, 0);
END;
$$;

-- ========================================
-- Shares Function
-- ========================================

CREATE OR REPLACE FUNCTION get_total_shares()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO result
  FROM shares;
  
  RETURN COALESCE(result, 0);
END;
$$;

-- ========================================
-- Quiz Funnel
-- ========================================

CREATE OR REPLACE FUNCTION get_quiz_funnel(
  from_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days',
  to_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(viewed BIGINT, started BIGINT, completed BIGINT, shared BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_viewed BIGINT := 0;
  v_started BIGINT := 0;
  v_completed BIGINT := 0;
  v_shared BIGINT := 0;
BEGIN
  -- Viewed: count of unique users who opened any quiz
  SELECT COUNT(DISTINCT user_id) INTO v_viewed
  FROM events 
  WHERE event_type = 'quiz_viewed' 
  AND events.created_at BETWEEN from_date AND to_date + INTERVAL '1 day';
  
  -- Started: count of unique users who started a quiz
  SELECT COUNT(DISTINCT user_id) INTO v_started
  FROM events 
  WHERE event_type = 'quiz_started' 
  AND events.created_at BETWEEN from_date AND to_date + INTERVAL '1 day';
  
  -- Completed: count of quiz_results in period
  SELECT COUNT(*) INTO v_completed
  FROM quiz_results 
  WHERE quiz_results.created_at BETWEEN from_date AND to_date + INTERVAL '1 day';
  
  -- Shared: just count all shares (simpler)
  SELECT COUNT(*) INTO v_shared FROM shares;

  RETURN QUERY SELECT v_viewed, v_started, v_completed, v_shared;
END;
$$;

-- ========================================
-- Average Completion Time
-- ========================================

CREATE OR REPLACE FUNCTION get_avg_completion_time()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result NUMERIC;
BEGIN
  SELECT AVG(time_taken_seconds)
  INTO result
  FROM quiz_results
  WHERE time_taken_seconds IS NOT NULL
    AND time_taken_seconds > 0
    AND time_taken_seconds < 600; -- Exclude outliers > 10 min
  
  RETURN COALESCE(ROUND(result), 60);
END;
$$;

-- ========================================
-- Top Quizzes by Completions
-- ========================================

CREATE OR REPLACE FUNCTION get_top_quizzes_by_completions(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(quiz_id UUID, title TEXT, completions BIGINT, shares BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.id as quiz_id,
    q.title::TEXT,
    COUNT(DISTINCT qr.id)::BIGINT as completions,
    0::BIGINT as shares  -- Simplified: shares counted separately
  FROM quizzes q
  LEFT JOIN quiz_results qr ON qr.quiz_id = q.id
  WHERE q.is_published = true
  GROUP BY q.id, q.title
  ORDER BY completions DESC
  LIMIT limit_count;
END;
$$;

-- ========================================
-- User Sources (from referrals)
-- ========================================

CREATE OR REPLACE FUNCTION get_user_sources(days_back INTEGER DEFAULT 30)
RETURNS TABLE(source TEXT, user_count BIGINT, percentage NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_users BIGINT;
BEGIN
  SELECT COUNT(*) INTO total_users
  FROM profiles
  WHERE created_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL;
  
  IF total_users = 0 THEN
    total_users := 1;
  END IF;

  RETURN QUERY
  SELECT 
    COALESCE(NULLIF(p.source, ''), 'direct')::TEXT as source,
    COUNT(*)::BIGINT as user_count,
    ROUND((COUNT(*)::NUMERIC / total_users) * 100, 1) as percentage
  FROM profiles p
  WHERE p.created_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL
  GROUP BY COALESCE(NULLIF(p.source, ''), 'direct')
  ORDER BY user_count DESC;
END;
$$;

-- ========================================
-- Active Users by Period
-- ========================================

CREATE OR REPLACE FUNCTION get_active_users_by_period(days_back INTEGER DEFAULT 30)
RETURNS TABLE(event_date DATE, unique_users BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(e.created_at) as event_date,
    COUNT(DISTINCT e.user_id)::BIGINT as unique_users
  FROM events e
  WHERE e.created_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL
  GROUP BY DATE(e.created_at)
  ORDER BY event_date;
END;
$$;

-- ========================================
-- Add missing columns to profiles
-- ========================================

-- Add source column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'source') THEN
    ALTER TABLE profiles ADD COLUMN source TEXT;
  END IF;
END $$;

-- Add last_seen_at if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'last_seen_at') THEN
    ALTER TABLE profiles ADD COLUMN last_seen_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Add time_taken_seconds to quiz_results if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quiz_results' AND column_name = 'time_taken_seconds') THEN
    ALTER TABLE quiz_results ADD COLUMN time_taken_seconds INTEGER;
  END IF;
END $$;

-- ========================================
-- Grant execute permissions
-- ========================================

GRANT EXECUTE ON FUNCTION get_dau() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_wau() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_mau() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_total_shares() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_quiz_funnel(DATE, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_avg_completion_time() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_top_quizzes_by_completions(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_sources(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_active_users_by_period(INTEGER) TO anon, authenticated;

-- END FILE: supabase/migrations/20260203_analytics_and_fixes.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260203_fix_banners_rls.sql
-- -----------------------------------------------------------------------------
-- Fix RLS for banners table
-- Allow all operations without authentication (admin check done in app)

-- Drop existing policy
DROP POLICY IF EXISTS "Admins can manage banners" ON public.banners;

-- Disable RLS on banners (admin access is controlled at app level)
ALTER TABLE public.banners DISABLE ROW LEVEL SECURITY;

-- Or alternatively, create permissive policies:
-- CREATE POLICY "Anyone can read active banners"
-- ON public.banners FOR SELECT
-- USING (is_active = true);
--
-- CREATE POLICY "Anyone can manage banners"
-- ON public.banners FOR ALL
-- USING (true)
-- WITH CHECK (true);

-- END FILE: supabase/migrations/20260203_fix_banners_rls.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260203_fix_squads_rls.sql
-- -----------------------------------------------------------------------------
-- Fix RLS for squads table to allow bot to insert

-- Drop existing policies
DROP POLICY IF EXISTS "Bot can manage squads" ON public.squads;
DROP POLICY IF EXISTS "Anyone can view active squads" ON public.squads;

-- Allow anyone to view active squads
CREATE POLICY "Anyone can view active squads"
ON public.squads FOR SELECT
USING (is_active = true);

-- Allow anyone to insert squads (bot uses anon key)
CREATE POLICY "Anyone can insert squads"
ON public.squads FOR INSERT
WITH CHECK (true);

-- Allow anyone to update squads (bot needs to reactivate/deactivate)
CREATE POLICY "Anyone can update squads"
ON public.squads FOR UPDATE
USING (true);

-- Allow viewing all squads for admins
CREATE POLICY "Admin can view all squads"
ON public.squads FOR SELECT
USING (true);

-- END FILE: supabase/migrations/20260203_fix_squads_rls.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260203_personality_tests.sql
-- -----------------------------------------------------------------------------
-- ============================================
-- Personality Tests Feature Migration
-- ============================================

-- 1. Main personality tests table
CREATE TABLE IF NOT EXISTS personality_tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  question_count INT DEFAULT 0,
  result_count INT DEFAULT 0,
  participant_count INT DEFAULT 0,
  like_count INT DEFAULT 0,
  save_count INT DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Questions for personality tests
CREATE TABLE IF NOT EXISTS personality_test_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID NOT NULL REFERENCES personality_tests(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  image_url TEXT,
  order_index INT NOT NULL
);

-- 3. Answers with result points
CREATE TABLE IF NOT EXISTS personality_test_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES personality_test_questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  result_points JSONB NOT NULL DEFAULT '{}',
  order_index INT NOT NULL
);

-- 4. Results/Characters
CREATE TABLE IF NOT EXISTS personality_test_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID NOT NULL REFERENCES personality_tests(id) ON DELETE CASCADE,
  result_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  share_text TEXT,
  order_index INT NOT NULL,
  UNIQUE(test_id, result_key)
);

-- 5. User completions
CREATE TABLE IF NOT EXISTS personality_test_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  test_id UUID NOT NULL REFERENCES personality_tests(id) ON DELETE CASCADE,
  result_id UUID NOT NULL REFERENCES personality_test_results(id) ON DELETE CASCADE,
  answers JSONB,
  completed_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Likes for personality tests
CREATE TABLE IF NOT EXISTS personality_test_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES personality_tests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, test_id)
);

-- 7. Favorites for personality tests
CREATE TABLE IF NOT EXISTS personality_test_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES personality_tests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, test_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_personality_tests_published ON personality_tests(is_published);
CREATE INDEX IF NOT EXISTS idx_personality_tests_created_by ON personality_tests(created_by);
CREATE INDEX IF NOT EXISTS idx_personality_test_questions_test_id ON personality_test_questions(test_id);
CREATE INDEX IF NOT EXISTS idx_personality_test_answers_question_id ON personality_test_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_personality_test_results_test_id ON personality_test_results(test_id);
CREATE INDEX IF NOT EXISTS idx_personality_test_completions_user_id ON personality_test_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_personality_test_completions_test_id ON personality_test_completions(test_id);

-- Disable RLS for now (can be enabled later with proper policies)
ALTER TABLE personality_tests DISABLE ROW LEVEL SECURITY;
ALTER TABLE personality_test_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE personality_test_answers DISABLE ROW LEVEL SECURITY;
ALTER TABLE personality_test_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE personality_test_completions DISABLE ROW LEVEL SECURITY;
ALTER TABLE personality_test_likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE personality_test_favorites DISABLE ROW LEVEL SECURITY;

-- END FILE: supabase/migrations/20260203_personality_tests.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260203_squads.sql
-- -----------------------------------------------------------------------------
-- Squads (Community/Teams) system
-- Squad = Telegram channel/group where bot is admin

-- Squads table
CREATE TABLE IF NOT EXISTS public.squads (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    telegram_chat_id BIGINT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    username TEXT, -- @channel_username if public
    type TEXT NOT NULL DEFAULT 'channel', -- 'channel', 'group', 'supergroup'
    member_count INT NOT NULL DEFAULT 0,
    total_popcorns INT NOT NULL DEFAULT 0,
    avatar_url TEXT,
    invite_link TEXT,
    created_by UUID REFERENCES public.profiles(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Squad members (users who joined a squad)
CREATE TABLE IF NOT EXISTS public.squad_members (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    squad_id UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    left_at TIMESTAMP WITH TIME ZONE, -- NULL = active member
    UNIQUE(squad_id, user_id)
);

-- Add squad_id to profiles (current squad)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS squad_id UUID REFERENCES public.squads(id),
ADD COLUMN IF NOT EXISTS squad_joined_at TIMESTAMP WITH TIME ZONE;

-- Index for squad leaderboard
CREATE INDEX IF NOT EXISTS idx_squads_total_popcorns ON public.squads(total_popcorns DESC);
CREATE INDEX IF NOT EXISTS idx_squad_members_squad ON public.squad_members(squad_id);
CREATE INDEX IF NOT EXISTS idx_squad_members_user ON public.squad_members(user_id);

-- Enable RLS
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for squads
CREATE POLICY "Anyone can view active squads"
ON public.squads FOR SELECT
USING (is_active = true);

CREATE POLICY "Bot can manage squads"
ON public.squads FOR ALL
USING (true);

-- RLS Policies for squad_members
CREATE POLICY "Anyone can view squad members"
ON public.squad_members FOR SELECT
USING (true);

CREATE POLICY "Users can join/leave squads"
ON public.squad_members FOR ALL
USING (true);

-- Function to check if user can change squad (once per week)
CREATE OR REPLACE FUNCTION public.can_change_squad(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    last_change TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT squad_joined_at INTO last_change
    FROM profiles
    WHERE id = p_user_id;
    
    -- Can change if never joined or more than 7 days ago
    RETURN last_change IS NULL OR last_change < (now() - INTERVAL '7 days');
END;
$$ LANGUAGE plpgsql;

-- Function to join a squad
CREATE OR REPLACE FUNCTION public.join_squad(p_user_id UUID, p_squad_id UUID)
RETURNS JSON AS $$
DECLARE
    v_can_change BOOLEAN;
    v_old_squad_id UUID;
BEGIN
    -- Check cooldown
    SELECT can_change_squad(p_user_id) INTO v_can_change;
    IF NOT v_can_change THEN
        RETURN json_build_object('success', false, 'error', 'Можно менять сквад раз в неделю');
    END IF;
    
    -- Get old squad
    SELECT squad_id INTO v_old_squad_id FROM profiles WHERE id = p_user_id;
    
    -- Leave old squad if any
    IF v_old_squad_id IS NOT NULL THEN
        UPDATE squad_members 
        SET left_at = now() 
        WHERE squad_id = v_old_squad_id AND user_id = p_user_id AND left_at IS NULL;
        
        -- Decrease old squad member count
        UPDATE squads SET member_count = member_count - 1 WHERE id = v_old_squad_id;
    END IF;
    
    -- Join new squad
    INSERT INTO squad_members (squad_id, user_id)
    VALUES (p_squad_id, p_user_id)
    ON CONFLICT (squad_id, user_id) 
    DO UPDATE SET joined_at = now(), left_at = NULL;
    
    -- Update profile
    UPDATE profiles 
    SET squad_id = p_squad_id, squad_joined_at = now()
    WHERE id = p_user_id;
    
    -- Increase new squad member count
    UPDATE squads SET member_count = member_count + 1 WHERE id = p_squad_id;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to leave squad
CREATE OR REPLACE FUNCTION public.leave_squad(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_squad_id UUID;
BEGIN
    SELECT squad_id INTO v_squad_id FROM profiles WHERE id = p_user_id;
    
    IF v_squad_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Вы не состоите в сквадe');
    END IF;
    
    -- Mark as left
    UPDATE squad_members 
    SET left_at = now() 
    WHERE squad_id = v_squad_id AND user_id = p_user_id AND left_at IS NULL;
    
    -- Clear from profile
    UPDATE profiles 
    SET squad_id = NULL, squad_joined_at = NULL
    WHERE id = p_user_id;
    
    -- Decrease squad member count
    UPDATE squads SET member_count = member_count - 1 WHERE id = v_squad_id;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get squad leaderboard
CREATE OR REPLACE FUNCTION public.get_squad_leaderboard(p_limit INT DEFAULT 10)
RETURNS TABLE (
    id UUID,
    title TEXT,
    username TEXT,
    avatar_url TEXT,
    member_count INT,
    total_popcorns INT,
    rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.title,
        s.username,
        s.avatar_url,
        s.member_count,
        s.total_popcorns,
        ROW_NUMBER() OVER (ORDER BY s.total_popcorns DESC)::BIGINT as rank
    FROM squads s
    WHERE s.is_active = true
    ORDER BY s.total_popcorns DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update squad total popcorns when user likes something
-- (This aggregates popcorns from all squad members)
CREATE OR REPLACE FUNCTION public.update_squad_popcorns()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalculate total popcorns for affected squads
    UPDATE squads s
    SET total_popcorns = COALESCE((
        SELECT COUNT(*)
        FROM quiz_likes ql
        JOIN profiles p ON p.id = ql.user_id
        WHERE p.squad_id = s.id
    ), 0) + COALESCE((
        SELECT COUNT(*)
        FROM personality_test_likes ptl
        JOIN profiles p ON p.id = ptl.user_id
        WHERE p.squad_id = s.id
    ), 0);
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- END FILE: supabase/migrations/20260203_squads.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260203_user_data_architecture.sql
-- -----------------------------------------------------------------------------
-- =====================================================
-- User Data Architecture Migration
-- Glass Quizzes - Full user tracking and analytics
-- =====================================================

-- =====================================================
-- PHASE 1: Fix RLS Policies for profiles
-- =====================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Allow anyone to create profile with telegram_id (for Telegram Mini App)
CREATE POLICY "Anyone can create profile with telegram_id" 
ON profiles FOR INSERT 
WITH CHECK (telegram_id IS NOT NULL);

-- Allow reading all profiles (for leaderboards, etc.)
CREATE POLICY "Anyone can read profiles" 
ON profiles FOR SELECT 
USING (true);

-- Allow updating own profile by telegram_id match
CREATE POLICY "Users can update own profile by telegram_id" 
ON profiles FOR UPDATE 
USING (true)
WITH CHECK (telegram_id IS NOT NULL);

-- =====================================================
-- PHASE 2: Extend profiles table
-- =====================================================

-- Add new columns for complete user data
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS platform TEXT; -- ios, android, tdesktop, web, etc.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS app_version TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_sessions INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_source TEXT; -- inline, direct, deeplink, share

-- Ensure has_telegram_premium has default
ALTER TABLE profiles ALTER COLUMN has_telegram_premium SET DEFAULT false;

-- Create index for faster lookups by telegram_id
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON profiles(telegram_id);

-- =====================================================
-- PHASE 3: Create user_events table for tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User identification (profile may not exist yet)
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  telegram_id BIGINT NOT NULL,
  
  -- Event details
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  
  -- Context
  quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL,
  session_id TEXT, -- Group events in a session
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Denormalized for fast date-based queries
  event_date DATE GENERATED ALWAYS AS (created_at::date) STORED
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_events_telegram_id ON user_events(telegram_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_date ON user_events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_quiz ON user_events(quiz_id);
CREATE INDEX IF NOT EXISTS idx_events_session ON user_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON user_events(created_at DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_events_type_date ON user_events(event_type, event_date);

-- RLS for user_events
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert events (from Mini App)
CREATE POLICY "Anyone can insert events" 
ON user_events FOR INSERT 
WITH CHECK (telegram_id IS NOT NULL);

-- Anyone can read events (for analytics)
CREATE POLICY "Anyone can read events" 
ON user_events FOR SELECT 
USING (true);

-- =====================================================
-- PHASE 4: Analytics RPC Functions
-- =====================================================

-- Get DAU/WAU/MAU
CREATE OR REPLACE FUNCTION get_active_users_by_period(days_back INT DEFAULT 30)
RETURNS TABLE(event_date DATE, unique_users BIGINT) AS $$
  SELECT 
    event_date,
    COUNT(DISTINCT telegram_id) as unique_users
  FROM user_events
  WHERE event_date >= CURRENT_DATE - days_back
  GROUP BY event_date
  ORDER BY event_date;
$$ LANGUAGE sql STABLE;

-- Get DAU (single number)
CREATE OR REPLACE FUNCTION get_dau()
RETURNS BIGINT AS $$
  SELECT COUNT(DISTINCT telegram_id)
  FROM user_events
  WHERE event_date = CURRENT_DATE;
$$ LANGUAGE sql STABLE;

-- Get WAU (single number)
CREATE OR REPLACE FUNCTION get_wau()
RETURNS BIGINT AS $$
  SELECT COUNT(DISTINCT telegram_id)
  FROM user_events
  WHERE event_date >= CURRENT_DATE - 7;
$$ LANGUAGE sql STABLE;

-- Get MAU (single number)
CREATE OR REPLACE FUNCTION get_mau()
RETURNS BIGINT AS $$
  SELECT COUNT(DISTINCT telegram_id)
  FROM user_events
  WHERE event_date >= CURRENT_DATE - 30;
$$ LANGUAGE sql STABLE;

-- Get quiz funnel for date range
CREATE OR REPLACE FUNCTION get_quiz_funnel(from_date DATE DEFAULT CURRENT_DATE - 7, to_date DATE DEFAULT CURRENT_DATE)
RETURNS JSON AS $$
  WITH event_counts AS (
    SELECT 
      event_type,
      COUNT(DISTINCT telegram_id) as users
    FROM user_events
    WHERE event_date BETWEEN from_date AND to_date
      AND event_type IN ('quiz_view', 'quiz_start', 'quiz_complete', 'quiz_share')
    GROUP BY event_type
  )
  SELECT json_build_object(
    'viewed', COALESCE((SELECT users FROM event_counts WHERE event_type = 'quiz_view'), 0),
    'started', COALESCE((SELECT users FROM event_counts WHERE event_type = 'quiz_start'), 0),
    'completed', COALESCE((SELECT users FROM event_counts WHERE event_type = 'quiz_complete'), 0),
    'shared', COALESCE((SELECT users FROM event_counts WHERE event_type = 'quiz_share'), 0)
  );
$$ LANGUAGE sql STABLE;

-- Get total shares count
CREATE OR REPLACE FUNCTION get_total_shares()
RETURNS BIGINT AS $$
  SELECT COUNT(*)
  FROM user_events
  WHERE event_type = 'quiz_share';
$$ LANGUAGE sql STABLE;

-- Get average completion time in seconds
CREATE OR REPLACE FUNCTION get_avg_completion_time()
RETURNS NUMERIC AS $$
  SELECT COALESCE(
    AVG((event_data->>'time_total_ms')::numeric) / 1000,
    60 -- Default 60 seconds if no data
  )
  FROM user_events
  WHERE event_type = 'quiz_complete'
    AND event_data->>'time_total_ms' IS NOT NULL;
$$ LANGUAGE sql STABLE;

-- Get retention cohorts (weekly)
CREATE OR REPLACE FUNCTION get_retention_cohorts(weeks_back INT DEFAULT 8)
RETURNS TABLE(
  cohort_week DATE,
  week_number INT,
  retained_users BIGINT,
  cohort_size BIGINT,
  retention_rate NUMERIC
) AS $$
  WITH cohorts AS (
    -- First activity week for each user
    SELECT 
      telegram_id,
      DATE_TRUNC('week', MIN(created_at))::date AS cohort_week
    FROM user_events
    WHERE created_at >= CURRENT_DATE - (weeks_back * 7)
    GROUP BY telegram_id
  ),
  cohort_sizes AS (
    SELECT cohort_week, COUNT(*) as size
    FROM cohorts
    GROUP BY cohort_week
  ),
  activity AS (
    SELECT DISTINCT
      telegram_id,
      DATE_TRUNC('week', created_at)::date AS activity_week
    FROM user_events
    WHERE created_at >= CURRENT_DATE - (weeks_back * 7)
  ),
  retention AS (
    SELECT 
      c.cohort_week,
      ((a.activity_week - c.cohort_week) / 7)::int AS week_number,
      COUNT(DISTINCT a.telegram_id) AS retained
    FROM cohorts c
    JOIN activity a ON c.telegram_id = a.telegram_id
    GROUP BY c.cohort_week, week_number
  )
  SELECT 
    r.cohort_week,
    r.week_number,
    r.retained as retained_users,
    cs.size as cohort_size,
    ROUND(r.retained::numeric / cs.size * 100, 1) as retention_rate
  FROM retention r
  JOIN cohort_sizes cs ON r.cohort_week = cs.cohort_week
  WHERE r.week_number >= 0
  ORDER BY r.cohort_week, r.week_number;
$$ LANGUAGE sql STABLE;

-- Get event counts by type for period
CREATE OR REPLACE FUNCTION get_event_stats(from_date DATE DEFAULT CURRENT_DATE - 7, to_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(event_type TEXT, event_count BIGINT, unique_users BIGINT) AS $$
  SELECT 
    event_type,
    COUNT(*) as event_count,
    COUNT(DISTINCT telegram_id) as unique_users
  FROM user_events
  WHERE event_date BETWEEN from_date AND to_date
  GROUP BY event_type
  ORDER BY event_count DESC;
$$ LANGUAGE sql STABLE;

-- Get top quizzes by completions
CREATE OR REPLACE FUNCTION get_top_quizzes_by_completions(limit_count INT DEFAULT 10)
RETURNS TABLE(quiz_id UUID, title TEXT, completions BIGINT, shares BIGINT) AS $$
  SELECT 
    q.id as quiz_id,
    q.title,
    COUNT(DISTINCT CASE WHEN e.event_type = 'quiz_complete' THEN e.telegram_id END) as completions,
    COUNT(DISTINCT CASE WHEN e.event_type = 'quiz_share' THEN e.telegram_id END) as shares
  FROM quizzes q
  LEFT JOIN user_events e ON e.quiz_id = q.id
  WHERE q.is_published = true
  GROUP BY q.id, q.title
  ORDER BY completions DESC
  LIMIT limit_count;
$$ LANGUAGE sql STABLE;

-- Get user sources (where users come from)
CREATE OR REPLACE FUNCTION get_user_sources(days_back INT DEFAULT 30)
RETURNS TABLE(source TEXT, user_count BIGINT, percentage NUMERIC) AS $$
  WITH sources AS (
    SELECT 
      COALESCE(referral_source, 'direct') as source,
      COUNT(*) as cnt
    FROM profiles
    WHERE created_at >= CURRENT_DATE - days_back
    GROUP BY referral_source
  ),
  total AS (
    SELECT SUM(cnt) as total FROM sources
  )
  SELECT 
    s.source,
    s.cnt as user_count,
    ROUND(s.cnt::numeric / t.total * 100, 1) as percentage
  FROM sources s, total t
  ORDER BY s.cnt DESC;
$$ LANGUAGE sql STABLE;

-- =====================================================
-- Grant permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION get_active_users_by_period TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_dau TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_wau TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_mau TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_quiz_funnel TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_total_shares TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_avg_completion_time TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_retention_cohorts TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_event_stats TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_top_quizzes_by_completions TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_sources TO authenticated, anon;

-- =====================================================
-- Done!
-- =====================================================

-- END FILE: supabase/migrations/20260203_user_data_architecture.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260204_fix_leaderboards.sql
-- -----------------------------------------------------------------------------
-- Fix leaderboard functions

-- 1. Fix creators leaderboard - include ALL creators with published content (even with 0 likes)
-- Also include personality tests
CREATE OR REPLACE FUNCTION get_leaderboard_by_popcorns(limit_count INT DEFAULT 100)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  first_name TEXT,
  avatar_url TEXT,
  has_premium BOOLEAN,
  total_popcorns BIGINT,
  quiz_count BIGINT,
  popcorns BIGINT,
  rank BIGINT
) AS $$
  WITH creator_stats AS (
    -- Quiz creators
    SELECT 
      q.created_by as creator_id,
      COALESCE(SUM(q.like_count), 0) as likes,
      COUNT(*) as content_count
    FROM quizzes q
    WHERE q.status = 'published' AND q.created_by IS NOT NULL
    GROUP BY q.created_by
    
    UNION ALL
    
    -- Personality test creators
    SELECT 
      pt.created_by as creator_id,
      COALESCE(SUM(pt.like_count), 0) as likes,
      COUNT(*) as content_count
    FROM personality_tests pt
    WHERE pt.status = 'published' AND pt.created_by IS NOT NULL
    GROUP BY pt.created_by
  ),
  aggregated AS (
    SELECT 
      creator_id,
      SUM(likes)::BIGINT as total_likes,
      SUM(content_count)::BIGINT as total_content
    FROM creator_stats
    GROUP BY creator_id
  )
  SELECT 
    a.creator_id as user_id,
    p.username,
    p.first_name,
    p.avatar_url,
    p.has_telegram_premium as has_premium,
    a.total_likes as total_popcorns,
    a.total_content as quiz_count,
    a.total_likes as popcorns,
    ROW_NUMBER() OVER (ORDER BY a.total_likes DESC, a.total_content DESC) as rank
  FROM aggregated a
  JOIN profiles p ON p.id = a.creator_id
  ORDER BY total_popcorns DESC, quiz_count DESC
  LIMIT limit_count;
$$ LANGUAGE sql STABLE;

-- 2. Fix squad leaderboard - also show squads with 0 popcorns
CREATE OR REPLACE FUNCTION public.get_squad_leaderboard(p_limit INT DEFAULT 10)
RETURNS TABLE (
    id UUID,
    title TEXT,
    username TEXT,
    avatar_url TEXT,
    member_count INT,
    total_popcorns INT,
    invite_link TEXT,
    rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.title,
        s.username,
        s.avatar_url,
        s.member_count,
        s.total_popcorns,
        s.invite_link,
        ROW_NUMBER() OVER (ORDER BY s.total_popcorns DESC, s.member_count DESC)::BIGINT as rank
    FROM squads s
    WHERE s.is_active = true
    ORDER BY s.total_popcorns DESC, s.member_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_leaderboard_by_popcorns TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_squad_leaderboard TO authenticated, anon;

-- 3. Update squad member count when user joins/leaves
CREATE OR REPLACE FUNCTION public.update_squad_member_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update old squad member count (if leaving)
    IF OLD.squad_id IS NOT NULL AND (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        UPDATE squads SET member_count = (
            SELECT COUNT(*) FROM profiles WHERE squad_id = OLD.squad_id
        ) WHERE id = OLD.squad_id;
    END IF;
    
    -- Update new squad member count (if joining)
    IF NEW.squad_id IS NOT NULL AND (TG_OP = 'UPDATE' OR TG_OP = 'INSERT') THEN
        UPDATE squads SET member_count = (
            SELECT COUNT(*) FROM profiles WHERE squad_id = NEW.squad_id
        ) WHERE id = NEW.squad_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for squad member count
DROP TRIGGER IF EXISTS trigger_update_squad_member_count ON profiles;
CREATE TRIGGER trigger_update_squad_member_count
AFTER INSERT OR UPDATE OF squad_id OR DELETE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_squad_member_count();

-- END FILE: supabase/migrations/20260204_fix_leaderboards.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260206093000_add_personality_test_participant_trigger.sql
-- -----------------------------------------------------------------------------
-- Increment participant_count on personality test completion
CREATE OR REPLACE FUNCTION public.update_personality_test_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.personality_tests
  SET participant_count = participant_count + 1
  WHERE id = NEW.test_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_personality_test_completion_insert ON public.personality_test_completions;
CREATE TRIGGER on_personality_test_completion_insert
AFTER INSERT ON public.personality_test_completions
FOR EACH ROW
EXECUTE FUNCTION public.update_personality_test_participant_count();

-- END FILE: supabase/migrations/20260206093000_add_personality_test_participant_trigger.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260206120000_add_anonymous_publishing.sql
-- -----------------------------------------------------------------------------
-- Add anonymous publishing flag to quizzes and personality tests
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.personality_tests
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false;

-- Public views with creator masking for anonymous content
CREATE OR REPLACE VIEW public.quizzes_public AS
SELECT
  q.id,
  q.title,
  q.description,
  q.image_url,
  CASE
    WHEN q.is_anonymous = true
      AND NOT (q.created_by = auth.uid() OR public.is_admin(auth.uid()))
      THEN NULL
    ELSE q.created_by
  END AS created_by,
  q.question_count,
  q.participant_count,
  q.duration_seconds,
  q.is_published,
  q.created_at,
  q.updated_at,
  q.rating,
  q.rating_count,
  q.like_count,
  q.save_count,
  q.status,
  q.rejection_reason,
  q.submitted_at,
  q.moderated_by,
  q.moderated_at,
  q.is_anonymous
FROM public.quizzes q;

CREATE OR REPLACE VIEW public.personality_tests_public AS
SELECT
  pt.id,
  pt.title,
  pt.description,
  pt.image_url,
  CASE
    WHEN pt.is_anonymous = true
      AND NOT (pt.created_by = auth.uid() OR public.is_admin(auth.uid()))
      THEN NULL
    ELSE pt.created_by
  END AS created_by,
  pt.question_count,
  pt.result_count,
  pt.participant_count,
  pt.like_count,
  pt.save_count,
  pt.is_published,
  pt.created_at,
  pt.updated_at,
  pt.is_anonymous
FROM public.personality_tests pt;

GRANT SELECT ON public.quizzes_public TO anon, authenticated;
GRANT SELECT ON public.personality_tests_public TO anon, authenticated;

-- Update leaderboard function to exclude anonymous content
CREATE OR REPLACE FUNCTION public.get_leaderboard_by_popcorns(limit_count INT DEFAULT 100)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  first_name TEXT,
  avatar_url TEXT,
  has_premium BOOLEAN,
  total_popcorns BIGINT,
  quiz_count BIGINT,
  popcorns BIGINT,
  rank BIGINT
) AS $$
  WITH creator_stats AS (
    -- Quiz creators
    SELECT 
      q.created_by as creator_id,
      COALESCE(SUM(q.like_count), 0) as likes,
      COUNT(*) as content_count
    FROM quizzes q
    WHERE (q.status = 'published' OR q.is_published = true)
      AND q.created_by IS NOT NULL
      AND COALESCE(q.is_anonymous, false) = false
    GROUP BY q.created_by
    
    UNION ALL
    
    -- Personality test creators
    SELECT 
      pt.created_by as creator_id,
      COALESCE(SUM(pt.like_count), 0) as likes,
      COUNT(*) as content_count
    FROM personality_tests pt
    WHERE pt.is_published = true
      AND pt.created_by IS NOT NULL
      AND COALESCE(pt.is_anonymous, false) = false
    GROUP BY pt.created_by
  ),
  aggregated AS (
    SELECT 
      creator_id,
      SUM(likes)::BIGINT as total_likes,
      SUM(content_count)::BIGINT as total_content
    FROM creator_stats
    GROUP BY creator_id
  )
  SELECT 
    a.creator_id as user_id,
    p.username,
    p.first_name,
    p.avatar_url,
    p.has_telegram_premium as has_premium,
    a.total_likes as total_popcorns,
    a.total_content as quiz_count,
    a.total_likes as popcorns,
    ROW_NUMBER() OVER (ORDER BY a.total_likes DESC, a.total_content DESC) as rank
  FROM aggregated a
  JOIN profiles p ON p.id = a.creator_id
  ORDER BY total_popcorns DESC, quiz_count DESC
  LIMIT limit_count;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.get_leaderboard_by_popcorns TO authenticated, anon;

-- END FILE: supabase/migrations/20260206120000_add_anonymous_publishing.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260206173000_prediction_gated_create.sql
-- -----------------------------------------------------------------------------
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


-- END FILE: supabase/migrations/20260206173000_prediction_gated_create.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260206201000_prediction_moderation_admin.sql
-- -----------------------------------------------------------------------------
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

-- END FILE: supabase/migrations/20260206201000_prediction_moderation_admin.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260206214000_prediction_eligibility_and_admin_hotfix.sql
-- -----------------------------------------------------------------------------
-- Hotfix: eligibility counting + admin bypass bootstrap for prediction create flow

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

    -- Base completion sources
    SELECT COUNT(*) INTO v_quiz_count
    FROM public.quiz_results qr
    WHERE qr.user_id = p_user_id;

    SELECT COUNT(*) INTO v_test_count
    FROM public.personality_test_completions ptc
    WHERE ptc.user_id = p_user_id;

    -- Fallback: track quiz completions by telemetry events if quiz_results not present
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

  -- Admin bootstrap for testing/dev environments: if no admins exist, current caller becomes admin.
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
        -- If role insert is unavailable in this environment, keep virtual admin for this response.
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

  -- Admin bypass: skips progress/captain/month-limit/cooldown checks, but still requires squad context.
  IF NOT v_has_squad THEN
    v_blocking_reason := 'need_squad';
  ELSIF NOT v_is_admin THEN
    IF v_total_completed < v_required_count THEN
      v_blocking_reason := 'need_progress';
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

-- END FILE: supabase/migrations/20260206214000_prediction_eligibility_and_admin_hotfix.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260206230000_add_track_referral_rpc.sql
-- -----------------------------------------------------------------------------
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

-- END FILE: supabase/migrations/20260206230000_add_track_referral_rpc.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260206232500_content_moderation_toggle.sql
-- -----------------------------------------------------------------------------
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

-- END FILE: supabase/migrations/20260206232500_content_moderation_toggle.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260207000100_admin_analytics_plus.sql
-- -----------------------------------------------------------------------------
-- Analytics+ admin RPC layer, fallback-safe over mixed schemas.

-- ---------------------------------------------------------------------------
-- Indexes for analytics-heavy reads
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.user_events') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_events_type_created_at ON public.user_events(event_type, created_at)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_events_quiz_created_at ON public.user_events(quiz_id, created_at)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_events_screen_name ON public.user_events((event_data->>''screen_name''))';
  END IF;

  IF to_regclass('public.quiz_results') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_quiz_results_completed_at_quiz_id ON public.quiz_results(completed_at, quiz_id)';
  END IF;

  IF to_regclass('public.personality_test_completions') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ptc_completed_at_test_id ON public.personality_test_completions(completed_at, test_id)';
  END IF;

  IF to_regclass('public.prediction_polls') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_prediction_polls_status_created_at_analytics ON public.prediction_polls(status, created_at)';
  END IF;

  IF to_regclass('public.user_tasks') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_tasks_completed_at_task_id ON public.user_tasks(completed_at, task_id)';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_analytics_require_admin();
CREATE OR REPLACE FUNCTION public.admin_analytics_require_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin_only'
      USING ERRCODE = '42501',
            MESSAGE = 'Admin access required';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_analytics_active_users_count(TIMESTAMPTZ, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION public.admin_analytics_active_users_count(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT := 0;
  v_union_sql TEXT := '';
BEGIN
  IF to_regclass('public.user_events') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text))
      FROM public.user_events ue
      WHERE ue.created_at >= $1
        AND ue.created_at < $2
    $sql$
    INTO v_count
    USING p_from, p_to;
  END IF;

  IF COALESCE(v_count, 0) = 0 THEN
    IF to_regclass('public.quiz_results') IS NOT NULL THEN
      v_union_sql := v_union_sql || '
        SELECT DISTINCT qr.user_id::text AS actor
        FROM public.quiz_results qr
        WHERE qr.completed_at >= $1
          AND qr.completed_at < $2
      ';
    END IF;

    IF to_regclass('public.personality_test_completions') IS NOT NULL THEN
      IF v_union_sql <> '' THEN
        v_union_sql := v_union_sql || ' UNION ';
      END IF;
      v_union_sql := v_union_sql || '
        SELECT DISTINCT ptc.user_id::text AS actor
        FROM public.personality_test_completions ptc
        WHERE ptc.completed_at >= $1
          AND ptc.completed_at < $2
      ';
    ELSIF to_regclass('public.user_personality_results') IS NOT NULL THEN
      IF v_union_sql <> '' THEN
        v_union_sql := v_union_sql || ' UNION ';
      END IF;
      v_union_sql := v_union_sql || '
        SELECT DISTINCT upr.user_id::text AS actor
        FROM public.user_personality_results upr
        WHERE upr.completed_at >= $1
          AND upr.completed_at < $2
      ';
    END IF;

    IF to_regclass('public.user_tasks') IS NOT NULL THEN
      IF v_union_sql <> '' THEN
        v_union_sql := v_union_sql || ' UNION ';
      END IF;
      v_union_sql := v_union_sql || '
        SELECT DISTINCT ut.user_id::text AS actor
        FROM public.user_tasks ut
        WHERE ut.completed_at >= $1
          AND ut.completed_at < $2
      ';
    END IF;

    IF v_union_sql <> '' THEN
      EXECUTE 'SELECT COUNT(*) FROM (' || v_union_sql || ') ids'
      INTO v_count
      USING p_from, p_to;
    END IF;
  END IF;

  RETURN COALESCE(v_count, 0);
END;
$$;

-- ---------------------------------------------------------------------------
-- 1) Overview
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_analytics_overview(TIMESTAMPTZ, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION public.admin_analytics_overview(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS TABLE (
  dau BIGINT,
  wau BIGINT,
  mau BIGINT,
  stickiness_pct NUMERIC,
  total_users BIGINT,
  new_users BIGINT,
  referrals BIGINT,
  quiz_views BIGINT,
  quiz_starts BIGINT,
  quiz_completes BIGINT,
  quiz_shares BIGINT,
  test_views BIGINT,
  test_starts BIGINT,
  test_completes BIGINT,
  test_shares BIGINT,
  avg_quiz_time_seconds NUMERIC,
  avg_quiz_score_pct NUMERIC,
  prediction_created BIGINT,
  prediction_pending BIGINT,
  prediction_under_review BIGINT,
  prediction_resolved BIGINT,
  prediction_reports BIGINT,
  task_completions BIGINT,
  unique_task_completers BIGINT,
  error_events BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reference_date DATE := ((p_to AT TIME ZONE 'UTC')::date - 1);
  v_dau BIGINT := 0;
  v_wau BIGINT := 0;
  v_mau BIGINT := 0;
  v_total_users BIGINT := 0;
  v_new_users BIGINT := 0;
  v_referrals BIGINT := 0;
  v_quiz_views BIGINT := 0;
  v_quiz_starts BIGINT := 0;
  v_quiz_completes BIGINT := 0;
  v_quiz_shares BIGINT := 0;
  v_test_views BIGINT := 0;
  v_test_starts BIGINT := 0;
  v_test_completes BIGINT := 0;
  v_test_shares BIGINT := 0;
  v_avg_quiz_time_seconds NUMERIC := 0;
  v_avg_quiz_score_pct NUMERIC := 0;
  v_prediction_created BIGINT := 0;
  v_prediction_pending BIGINT := 0;
  v_prediction_under_review BIGINT := 0;
  v_prediction_resolved BIGINT := 0;
  v_prediction_reports BIGINT := 0;
  v_task_completions BIGINT := 0;
  v_unique_task_completers BIGINT := 0;
  v_error_events BIGINT := 0;
BEGIN
  PERFORM public.admin_analytics_require_admin();

  IF to_regclass('public.user_events') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text))
      FROM public.user_events ue
      WHERE ue.created_at::date = $1
    $sql$ INTO v_dau USING v_reference_date;

    EXECUTE $sql$
      SELECT COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text))
      FROM public.user_events ue
      WHERE ue.created_at::date >= ($1 - 6)
        AND ue.created_at::date <= $1
    $sql$ INTO v_wau USING v_reference_date;

    EXECUTE $sql$
      SELECT COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text))
      FROM public.user_events ue
      WHERE ue.created_at::date >= ($1 - 29)
        AND ue.created_at::date <= $1
    $sql$ INTO v_mau USING v_reference_date;

    EXECUTE $sql$
      SELECT
        COUNT(*) FILTER (WHERE ue.event_type = 'quiz_view') AS quiz_views,
        COUNT(*) FILTER (WHERE ue.event_type = 'quiz_start') AS quiz_starts,
        COUNT(*) FILTER (WHERE ue.event_type IN ('quiz_complete', 'quiz_completed')) AS quiz_completes,
        COUNT(*) FILTER (WHERE ue.event_type = 'quiz_share') AS quiz_shares,
        COUNT(*) FILTER (WHERE ue.event_type = 'test_view') AS test_views,
        COUNT(*) FILTER (WHERE ue.event_type = 'test_start') AS test_starts,
        COUNT(*) FILTER (WHERE ue.event_type = 'test_complete') AS test_completes,
        COUNT(*) FILTER (WHERE ue.event_type = 'test_share') AS test_shares,
        COUNT(*) FILTER (WHERE ue.event_type = 'error') AS error_events,
        COALESCE(AVG(((ue.event_data->>'time_total_ms')::numeric) / 1000)
          FILTER (WHERE ue.event_type IN ('quiz_complete', 'quiz_completed') AND ue.event_data ? 'time_total_ms'), 0) AS avg_time,
        COALESCE(AVG(
          CASE
            WHEN (ue.event_data->>'max_score')::numeric > 0
              THEN ((ue.event_data->>'score')::numeric / NULLIF((ue.event_data->>'max_score')::numeric, 0)) * 100
            ELSE NULL
          END
        ) FILTER (WHERE ue.event_type IN ('quiz_complete', 'quiz_completed') AND ue.event_data ? 'score' AND ue.event_data ? 'max_score'), 0) AS avg_score
      FROM public.user_events ue
      WHERE ue.created_at >= $1
        AND ue.created_at < $2
    $sql$
    INTO
      v_quiz_views,
      v_quiz_starts,
      v_quiz_completes,
      v_quiz_shares,
      v_test_views,
      v_test_starts,
      v_test_completes,
      v_test_shares,
      v_error_events,
      v_avg_quiz_time_seconds,
      v_avg_quiz_score_pct
    USING p_from, p_to;
  ELSIF to_regclass('public.events') IS NOT NULL THEN
    SELECT
      COUNT(*) FILTER (WHERE e.event_type IN ('quiz_view', 'quiz_viewed')),
      COUNT(*) FILTER (WHERE e.event_type IN ('quiz_start', 'quiz_started')),
      COUNT(*) FILTER (WHERE e.event_type IN ('quiz_complete', 'quiz_completed')),
      COUNT(*) FILTER (WHERE e.event_type IN ('quiz_share', 'share_clicked')),
      COUNT(*) FILTER (WHERE e.event_type = 'error')
    INTO
      v_quiz_views,
      v_quiz_starts,
      v_quiz_completes,
      v_quiz_shares,
      v_error_events
    FROM public.events e
    WHERE e.created_at >= p_from
      AND e.created_at < p_to;

    SELECT COALESCE(COUNT(DISTINCT e.user_id), 0)
      INTO v_dau
    FROM public.events e
    WHERE e.created_at::date = v_reference_date;

    SELECT COALESCE(COUNT(DISTINCT e.user_id), 0)
      INTO v_wau
    FROM public.events e
    WHERE e.created_at::date >= (v_reference_date - 6)
      AND e.created_at::date <= v_reference_date;

    SELECT COALESCE(COUNT(DISTINCT e.user_id), 0)
      INTO v_mau
    FROM public.events e
    WHERE e.created_at::date >= (v_reference_date - 29)
      AND e.created_at::date <= v_reference_date;
  END IF;

  IF to_regclass('public.quiz_results') IS NOT NULL THEN
    SELECT COUNT(*),
           COALESCE(AVG(qr.time_taken_seconds::numeric), 0),
           COALESCE(AVG((qr.score::numeric / NULLIF(qr.max_score::numeric, 0)) * 100), 0)
    INTO v_quiz_completes, v_avg_quiz_time_seconds, v_avg_quiz_score_pct
    FROM public.quiz_results qr
    WHERE qr.completed_at >= p_from
      AND qr.completed_at < p_to;
  END IF;

  IF to_regclass('public.personality_test_completions') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_test_completes
    FROM public.personality_test_completions ptc
    WHERE ptc.completed_at >= p_from
      AND ptc.completed_at < p_to;
  ELSIF to_regclass('public.user_personality_results') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_test_completes
    FROM public.user_personality_results upr
    WHERE upr.completed_at >= p_from
      AND upr.completed_at < p_to;
  END IF;

  IF to_regclass('public.shares') IS NOT NULL THEN
    SELECT
      COUNT(*) FILTER (WHERE COALESCE(s.content_type, 'quiz') = 'quiz'),
      COUNT(*) FILTER (WHERE COALESCE(s.content_type, 'quiz') = 'personality_test')
    INTO v_quiz_shares, v_test_shares
    FROM public.shares s
    WHERE COALESCE(s.created_at, s.shared_at) >= p_from
      AND COALESCE(s.created_at, s.shared_at) < p_to;
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_total_users FROM public.profiles;
    SELECT COUNT(*)
    INTO v_new_users
    FROM public.profiles p
    WHERE p.created_at >= p_from
      AND p.created_at < p_to;
  END IF;

  IF to_regclass('public.referrals') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_referrals
    FROM public.referrals r
    WHERE r.created_at >= p_from
      AND r.created_at < p_to;
  END IF;

  IF to_regclass('public.prediction_polls') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_prediction_created
    FROM public.prediction_polls pp
    WHERE pp.created_at >= p_from
      AND pp.created_at < p_to;

    SELECT COUNT(*) INTO v_prediction_pending FROM public.prediction_polls WHERE status = 'pending';
    SELECT COUNT(*) INTO v_prediction_under_review FROM public.prediction_polls WHERE status = 'under_review';
    SELECT COUNT(*) INTO v_prediction_resolved FROM public.prediction_polls WHERE status = 'resolved';
  END IF;

  IF to_regclass('public.prediction_reports') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_prediction_reports
    FROM public.prediction_reports pr
    WHERE pr.created_at >= p_from
      AND pr.created_at < p_to;
  END IF;

  IF to_regclass('public.user_tasks') IS NOT NULL THEN
    SELECT COUNT(*), COUNT(DISTINCT ut.user_id)
    INTO v_task_completions, v_unique_task_completers
    FROM public.user_tasks ut
    WHERE ut.completed_at >= p_from
      AND ut.completed_at < p_to;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(v_dau, 0),
    COALESCE(v_wau, 0),
    COALESCE(v_mau, 0),
    CASE WHEN COALESCE(v_mau, 0) > 0 THEN ROUND((v_dau::numeric / v_mau::numeric) * 100, 1) ELSE 0 END,
    COALESCE(v_total_users, 0),
    COALESCE(v_new_users, 0),
    COALESCE(v_referrals, 0),
    COALESCE(v_quiz_views, 0),
    COALESCE(v_quiz_starts, 0),
    COALESCE(v_quiz_completes, 0),
    COALESCE(v_quiz_shares, 0),
    COALESCE(v_test_views, 0),
    COALESCE(v_test_starts, 0),
    COALESCE(v_test_completes, 0),
    COALESCE(v_test_shares, 0),
    ROUND(COALESCE(v_avg_quiz_time_seconds, 0), 1),
    ROUND(COALESCE(v_avg_quiz_score_pct, 0), 1),
    COALESCE(v_prediction_created, 0),
    COALESCE(v_prediction_pending, 0),
    COALESCE(v_prediction_under_review, 0),
    COALESCE(v_prediction_resolved, 0),
    COALESCE(v_prediction_reports, 0),
    COALESCE(v_task_completions, 0),
    COALESCE(v_unique_task_completers, 0),
    COALESCE(v_error_events, 0);
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Timeseries
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_analytics_timeseries(DATE, DATE);
CREATE OR REPLACE FUNCTION public.admin_analytics_timeseries(
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (
  metric_date DATE,
  dau BIGINT,
  quiz_completes BIGINT,
  test_completes BIGINT,
  shares BIGINT,
  prediction_reports BIGINT,
  task_completions BIGINT,
  error_events BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day DATE;
  v_has_user_events BOOLEAN := to_regclass('public.user_events') IS NOT NULL;
BEGIN
  PERFORM public.admin_analytics_require_admin();

  FOR v_day IN
    SELECT gs::date
    FROM generate_series(p_from, p_to, interval '1 day') gs
  LOOP
    metric_date := v_day;
    dau := 0;
    quiz_completes := 0;
    test_completes := 0;
    shares := 0;
    prediction_reports := 0;
    task_completions := 0;
    error_events := 0;

    IF v_has_user_events THEN
      EXECUTE $sql$
        SELECT
          COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) AS dau,
          COUNT(*) FILTER (WHERE ue.event_type IN ('quiz_complete', 'quiz_completed')) AS quiz_completes,
          COUNT(*) FILTER (WHERE ue.event_type = 'test_complete') AS test_completes,
          COUNT(*) FILTER (WHERE ue.event_type IN ('quiz_share', 'test_share')) AS shares,
          COUNT(*) FILTER (WHERE ue.event_type = 'error') AS error_events
        FROM public.user_events ue
        WHERE ue.created_at >= $1
          AND ue.created_at < ($1 + interval '1 day')
      $sql$
      INTO dau, quiz_completes, test_completes, shares, error_events
      USING v_day::timestamptz;
    ELSIF to_regclass('public.events') IS NOT NULL THEN
      SELECT
        COALESCE(COUNT(DISTINCT e.user_id), 0),
        COALESCE(COUNT(*) FILTER (WHERE e.event_type IN ('quiz_complete', 'quiz_completed')), 0),
        COALESCE(COUNT(*) FILTER (WHERE e.event_type IN ('quiz_share', 'share_clicked')), 0),
        COALESCE(COUNT(*) FILTER (WHERE e.event_type = 'error'), 0)
      INTO dau, quiz_completes, shares, error_events
      FROM public.events e
      WHERE e.created_at >= v_day::timestamptz
        AND e.created_at < (v_day::timestamptz + interval '1 day');
    END IF;

    IF to_regclass('public.quiz_results') IS NOT NULL THEN
      SELECT COALESCE(COUNT(*), 0)
      INTO quiz_completes
      FROM public.quiz_results qr
      WHERE qr.completed_at >= v_day::timestamptz
        AND qr.completed_at < (v_day::timestamptz + interval '1 day');
    END IF;

    IF to_regclass('public.personality_test_completions') IS NOT NULL THEN
      SELECT COALESCE(COUNT(*), 0)
      INTO test_completes
      FROM public.personality_test_completions ptc
      WHERE ptc.completed_at >= v_day::timestamptz
        AND ptc.completed_at < (v_day::timestamptz + interval '1 day');
    ELSIF to_regclass('public.user_personality_results') IS NOT NULL THEN
      SELECT COALESCE(COUNT(*), 0)
      INTO test_completes
      FROM public.user_personality_results upr
      WHERE upr.completed_at >= v_day::timestamptz
        AND upr.completed_at < (v_day::timestamptz + interval '1 day');
    END IF;

    IF to_regclass('public.shares') IS NOT NULL THEN
      SELECT COALESCE(COUNT(*), 0)
      INTO shares
      FROM public.shares s
      WHERE COALESCE(s.created_at, s.shared_at) >= v_day::timestamptz
        AND COALESCE(s.created_at, s.shared_at) < (v_day::timestamptz + interval '1 day');
    END IF;

    IF to_regclass('public.prediction_reports') IS NOT NULL THEN
      SELECT COALESCE(COUNT(*), 0)
      INTO prediction_reports
      FROM public.prediction_reports pr
      WHERE pr.created_at >= v_day::timestamptz
        AND pr.created_at < (v_day::timestamptz + interval '1 day');
    END IF;

    IF to_regclass('public.user_tasks') IS NOT NULL THEN
      SELECT COALESCE(COUNT(*), 0)
      INTO task_completions
      FROM public.user_tasks ut
      WHERE ut.completed_at >= v_day::timestamptz
        AND ut.completed_at < (v_day::timestamptz + interval '1 day');
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Funnel: Quiz
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_analytics_funnel_quiz(DATE, DATE);
CREATE OR REPLACE FUNCTION public.admin_analytics_funnel_quiz(
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (
  stage TEXT,
  users BIGINT,
  conversion_from_prev NUMERIC,
  conversion_from_first NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewed BIGINT := 0;
  v_started BIGINT := 0;
  v_completed BIGINT := 0;
  v_shared BIGINT := 0;
BEGIN
  PERFORM public.admin_analytics_require_admin();

  IF to_regclass('public.user_events') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT
        COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'quiz_view') AS viewed,
        COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'quiz_start') AS started,
        COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type IN ('quiz_complete', 'quiz_completed')) AS completed,
        COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'quiz_share') AS shared
      FROM public.user_events ue
      WHERE ue.created_at::date >= $1
        AND ue.created_at::date <= $2
    $sql$
    INTO v_viewed, v_started, v_completed, v_shared
    USING p_from, p_to;
  ELSIF to_regclass('public.events') IS NOT NULL THEN
    SELECT
      COALESCE(COUNT(DISTINCT e.user_id) FILTER (WHERE e.event_type IN ('quiz_view', 'quiz_viewed')), 0),
      COALESCE(COUNT(DISTINCT e.user_id) FILTER (WHERE e.event_type IN ('quiz_start', 'quiz_started')), 0),
      COALESCE(COUNT(DISTINCT e.user_id) FILTER (WHERE e.event_type IN ('quiz_complete', 'quiz_completed')), 0),
      COALESCE(COUNT(DISTINCT e.user_id) FILTER (WHERE e.event_type IN ('quiz_share', 'share_clicked')), 0)
    INTO v_viewed, v_started, v_completed, v_shared
    FROM public.events e
    WHERE e.created_at::date >= p_from
      AND e.created_at::date <= p_to;
  END IF;

  IF to_regclass('public.quiz_results') IS NOT NULL THEN
    SELECT COALESCE(COUNT(DISTINCT qr.user_id), 0)
    INTO v_completed
    FROM public.quiz_results qr
    WHERE qr.completed_at::date >= p_from
      AND qr.completed_at::date <= p_to;
  END IF;

  IF to_regclass('public.shares') IS NOT NULL THEN
    SELECT COALESCE(COUNT(DISTINCT s.user_id), 0)
    INTO v_shared
    FROM public.shares s
    WHERE COALESCE(s.created_at, s.shared_at)::date >= p_from
      AND COALESCE(s.created_at, s.shared_at)::date <= p_to
      AND COALESCE(s.content_type, 'quiz') = 'quiz';
  END IF;

  IF v_viewed = 0 AND v_started > 0 THEN
    v_viewed := v_started;
  END IF;

  RETURN QUERY
  SELECT 'viewed', v_viewed, 100::numeric, 100::numeric
  UNION ALL
  SELECT 'started', v_started,
    CASE WHEN v_viewed > 0 THEN ROUND((v_started::numeric / v_viewed::numeric) * 100, 1) ELSE 0 END,
    CASE WHEN v_viewed > 0 THEN ROUND((v_started::numeric / v_viewed::numeric) * 100, 1) ELSE 0 END
  UNION ALL
  SELECT 'completed', v_completed,
    CASE WHEN v_started > 0 THEN ROUND((v_completed::numeric / v_started::numeric) * 100, 1) ELSE 0 END,
    CASE WHEN v_viewed > 0 THEN ROUND((v_completed::numeric / v_viewed::numeric) * 100, 1) ELSE 0 END
  UNION ALL
  SELECT 'shared', v_shared,
    CASE WHEN v_completed > 0 THEN ROUND((v_shared::numeric / v_completed::numeric) * 100, 1) ELSE 0 END,
    CASE WHEN v_viewed > 0 THEN ROUND((v_shared::numeric / v_viewed::numeric) * 100, 1) ELSE 0 END;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Funnel: Tests
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_analytics_funnel_tests(DATE, DATE);
CREATE OR REPLACE FUNCTION public.admin_analytics_funnel_tests(
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (
  stage TEXT,
  users BIGINT,
  conversion_from_prev NUMERIC,
  conversion_from_first NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewed BIGINT := 0;
  v_started BIGINT := 0;
  v_completed BIGINT := 0;
  v_shared BIGINT := 0;
BEGIN
  PERFORM public.admin_analytics_require_admin();

  IF to_regclass('public.user_events') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT
        COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'test_view') AS viewed,
        COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'test_start') AS started,
        COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'test_complete') AS completed,
        COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'test_share') AS shared
      FROM public.user_events ue
      WHERE ue.created_at::date >= $1
        AND ue.created_at::date <= $2
    $sql$
    INTO v_viewed, v_started, v_completed, v_shared
    USING p_from, p_to;
  END IF;

  IF to_regclass('public.personality_test_completions') IS NOT NULL THEN
    SELECT COALESCE(COUNT(DISTINCT ptc.user_id), 0)
    INTO v_completed
    FROM public.personality_test_completions ptc
    WHERE ptc.completed_at::date >= p_from
      AND ptc.completed_at::date <= p_to;
  ELSIF to_regclass('public.user_personality_results') IS NOT NULL THEN
    SELECT COALESCE(COUNT(DISTINCT upr.user_id), 0)
    INTO v_completed
    FROM public.user_personality_results upr
    WHERE upr.completed_at::date >= p_from
      AND upr.completed_at::date <= p_to;
  END IF;

  IF to_regclass('public.shares') IS NOT NULL THEN
    SELECT COALESCE(COUNT(DISTINCT s.user_id), 0)
    INTO v_shared
    FROM public.shares s
    WHERE COALESCE(s.created_at, s.shared_at)::date >= p_from
      AND COALESCE(s.created_at, s.shared_at)::date <= p_to
      AND COALESCE(s.content_type, 'quiz') = 'personality_test';
  END IF;

  IF v_viewed = 0 AND v_started > 0 THEN
    v_viewed := v_started;
  END IF;

  RETURN QUERY
  SELECT 'viewed', v_viewed, 100::numeric, 100::numeric
  UNION ALL
  SELECT 'started', v_started,
    CASE WHEN v_viewed > 0 THEN ROUND((v_started::numeric / v_viewed::numeric) * 100, 1) ELSE 0 END,
    CASE WHEN v_viewed > 0 THEN ROUND((v_started::numeric / v_viewed::numeric) * 100, 1) ELSE 0 END
  UNION ALL
  SELECT 'completed', v_completed,
    CASE WHEN v_started > 0 THEN ROUND((v_completed::numeric / v_started::numeric) * 100, 1) ELSE 0 END,
    CASE WHEN v_viewed > 0 THEN ROUND((v_completed::numeric / v_viewed::numeric) * 100, 1) ELSE 0 END
  UNION ALL
  SELECT 'shared', v_shared,
    CASE WHEN v_completed > 0 THEN ROUND((v_shared::numeric / v_completed::numeric) * 100, 1) ELSE 0 END,
    CASE WHEN v_viewed > 0 THEN ROUND((v_shared::numeric / v_viewed::numeric) * 100, 1) ELSE 0 END;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Top quizzes
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_analytics_top_quizzes(DATE, DATE, INT);
CREATE OR REPLACE FUNCTION public.admin_analytics_top_quizzes(
  p_from DATE,
  p_to DATE,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  quiz_id UUID,
  title TEXT,
  views BIGINT,
  starts BIGINT,
  completes BIGINT,
  shares BIGINT,
  avg_score_pct NUMERIC,
  avg_time_seconds NUMERIC,
  completion_rate NUMERIC,
  share_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_analytics_require_admin();

  IF to_regclass('public.user_events') IS NOT NULL THEN
    RETURN QUERY
    WITH quiz_base AS (
      SELECT q.id, q.title
      FROM public.quizzes q
      WHERE q.is_published = true
         OR COALESCE(NULLIF(to_jsonb(q)->>'status', ''), '') = 'published'
    ),
    event_stats AS (
      SELECT
        ue.quiz_id,
        COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'quiz_view') AS views,
        COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = 'quiz_start') AS starts
      FROM public.user_events ue
      WHERE ue.created_at::date >= p_from
        AND ue.created_at::date <= p_to
        AND ue.quiz_id IS NOT NULL
      GROUP BY ue.quiz_id
    ),
    result_stats AS (
      SELECT
        qr.quiz_id,
        COUNT(DISTINCT qr.user_id) AS completes,
        COALESCE(AVG((qr.score::numeric / NULLIF(qr.max_score::numeric, 0)) * 100), 0) AS avg_score_pct,
        COALESCE(AVG(qr.time_taken_seconds::numeric), 0) AS avg_time_seconds
      FROM public.quiz_results qr
      WHERE qr.completed_at::date >= p_from
        AND qr.completed_at::date <= p_to
      GROUP BY qr.quiz_id
    ),
    share_stats AS (
      SELECT
        COALESCE(s.content_id, s.quiz_id) AS quiz_id,
        COUNT(DISTINCT s.user_id) AS shares
      FROM public.shares s
      WHERE COALESCE(s.created_at, s.shared_at)::date >= p_from
        AND COALESCE(s.created_at, s.shared_at)::date <= p_to
        AND COALESCE(s.content_type, 'quiz') = 'quiz'
      GROUP BY COALESCE(s.content_id, s.quiz_id)
    )
    SELECT
      qb.id,
      qb.title,
      COALESCE(es.views, 0),
      COALESCE(es.starts, 0),
      COALESCE(rs.completes, 0),
      COALESCE(ss.shares, 0),
      ROUND(COALESCE(rs.avg_score_pct, 0), 1),
      ROUND(COALESCE(rs.avg_time_seconds, 0), 1),
      CASE WHEN COALESCE(es.starts, 0) > 0 THEN ROUND((COALESCE(rs.completes, 0)::numeric / es.starts::numeric) * 100, 1) ELSE 0 END,
      CASE WHEN COALESCE(rs.completes, 0) > 0 THEN ROUND((COALESCE(ss.shares, 0)::numeric / rs.completes::numeric) * 100, 1) ELSE 0 END
    FROM quiz_base qb
    LEFT JOIN event_stats es ON es.quiz_id = qb.id
    LEFT JOIN result_stats rs ON rs.quiz_id = qb.id
    LEFT JOIN share_stats ss ON ss.quiz_id = qb.id
    ORDER BY COALESCE(rs.completes, 0) DESC, COALESCE(ss.shares, 0) DESC
    LIMIT p_limit;
  ELSE
    RETURN QUERY
    WITH quiz_base AS (
      SELECT q.id, q.title
      FROM public.quizzes q
      WHERE q.is_published = true
         OR COALESCE(NULLIF(to_jsonb(q)->>'status', ''), '') = 'published'
    ),
    result_stats AS (
      SELECT
        qr.quiz_id,
        COUNT(DISTINCT qr.user_id) AS completes,
        COALESCE(AVG((qr.score::numeric / NULLIF(qr.max_score::numeric, 0)) * 100), 0) AS avg_score_pct,
        COALESCE(AVG(qr.time_taken_seconds::numeric), 0) AS avg_time_seconds
      FROM public.quiz_results qr
      WHERE qr.completed_at::date >= p_from
        AND qr.completed_at::date <= p_to
      GROUP BY qr.quiz_id
    ),
    share_stats AS (
      SELECT
        COALESCE(s.content_id, s.quiz_id) AS quiz_id,
        COUNT(DISTINCT s.user_id) AS shares
      FROM public.shares s
      WHERE COALESCE(s.created_at, s.shared_at)::date >= p_from
        AND COALESCE(s.created_at, s.shared_at)::date <= p_to
        AND COALESCE(s.content_type, 'quiz') = 'quiz'
      GROUP BY COALESCE(s.content_id, s.quiz_id)
    )
    SELECT
      qb.id,
      qb.title,
      0::BIGINT,
      0::BIGINT,
      COALESCE(rs.completes, 0),
      COALESCE(ss.shares, 0),
      ROUND(COALESCE(rs.avg_score_pct, 0), 1),
      ROUND(COALESCE(rs.avg_time_seconds, 0), 1),
      0::NUMERIC,
      CASE WHEN COALESCE(rs.completes, 0) > 0 THEN ROUND((COALESCE(ss.shares, 0)::numeric / rs.completes::numeric) * 100, 1) ELSE 0 END
    FROM quiz_base qb
    LEFT JOIN result_stats rs ON rs.quiz_id = qb.id
    LEFT JOIN share_stats ss ON ss.quiz_id = qb.id
    ORDER BY COALESCE(rs.completes, 0) DESC, COALESCE(ss.shares, 0) DESC
    LIMIT p_limit;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) Top tests
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_analytics_top_tests(DATE, DATE, INT);
CREATE OR REPLACE FUNCTION public.admin_analytics_top_tests(
  p_from DATE,
  p_to DATE,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  test_id UUID,
  title TEXT,
  views BIGINT,
  starts BIGINT,
  completes BIGINT,
  shares BIGINT,
  completion_rate NUMERIC,
  share_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_user_events BOOLEAN := to_regclass('public.user_events') IS NOT NULL;
  v_completion_sql TEXT;
  v_share_sql TEXT;
  v_sql TEXT;
BEGIN
  PERFORM public.admin_analytics_require_admin();

  IF to_regclass('public.personality_tests') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.personality_test_completions') IS NOT NULL THEN
    v_completion_sql := '
      SELECT
        ptc.test_id,
        COUNT(DISTINCT ptc.user_id)::BIGINT AS completes
      FROM public.personality_test_completions ptc
      WHERE ptc.completed_at::date >= $1
        AND ptc.completed_at::date <= $2
      GROUP BY ptc.test_id
    ';
  ELSIF to_regclass('public.user_personality_results') IS NOT NULL THEN
    v_completion_sql := '
      SELECT
        upr.test_id,
        COUNT(DISTINCT upr.user_id)::BIGINT AS completes
      FROM public.user_personality_results upr
      WHERE upr.completed_at::date >= $1
        AND upr.completed_at::date <= $2
      GROUP BY upr.test_id
    ';
  ELSE
    v_completion_sql := 'SELECT NULL::uuid AS test_id, 0::BIGINT AS completes WHERE false';
  END IF;

  IF to_regclass('public.shares') IS NOT NULL THEN
    v_share_sql := '
      SELECT
        COALESCE(s.content_id, s.quiz_id) AS test_id,
        COUNT(DISTINCT s.user_id)::BIGINT AS shares
      FROM public.shares s
      WHERE COALESCE(s.created_at, s.shared_at)::date >= $1
        AND COALESCE(s.created_at, s.shared_at)::date <= $2
        AND COALESCE(s.content_type, ''quiz'') = ''personality_test''
      GROUP BY COALESCE(s.content_id, s.quiz_id)
    ';
  ELSE
    v_share_sql := 'SELECT NULL::uuid AS test_id, 0::BIGINT AS shares WHERE false';
  END IF;

  IF v_has_user_events THEN
    v_sql := '
      WITH test_base AS (
        SELECT pt.id, pt.title
        FROM public.personality_tests pt
        WHERE pt.is_published = true
           OR COALESCE(NULLIF(to_jsonb(pt)->>''status'', ''''), '''') = ''published''
      ),
      event_stats AS (
        SELECT
          (ue.event_data->>''test_id'')::uuid AS test_id,
          COUNT(DISTINCT COALESCE(ue.user_id::text, ''tg:'' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = ''test_view'') AS views,
          COUNT(DISTINCT COALESCE(ue.user_id::text, ''tg:'' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = ''test_start'') AS starts,
          COUNT(DISTINCT COALESCE(ue.user_id::text, ''tg:'' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = ''test_complete'') AS completes,
          COUNT(DISTINCT COALESCE(ue.user_id::text, ''tg:'' || ue.telegram_id::text)) FILTER (WHERE ue.event_type = ''test_share'') AS shares
        FROM public.user_events ue
        WHERE ue.created_at::date >= $1
          AND ue.created_at::date <= $2
          AND ue.event_data ? ''test_id''
        GROUP BY (ue.event_data->>''test_id'')::uuid
      ),
      completion_agg AS (' || v_completion_sql || '),
      share_stats AS (' || v_share_sql || ')
      SELECT
        tb.id,
        tb.title,
        COALESCE(es.views, 0)::BIGINT AS views,
        COALESCE(es.starts, 0)::BIGINT AS starts,
        GREATEST(COALESCE(es.completes, 0), COALESCE(ca.completes, 0))::BIGINT AS completes,
        GREATEST(COALESCE(es.shares, 0), COALESCE(ss.shares, 0))::BIGINT AS shares,
        CASE WHEN COALESCE(es.starts, 0) > 0
          THEN ROUND((GREATEST(COALESCE(es.completes, 0), COALESCE(ca.completes, 0))::numeric / es.starts::numeric) * 100, 1)
          ELSE 0 END AS completion_rate,
        CASE WHEN GREATEST(COALESCE(es.completes, 0), COALESCE(ca.completes, 0)) > 0
          THEN ROUND((GREATEST(COALESCE(es.shares, 0), COALESCE(ss.shares, 0))::numeric / GREATEST(COALESCE(es.completes, 0), COALESCE(ca.completes, 0))::numeric) * 100, 1)
          ELSE 0 END AS share_rate
      FROM test_base tb
      LEFT JOIN event_stats es ON es.test_id = tb.id
      LEFT JOIN completion_agg ca ON ca.test_id = tb.id
      LEFT JOIN share_stats ss ON ss.test_id = tb.id
      ORDER BY GREATEST(COALESCE(es.completes, 0), COALESCE(ca.completes, 0)) DESC,
               GREATEST(COALESCE(es.shares, 0), COALESCE(ss.shares, 0)) DESC
      LIMIT $3
    ';
  ELSE
    v_sql := '
      WITH test_base AS (
        SELECT pt.id, pt.title
        FROM public.personality_tests pt
        WHERE pt.is_published = true
           OR COALESCE(NULLIF(to_jsonb(pt)->>''status'', ''''), '''') = ''published''
      ),
      completion_agg AS (' || v_completion_sql || '),
      share_stats AS (' || v_share_sql || ')
      SELECT
        tb.id,
        tb.title,
        0::BIGINT AS views,
        0::BIGINT AS starts,
        COALESCE(ca.completes, 0)::BIGINT AS completes,
        COALESCE(ss.shares, 0)::BIGINT AS shares,
        0::NUMERIC AS completion_rate,
        CASE WHEN COALESCE(ca.completes, 0) > 0
          THEN ROUND((COALESCE(ss.shares, 0)::numeric / ca.completes::numeric) * 100, 1)
          ELSE 0 END AS share_rate
      FROM test_base tb
      LEFT JOIN completion_agg ca ON ca.test_id = tb.id
      LEFT JOIN share_stats ss ON ss.test_id = tb.id
      ORDER BY COALESCE(ca.completes, 0) DESC, COALESCE(ss.shares, 0) DESC
      LIMIT $3
    ';
  END IF;

  RETURN QUERY EXECUTE v_sql USING p_from, p_to, p_limit;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7) Acquisition sources
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_analytics_sources(DATE, DATE);
CREATE OR REPLACE FUNCTION public.admin_analytics_sources(
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (
  source TEXT,
  user_count BIGINT,
  percentage NUMERIC,
  referred_users BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_analytics_require_admin();

  IF to_regclass('public.user_events') IS NOT NULL THEN
    RETURN QUERY
    WITH source_events AS (
      SELECT DISTINCT ON (COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text))
        COALESCE(NULLIF(ue.event_data->>'source', ''), 'unknown') AS src,
        COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text) AS actor
      FROM public.user_events ue
      WHERE ue.created_at::date >= p_from
        AND ue.created_at::date <= p_to
        AND ue.event_type IN ('app_open', 'deep_link_open')
      ORDER BY COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text), ue.created_at
    ),
    source_counts AS (
      SELECT se.src AS source, COUNT(*)::BIGINT AS user_count
      FROM source_events se
      GROUP BY se.src
    ),
    referral_counts AS (
      SELECT
        COALESCE(NULLIF(to_jsonb(p)::jsonb->>'referral_source', ''), NULLIF(to_jsonb(p)::jsonb->>'source', ''), 'unknown') AS source,
        COUNT(*)::BIGINT AS referred_users
      FROM public.referrals r
      JOIN public.profiles p ON p.id = r.referred_id
      WHERE r.created_at::date >= p_from
        AND r.created_at::date <= p_to
      GROUP BY 1
    ),
    total AS (
      SELECT COALESCE(SUM(sc.user_count), 0)::NUMERIC AS total_users
      FROM source_counts sc
    )
    SELECT
      sc.source,
      sc.user_count,
      CASE WHEN t.total_users > 0 THEN ROUND((sc.user_count::NUMERIC / t.total_users) * 100, 1) ELSE 0 END AS percentage,
      COALESCE(rc.referred_users, 0) AS referred_users
    FROM source_counts sc
    CROSS JOIN total t
    LEFT JOIN referral_counts rc ON rc.source = sc.source
    ORDER BY sc.user_count DESC;
  ELSE
    RETURN QUERY
    WITH source_counts AS (
      SELECT
        COALESCE(NULLIF(to_jsonb(p)::jsonb->>'referral_source', ''), NULLIF(to_jsonb(p)::jsonb->>'source', ''), 'unknown') AS source,
        COUNT(*)::BIGINT AS user_count
      FROM public.profiles p
      WHERE p.created_at::date >= p_from
        AND p.created_at::date <= p_to
      GROUP BY 1
    ),
    referral_counts AS (
      SELECT
        COALESCE(NULLIF(to_jsonb(p)::jsonb->>'referral_source', ''), NULLIF(to_jsonb(p)::jsonb->>'source', ''), 'unknown') AS source,
        COUNT(*)::BIGINT AS referred_users
      FROM public.referrals r
      JOIN public.profiles p ON p.id = r.referred_id
      WHERE r.created_at::date >= p_from
        AND r.created_at::date <= p_to
      GROUP BY 1
    ),
    total AS (
      SELECT COALESCE(SUM(sc.user_count), 0)::NUMERIC AS total_users
      FROM source_counts sc
    )
    SELECT
      sc.source,
      sc.user_count,
      CASE WHEN t.total_users > 0 THEN ROUND((sc.user_count::NUMERIC / t.total_users) * 100, 1) ELSE 0 END AS percentage,
      COALESCE(rc.referred_users, 0) AS referred_users
    FROM source_counts sc
    CROSS JOIN total t
    LEFT JOIN referral_counts rc ON rc.source = sc.source
    ORDER BY sc.user_count DESC;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8) Screen transitions
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_analytics_screen_transitions(DATE, DATE, INT);
CREATE OR REPLACE FUNCTION public.admin_analytics_screen_transitions(
  p_from DATE,
  p_to DATE,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  from_screen TEXT,
  to_screen TEXT,
  transitions BIGINT,
  unique_users BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_analytics_require_admin();

  IF to_regclass('public.user_events') IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(NULLIF(ue.event_data->>'previous_screen', ''), 'unknown') AS from_screen,
    COALESCE(NULLIF(ue.event_data->>'screen_name', ''), 'unknown') AS to_screen,
    COUNT(*)::BIGINT AS transitions,
    COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text))::BIGINT AS unique_users
  FROM public.user_events ue
  WHERE ue.created_at::date >= p_from
    AND ue.created_at::date <= p_to
    AND ue.event_type = 'screen_view'
  GROUP BY 1, 2
  ORDER BY transitions DESC
  LIMIT p_limit;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9) Prediction operations summary
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_analytics_predictions(DATE, DATE);
CREATE OR REPLACE FUNCTION public.admin_analytics_predictions(
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (
  created_total BIGINT,
  pending_total BIGINT,
  under_review_total BIGINT,
  resolved_total BIGINT,
  rejected_total BIGINT,
  cancelled_total BIGINT,
  total_reports_current BIGINT,
  reports_created_in_range BIGINT,
  avg_time_to_moderation_hours NUMERIC,
  avg_time_to_resolution_hours NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created_total BIGINT := 0;
  v_pending_total BIGINT := 0;
  v_under_review_total BIGINT := 0;
  v_resolved_total BIGINT := 0;
  v_rejected_total BIGINT := 0;
  v_cancelled_total BIGINT := 0;
  v_total_reports_current BIGINT := 0;
  v_reports_created_in_range BIGINT := 0;
  v_avg_time_to_moderation_hours NUMERIC := 0;
  v_avg_time_to_resolution_hours NUMERIC := 0;
BEGIN
  PERFORM public.admin_analytics_require_admin();

  IF to_regclass('public.prediction_polls') IS NULL THEN
    RETURN QUERY SELECT 0,0,0,0,0,0,0,0,0::numeric,0::numeric;
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO v_created_total
  FROM public.prediction_polls pp
  WHERE pp.created_at::date >= p_from
    AND pp.created_at::date <= p_to;

  SELECT COUNT(*) INTO v_pending_total FROM public.prediction_polls WHERE status = 'pending';
  SELECT COUNT(*) INTO v_under_review_total FROM public.prediction_polls WHERE status = 'under_review';
  SELECT COUNT(*) INTO v_resolved_total FROM public.prediction_polls WHERE status = 'resolved';
  SELECT COUNT(*) INTO v_rejected_total FROM public.prediction_polls WHERE status = 'rejected';
  SELECT COUNT(*) INTO v_cancelled_total FROM public.prediction_polls WHERE status = 'cancelled';

  SELECT COALESCE(SUM(pp.report_count), 0)
  INTO v_total_reports_current
  FROM public.prediction_polls pp;

  IF to_regclass('public.prediction_reports') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_reports_created_in_range
    FROM public.prediction_reports pr
    WHERE pr.created_at::date >= p_from
      AND pr.created_at::date <= p_to;
  END IF;

  SELECT
    COALESCE(AVG(EXTRACT(EPOCH FROM (pp.moderated_at - COALESCE(pp.submitted_at, pp.created_at))) / 3600.0), 0),
    COALESCE(AVG(EXTRACT(EPOCH FROM (pp.resolved_at - COALESCE(pp.moderated_at, pp.created_at))) / 3600.0), 0)
  INTO v_avg_time_to_moderation_hours, v_avg_time_to_resolution_hours
  FROM public.prediction_polls pp
  WHERE pp.created_at::date >= p_from
    AND pp.created_at::date <= p_to
    AND pp.moderated_at IS NOT NULL;

  RETURN QUERY
  SELECT
    COALESCE(v_created_total, 0),
    COALESCE(v_pending_total, 0),
    COALESCE(v_under_review_total, 0),
    COALESCE(v_resolved_total, 0),
    COALESCE(v_rejected_total, 0),
    COALESCE(v_cancelled_total, 0),
    COALESCE(v_total_reports_current, 0),
    COALESCE(v_reports_created_in_range, 0),
    ROUND(COALESCE(v_avg_time_to_moderation_hours, 0), 1),
    ROUND(COALESCE(v_avg_time_to_resolution_hours, 0), 1);
END;
$$;

-- ---------------------------------------------------------------------------
-- 10) Tasks analytics
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_analytics_tasks(DATE, DATE, INT);
CREATE OR REPLACE FUNCTION public.admin_analytics_tasks(
  p_from DATE,
  p_to DATE,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  task_id UUID,
  title TEXT,
  completions BIGINT,
  unique_users BIGINT,
  completion_rate NUMERIC,
  last_completed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_ts TIMESTAMPTZ := p_from::timestamptz;
  v_to_ts TIMESTAMPTZ := (p_to::timestamptz + interval '1 day');
  v_active_users BIGINT := 0;
BEGIN
  PERFORM public.admin_analytics_require_admin();

  IF to_regclass('public.tasks') IS NULL OR to_regclass('public.user_tasks') IS NULL THEN
    RETURN;
  END IF;

  v_active_users := public.admin_analytics_active_users_count(v_from_ts, v_to_ts);

  RETURN QUERY
  SELECT
    t.id,
    t.title,
    COALESCE(COUNT(ut.id), 0)::BIGINT AS completions,
    COALESCE(COUNT(DISTINCT ut.user_id), 0)::BIGINT AS unique_users,
    CASE WHEN v_active_users > 0
      THEN ROUND((COUNT(DISTINCT ut.user_id)::numeric / v_active_users::numeric) * 100, 1)
      ELSE 0 END AS completion_rate,
    MAX(ut.completed_at) AS last_completed_at
  FROM public.tasks t
  LEFT JOIN public.user_tasks ut
    ON ut.task_id = t.id
   AND ut.completed_at >= v_from_ts
   AND ut.completed_at < v_to_ts
  GROUP BY t.id, t.title
  ORDER BY completions DESC, unique_users DESC
  LIMIT p_limit;
END;
$$;

-- ---------------------------------------------------------------------------
-- 11) Event health
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_analytics_event_health(DATE, DATE);
CREATE OR REPLACE FUNCTION public.admin_analytics_event_health(
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (
  event_type TEXT,
  event_count BIGINT,
  unique_users BIGINT,
  with_user_id_pct NUMERIC,
  last_seen_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_analytics_require_admin();

  IF to_regclass('public.user_events') IS NOT NULL THEN
    RETURN QUERY
    SELECT
      ue.event_type,
      COUNT(*)::BIGINT AS event_count,
      COUNT(DISTINCT COALESCE(ue.user_id::text, 'tg:' || ue.telegram_id::text))::BIGINT AS unique_users,
      ROUND((COUNT(*) FILTER (WHERE ue.user_id IS NOT NULL)::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100, 1) AS with_user_id_pct,
      MAX(ue.created_at) AS last_seen_at
    FROM public.user_events ue
    WHERE ue.created_at::date >= p_from
      AND ue.created_at::date <= p_to
    GROUP BY ue.event_type
    ORDER BY event_count DESC;
    RETURN;
  END IF;

  IF to_regclass('public.events') IS NOT NULL THEN
    RETURN QUERY
    SELECT
      e.event_type,
      COUNT(*)::BIGINT AS event_count,
      COUNT(DISTINCT e.user_id)::BIGINT AS unique_users,
      ROUND((COUNT(*) FILTER (WHERE e.user_id IS NOT NULL)::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100, 1) AS with_user_id_pct,
      MAX(e.created_at) AS last_seen_at
    FROM public.events e
    WHERE e.created_at::date >= p_from
      AND e.created_at::date <= p_to
    GROUP BY e.event_type
    ORDER BY event_count DESC;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Permissions (authenticated only)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.admin_analytics_require_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_active_users_count(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.admin_analytics_overview(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_timeseries(DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_funnel_quiz(DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_funnel_tests(DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_top_quizzes(DATE, DATE, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_top_tests(DATE, DATE, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_sources(DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_screen_transitions(DATE, DATE, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_predictions(DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_tasks(DATE, DATE, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics_event_health(DATE, DATE) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_analytics_overview(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_timeseries(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_funnel_quiz(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_funnel_tests(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_top_quizzes(DATE, DATE, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_top_tests(DATE, DATE, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_sources(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_screen_transitions(DATE, DATE, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_predictions(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_tasks(DATE, DATE, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_event_health(DATE, DATE) TO authenticated;

-- END FILE: supabase/migrations/20260207000100_admin_analytics_plus.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/migrations/20260207001000_prediction_admin_squad_override_and_eligibility_refresh.sql
-- -----------------------------------------------------------------------------
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

-- END FILE: supabase/migrations/20260207001000_prediction_admin_squad_override_and_eligibility_refresh.sql

-- -----------------------------------------------------------------------------
-- BEGIN FILE: supabase/seed_data.sql
-- -----------------------------------------------------------------------------
-- ============================================
-- SEED DATA FOR GLASS QUIZZES
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Generate room code function (for PvP)
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 2. Can challenge user function (1 hour cooldown)
CREATE OR REPLACE FUNCTION can_challenge_user(challenger UUID, opponent UUID)
RETURNS BOOLEAN AS $$
DECLARE
  last_challenge TIMESTAMP;
BEGIN
  SELECT created_at INTO last_challenge
  FROM challenges
  WHERE challenger_id = challenger AND opponent_id = opponent
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF last_challenge IS NULL THEN
    RETURN TRUE;
  END IF;
  
  RETURN (NOW() - last_challenge) > INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- 3. App settings table (if not exists)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default leaderboard config
INSERT INTO app_settings (key, value)
VALUES ('leaderboard_config', '{"season_duration_days": 30, "cup_thresholds": {"gold": 1000, "silver": 500, "bronze": 100}}')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- TEST QUIZZES
-- ============================================

-- Quiz 1: Тест на знание React
INSERT INTO quizzes (id, title, description, image_url, question_count, duration_seconds, is_published, participant_count, created_at)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Насколько хорошо ты знаешь React?',
  'Проверь свои знания самой популярной библиотеки для фронтенда',
  'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
  5,
  15,
  true,
  42,
  NOW() - INTERVAL '3 days'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  is_published = EXCLUDED.is_published;

-- Questions for Quiz 1
INSERT INTO questions (id, quiz_id, question_text, options, correct_answer, order_index)
VALUES 
  ('q1-1', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Что такое JSX?', '[{"text": "JavaScript XML"}, {"text": "Java Syntax Extension"}, {"text": "JSON XML"}, {"text": "JavaScript XHR"}]', 0, 0),
  ('q1-2', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Какой хук используется для состояния?', '[{"text": "useEffect"}, {"text": "useState"}, {"text": "useContext"}, {"text": "useReducer"}]', 1, 1),
  ('q1-3', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Что делает useEffect?', '[{"text": "Управляет состоянием"}, {"text": "Создает контекст"}, {"text": "Выполняет побочные эффекты"}, {"text": "Мемоизирует значения"}]', 2, 2),
  ('q1-4', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Как передать данные вниз по дереву?', '[{"text": "state"}, {"text": "props"}, {"text": "refs"}, {"text": "effects"}]', 1, 3),
  ('q1-5', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Что возвращает компонент?', '[{"text": "HTML"}, {"text": "JSX элементы"}, {"text": "Строку"}, {"text": "JSON"}]', 1, 4)
ON CONFLICT (id) DO NOTHING;

-- Quiz 2: IQ Тест
INSERT INTO quizzes (id, title, description, image_url, question_count, duration_seconds, is_published, participant_count, created_at)
VALUES (
  'b2c3d4e5-f6g7-8901-bcde-f12345678901',
  'Быстрый IQ тест',
  'Проверь свою логику за 60 секунд',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
  5,
  12,
  true,
  128,
  NOW() - INTERVAL '1 day'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  is_published = EXCLUDED.is_published;

-- Questions for Quiz 2
INSERT INTO questions (id, quiz_id, question_text, options, correct_answer, order_index)
VALUES 
  ('q2-1', 'b2c3d4e5-f6g7-8901-bcde-f12345678901', 'Продолжи ряд: 2, 4, 8, 16, ?', '[{"text": "24"}, {"text": "32"}, {"text": "30"}, {"text": "20"}]', 1, 0),
  ('q2-2', 'b2c3d4e5-f6g7-8901-bcde-f12345678901', 'Если A > B, и B > C, то...', '[{"text": "A = C"}, {"text": "A < C"}, {"text": "A > C"}, {"text": "Невозможно определить"}]', 2, 1),
  ('q2-3', 'b2c3d4e5-f6g7-8901-bcde-f12345678901', 'Найди лишнее: яблоко, банан, морковь, апельсин', '[{"text": "яблоко"}, {"text": "банан"}, {"text": "морковь"}, {"text": "апельсин"}]', 2, 2),
  ('q2-4', 'b2c3d4e5-f6g7-8901-bcde-f12345678901', '12 × 12 = ?', '[{"text": "124"}, {"text": "144"}, {"text": "134"}, {"text": "154"}]', 1, 3),
  ('q2-5', 'b2c3d4e5-f6g7-8901-bcde-f12345678901', 'Сколько месяцев имеют 28 дней?', '[{"text": "1"}, {"text": "6"}, {"text": "12"}, {"text": "0"}]', 2, 4)
ON CONFLICT (id) DO NOTHING;

-- Quiz 3: Кино и сериалы
INSERT INTO quizzes (id, title, description, image_url, question_count, duration_seconds, is_published, participant_count, created_at)
VALUES (
  'c3d4e5f6-g7h8-9012-cdef-123456789012',
  'Угадай фильм по кадру',
  'Насколько хорошо ты знаешь кино?',
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800',
  5,
  10,
  true,
  89,
  NOW() - INTERVAL '12 hours'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  is_published = EXCLUDED.is_published;

-- Questions for Quiz 3
INSERT INTO questions (id, quiz_id, question_text, options, correct_answer, order_index)
VALUES 
  ('q3-1', 'c3d4e5f6-g7h8-9012-cdef-123456789012', 'В каком году вышел "Титаник"?', '[{"text": "1995"}, {"text": "1997"}, {"text": "1999"}, {"text": "2000"}]', 1, 0),
  ('q3-2', 'c3d4e5f6-g7h8-9012-cdef-123456789012', 'Кто режиссер "Начало" (Inception)?', '[{"text": "Спилберг"}, {"text": "Нолан"}, {"text": "Скорсезе"}, {"text": "Тарантино"}]', 1, 1),
  ('q3-3', 'c3d4e5f6-g7h8-9012-cdef-123456789012', 'Сколько Оскаров у "Властелина колец: Возвращение короля"?', '[{"text": "9"}, {"text": "10"}, {"text": "11"}, {"text": "12"}]', 2, 2),
  ('q3-4', 'c3d4e5f6-g7h8-9012-cdef-123456789012', 'Кто играл Джокера в "Темном рыцаре"?', '[{"text": "Джек Николсон"}, {"text": "Хоакин Феникс"}, {"text": "Хит Леджер"}, {"text": "Джаред Лето"}]', 2, 3),
  ('q3-5', 'c3d4e5f6-g7h8-9012-cdef-123456789012', 'Какой фильм был первым полностью CGI?', '[{"text": "Шрек"}, {"text": "История игрушек"}, {"text": "В поисках Немо"}, {"text": "Корпорация монстров"}]', 1, 4)
ON CONFLICT (id) DO NOTHING;

-- Quiz 4: Музыка
INSERT INTO quizzes (id, title, description, image_url, question_count, duration_seconds, is_published, participant_count, created_at)
VALUES (
  'd4e5f6g7-h8i9-0123-defg-234567890123',
  'Музыкальная викторина',
  'Проверь знания о музыке и исполнителях',
  'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800',
  5,
  15,
  true,
  67,
  NOW() - INTERVAL '6 hours'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  is_published = EXCLUDED.is_published;

-- Questions for Quiz 4
INSERT INTO questions (id, quiz_id, question_text, options, correct_answer, order_index)
VALUES 
  ('q4-1', 'd4e5f6g7-h8i9-0123-defg-234567890123', 'Кто написал "Богемскую рапсодию"?', '[{"text": "The Beatles"}, {"text": "Queen"}, {"text": "Led Zeppelin"}, {"text": "Pink Floyd"}]', 1, 0),
  ('q4-2', 'd4e5f6g7-h8i9-0123-defg-234567890123', 'Сколько струн на стандартной гитаре?', '[{"text": "4"}, {"text": "5"}, {"text": "6"}, {"text": "7"}]', 2, 1),
  ('q4-3', 'd4e5f6g7-h8i9-0123-defg-234567890123', 'Кто называется "Королем поп-музыки"?', '[{"text": "Элвис Пресли"}, {"text": "Майкл Джексон"}, {"text": "Принс"}, {"text": "Фредди Меркьюри"}]', 1, 2),
  ('q4-4', 'd4e5f6g7-h8i9-0123-defg-234567890123', 'Какой альбом самый продаваемый в истории?', '[{"text": "Thriller"}, {"text": "Back in Black"}, {"text": "The Dark Side of the Moon"}, {"text": "Abbey Road"}]', 0, 3),
  ('q4-5', 'd4e5f6g7-h8i9-0123-defg-234567890123', 'В каком году был основан Spotify?', '[{"text": "2004"}, {"text": "2006"}, {"text": "2008"}, {"text": "2010"}]', 1, 4)
ON CONFLICT (id) DO NOTHING;

-- Quiz 5: Наука
INSERT INTO quizzes (id, title, description, image_url, question_count, duration_seconds, is_published, participant_count, created_at)
VALUES (
  'e5f6g7h8-i9j0-1234-efgh-345678901234',
  'Научная викторина',
  'Факты о космосе, физике и биологии',
  'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800',
  5,
  20,
  true,
  34,
  NOW() - INTERVAL '2 hours'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  is_published = EXCLUDED.is_published;

-- Questions for Quiz 5
INSERT INTO questions (id, quiz_id, question_text, options, correct_answer, order_index)
VALUES 
  ('q5-1', 'e5f6g7h8-i9j0-1234-efgh-345678901234', 'Какая планета ближе всего к Солнцу?', '[{"text": "Венера"}, {"text": "Меркурий"}, {"text": "Марс"}, {"text": "Земля"}]', 1, 0),
  ('q5-2', 'e5f6g7h8-i9j0-1234-efgh-345678901234', 'Из чего состоит вода?', '[{"text": "H2O"}, {"text": "CO2"}, {"text": "NaCl"}, {"text": "O2"}]', 0, 1),
  ('q5-3', 'e5f6g7h8-i9j0-1234-efgh-345678901234', 'Скорость света приблизительно равна...', '[{"text": "300 км/с"}, {"text": "300 000 км/с"}, {"text": "3 000 км/с"}, {"text": "30 000 км/с"}]', 1, 2),
  ('q5-4', 'e5f6g7h8-i9j0-1234-efgh-345678901234', 'Сколько костей в теле взрослого человека?', '[{"text": "186"}, {"text": "206"}, {"text": "226"}, {"text": "246"}]', 1, 3),
  ('q5-5', 'e5f6g7h8-i9j0-1234-efgh-345678901234', 'Кто открыл пенициллин?', '[{"text": "Пастер"}, {"text": "Флеминг"}, {"text": "Кох"}, {"text": "Дженнер"}]', 1, 4)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- VERDICTS FOR ALL QUIZZES
-- ============================================

INSERT INTO verdicts (quiz_id, min_score, max_score, title, text)
VALUES
  -- React quiz verdicts
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 0, 1, '🌱 Новичок', 'Начни с документации React — впереди увлекательный путь!'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 2, 3, '📚 Ученик', 'Неплохо! Продолжай практиковаться.'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 4, 4, '💪 Профи', 'Отлично! Ты хорошо знаешь React.'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 5, 5, '🏆 Мастер', 'Вау! Ты настоящий React-гуру!'),
  
  -- IQ quiz verdicts
  ('b2c3d4e5-f6g7-8901-bcde-f12345678901', 0, 1, '🐢 Можно лучше', 'Попробуй еще раз, когда выспишься 😴'),
  ('b2c3d4e5-f6g7-8901-bcde-f12345678901', 2, 3, '🧠 Средний уровень', 'Неплохая логика!'),
  ('b2c3d4e5-f6g7-8901-bcde-f12345678901', 4, 4, '🎯 Умница', 'Отличный результат!'),
  ('b2c3d4e5-f6g7-8901-bcde-f12345678901', 5, 5, '🚀 Гений', 'Эйнштейн, ты ли это?'),
  
  -- Movie quiz verdicts
  ('c3d4e5f6-g7h8-9012-cdef-123456789012', 0, 1, '📺 Телезритель', 'Пора смотреть больше кино!'),
  ('c3d4e5f6-g7h8-9012-cdef-123456789012', 2, 3, '🎬 Любитель', 'Ты знаешь классику.'),
  ('c3d4e5f6-g7h8-9012-cdef-123456789012', 4, 4, '🎥 Киноман', 'Отличные знания кино!'),
  ('c3d4e5f6-g7h8-9012-cdef-123456789012', 5, 5, '🏆 Кинокритик', 'Ты — ходячая энциклопедия кино!'),
  
  -- Music quiz verdicts
  ('d4e5f6g7-h8i9-0123-defg-234567890123', 0, 1, '🔇 Тишина', 'Включи радио!'),
  ('d4e5f6g7-h8i9-0123-defg-234567890123', 2, 3, '🎵 Слушатель', 'Неплохо разбираешься в музыке.'),
  ('d4e5f6g7-h8i9-0123-defg-234567890123', 4, 4, '🎸 Меломан', 'Ты знаешь много о музыке!'),
  ('d4e5f6g7-h8i9-0123-defg-234567890123', 5, 5, '🎤 Рок-звезда', 'Легенда!'),
  
  -- Science quiz verdicts
  ('e5f6g7h8-i9j0-1234-efgh-345678901234', 0, 1, '🔬 Исследователь', 'Наука ждёт тебя!'),
  ('e5f6g7h8-i9j0-1234-efgh-345678901234', 2, 3, '📖 Студент', 'Хорошие базовые знания.'),
  ('e5f6g7h8-i9j0-1234-efgh-345678901234', 4, 4, '🧪 Учёный', 'Отличные знания!'),
  ('e5f6g7h8-i9j0-1234-efgh-345678901234', 5, 5, '🚀 Нобелевский лауреат', 'Невероятно!')
ON CONFLICT DO NOTHING;

-- ============================================
-- BANNERS
-- ============================================

INSERT INTO banners (id, title, description, image_url, link_url, link_type, is_active, display_order)
VALUES
  ('banner-1', '🎯 Квиз дня', 'Пройди и получи бонус!', 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=800', '/quiz/a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'internal', true, 0),
  ('banner-2', '🏆 Турнир недели', 'Соревнуйся с друзьями', 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800', '/leaderboard', 'internal', true, 1),
  ('banner-3', '🎁 Пригласи друга', 'Получи 50 попкорнов', 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800', '/profile', 'internal', true, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  is_active = EXCLUDED.is_active;

-- ============================================
-- TASKS
-- ============================================

INSERT INTO tasks (id, title, description, reward_type, reward_amount, task_type, action_url, icon, is_active, display_order)
VALUES
  ('task-1', 'Подпишись на канал', 'Будь в курсе новых квизов', 'popcorns', 20, 'link', 'https://t.me/quipobot_news', '📢', true, 0),
  ('task-2', 'Пригласи друга', 'Отправь ссылку другу', 'popcorns', 50, 'referral', NULL, '👥', true, 1),
  ('task-3', 'Пройди 3 квиза', 'Заверши 3 любых квиза', 'popcorns', 30, 'achievement', NULL, '🎯', true, 2),
  ('task-4', 'Поставь лайк', 'Оцени любой квиз', 'popcorns', 5, 'achievement', NULL, '❤️', true, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  is_active = EXCLUDED.is_active;

-- ============================================
-- DONE!
-- ============================================
SELECT 'Seed data inserted successfully! 🎉' as status;

-- END FILE: supabase/seed_data.sql
