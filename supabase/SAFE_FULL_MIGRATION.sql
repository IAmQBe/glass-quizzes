-- =============================================================================
-- SAFE FULL MIGRATION - Can be run multiple times without errors
-- =============================================================================
-- Last updated: 2026-02-04
-- Run this file in Supabase SQL Editor to apply all migrations
-- =============================================================================

-- =====================
-- TYPES
-- =====================
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =====================
-- TABLES
-- =====================

-- User roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    has_telegram_premium BOOLEAN DEFAULT false,
    onboarding_completed BOOLEAN NOT NULL DEFAULT false,
    referral_code TEXT UNIQUE,
    challenge_notifications_enabled BOOLEAN DEFAULT true,
    source TEXT,
    last_seen_at TIMESTAMPTZ,
    squad_id UUID,
    squad_joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Squads table
CREATE TABLE IF NOT EXISTS public.squads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_chat_id BIGINT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    username TEXT,
    type TEXT DEFAULT 'channel',
    member_count INT DEFAULT 0,
    total_popcorns INT DEFAULT 0,
    avatar_url TEXT,
    invite_link TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    created_by UUID,
    question_count INTEGER NOT NULL DEFAULT 0,
    participant_count INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER NOT NULL DEFAULT 60,
    is_published BOOLEAN NOT NULL DEFAULT false,
    status TEXT DEFAULT 'draft',
    rating DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    like_count INTEGER NOT NULL DEFAULT 0,
    save_count INTEGER NOT NULL DEFAULT 0,
    squad_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Questions table
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    image_url TEXT,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    correct_answer INTEGER NOT NULL DEFAULT 0,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quiz results table
CREATE TABLE IF NOT EXISTS public.quiz_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    max_score INTEGER NOT NULL DEFAULT 100,
    percentile INTEGER NOT NULL DEFAULT 50,
    answers JSONB DEFAULT '[]'::jsonb,
    time_taken_seconds INTEGER,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(quiz_id, user_id)
);

-- Personality tests table
CREATE TABLE IF NOT EXISTS public.personality_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    created_by UUID,
    question_count INTEGER NOT NULL DEFAULT 0,
    result_count INTEGER NOT NULL DEFAULT 0,
    participant_count INTEGER NOT NULL DEFAULT 0,
    like_count INTEGER NOT NULL DEFAULT 0,
    save_count INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'draft',
    squad_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Personality test questions
CREATE TABLE IF NOT EXISTS public.personality_test_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES public.personality_tests(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    image_url TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Personality test answers
CREATE TABLE IF NOT EXISTS public.personality_test_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.personality_test_questions(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    result_id UUID,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Personality test results (outcomes)
CREATE TABLE IF NOT EXISTS public.personality_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES public.personality_tests(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    min_score INTEGER DEFAULT 0,
    max_score INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User personality test results
CREATE TABLE IF NOT EXISTS public.user_personality_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES public.personality_tests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    result_id UUID REFERENCES public.personality_test_results(id) ON DELETE SET NULL,
    answers JSONB DEFAULT '[]'::jsonb,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(test_id, user_id)
);

-- Banners table
CREATE TABLE IF NOT EXISTS public.banners (
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

-- Favorites table
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    test_id UUID REFERENCES public.personality_tests(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, quiz_id),
    UNIQUE(user_id, test_id)
);

-- Quiz ratings table
CREATE TABLE IF NOT EXISTS public.quiz_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, quiz_id)
);

-- Quiz likes table
CREATE TABLE IF NOT EXISTS public.quiz_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(quiz_id, user_id)
);

-- Personality test likes
CREATE TABLE IF NOT EXISTS public.personality_test_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES public.personality_tests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(test_id, user_id)
);

-- Verdicts table
CREATE TABLE IF NOT EXISTS public.verdicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    min_score INTEGER NOT NULL DEFAULT 0,
    max_score INTEGER NOT NULL DEFAULT 100,
    title TEXT NOT NULL,
    description TEXT,
    emoji TEXT DEFAULT '✨',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shares table
CREATE TABLE IF NOT EXISTS public.shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,
    result_id UUID,
    chat_type TEXT,
    source TEXT,
    ref_user_id UUID,
    content_type TEXT DEFAULT 'quiz',
    content_id UUID,
    share_type TEXT,
    shared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Events table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Challenges table
CREATE TABLE IF NOT EXISTS public.challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenger_id UUID NOT NULL,
    opponent_id UUID NOT NULL,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    category TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    challenger_score INTEGER,
    opponent_score INTEGER,
    winner_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

-- PvP rooms table
CREATE TABLE IF NOT EXISTS public.pvp_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    host_id UUID NOT NULL,
    guest_id UUID,
    category TEXT,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'waiting',
    host_score INTEGER DEFAULT 0,
    guest_score INTEGER DEFAULT 0,
    current_question INTEGER DEFAULT 0,
    winner_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL,
    referred_id UUID NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    reward_type TEXT NOT NULL DEFAULT 'popcorns',
    reward_amount INTEGER NOT NULL DEFAULT 10,
    task_type TEXT NOT NULL DEFAULT 'link',
    action_url TEXT,
    icon TEXT DEFAULT '🎯',
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User tasks table
CREATE TABLE IF NOT EXISTS public.user_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, task_id)
);

-- Squad members table
CREATE TABLE IF NOT EXISTS public.squad_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    squad_id UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(squad_id, user_id)
);

-- App settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leaderboard seasons
CREATE TABLE IF NOT EXISTS public.leaderboard_seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Live quizzes
CREATE TABLE IF NOT EXISTS public.live_quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    host_user_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting',
    current_question INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    max_participants INTEGER DEFAULT 100,
    is_paid BOOLEAN NOT NULL DEFAULT false,
    price_stars INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Live quiz participants
CREATE TABLE IF NOT EXISTS public.live_quiz_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    live_quiz_id UUID NOT NULL REFERENCES public.live_quizzes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    correct_answers INTEGER NOT NULL DEFAULT 0,
    total_time_ms INTEGER NOT NULL DEFAULT 0,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(live_quiz_id, user_id)
);

-- Live quiz answers
CREATE TABLE IF NOT EXISTS public.live_quiz_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    live_quiz_id UUID NOT NULL REFERENCES public.live_quizzes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    question_index INTEGER NOT NULL,
    answer_index INTEGER NOT NULL,
    is_correct BOOLEAN NOT NULL,
    time_ms INTEGER NOT NULL,
    answered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Live quiz reactions
CREATE TABLE IF NOT EXISTS public.live_quiz_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    live_quiz_id UUID NOT NULL REFERENCES public.live_quizzes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- ADD MISSING COLUMNS
-- =====================
DO $$
BEGIN
    -- Profiles columns
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_telegram_premium BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS challenge_notifications_enabled BOOLEAN DEFAULT true;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS source TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS squad_id UUID;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS squad_joined_at TIMESTAMPTZ;
    
    -- Quizzes columns
    ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0;
    ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;
    ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS save_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
    ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS squad_id UUID;
    
    -- Quiz results columns
    ALTER TABLE public.quiz_results ADD COLUMN IF NOT EXISTS time_taken_seconds INTEGER;
    
    -- Personality tests columns
    ALTER TABLE public.personality_tests ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE public.personality_tests ADD COLUMN IF NOT EXISTS save_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE public.personality_tests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
    ALTER TABLE public.personality_tests ADD COLUMN IF NOT EXISTS squad_id UUID;
    
    -- Squads columns
    ALTER TABLE public.squads ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    ALTER TABLE public.squads ADD COLUMN IF NOT EXISTS invite_link TEXT;
    
    -- Shares columns
    ALTER TABLE public.shares ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'quiz';
    ALTER TABLE public.shares ADD COLUMN IF NOT EXISTS content_id UUID;
    ALTER TABLE public.shares ADD COLUMN IF NOT EXISTS share_type TEXT;
    ALTER TABLE public.shares ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- =====================
-- INDEXES
-- =====================
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON public.profiles(telegram_id);
CREATE INDEX IF NOT EXISTS idx_profiles_squad_id ON public.profiles(squad_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_by ON public.quizzes(created_by);
CREATE INDEX IF NOT EXISTS idx_quizzes_status ON public.quizzes(status);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON public.questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_user_id ON public.quiz_results(user_id);
CREATE INDEX IF NOT EXISTS idx_verdicts_quiz_id ON public.verdicts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_shares_user_id ON public.shares(user_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON public.events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON public.events(created_at);
CREATE INDEX IF NOT EXISTS idx_personality_tests_created_by ON public.personality_tests(created_by);
CREATE INDEX IF NOT EXISTS idx_personality_tests_status ON public.personality_tests(status);

-- =====================
-- ENABLE RLS
-- =====================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personality_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personality_test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personality_test_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personality_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_personality_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personality_test_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verdicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pvp_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_quiz_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_quiz_reactions ENABLE ROW LEVEL SECURITY;

-- =====================
-- FUNCTIONS
-- =====================

-- is_admin function
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

-- is_quiz_owner function
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

-- Update participant count
CREATE OR REPLACE FUNCTION public.update_participant_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.quizzes 
    SET participant_count = participant_count + 1
    WHERE id = NEW.quiz_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update question count
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

-- Update quiz like count
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

-- Update quiz save count
CREATE OR REPLACE FUNCTION public.update_quiz_save_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.quiz_id IS NOT NULL THEN
        UPDATE public.quizzes SET save_count = save_count + 1 WHERE id = NEW.quiz_id;
    ELSIF TG_OP = 'DELETE' AND OLD.quiz_id IS NOT NULL THEN
        UPDATE public.quizzes SET save_count = save_count - 1 WHERE id = OLD.quiz_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update personality test like count
CREATE OR REPLACE FUNCTION public.update_personality_test_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.personality_tests SET like_count = like_count + 1 WHERE id = NEW.test_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.personality_tests SET like_count = like_count - 1 WHERE id = OLD.test_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update personality test participant count
CREATE OR REPLACE FUNCTION public.update_personality_test_participant_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.personality_tests 
    SET participant_count = participant_count + 1
    WHERE id = NEW.test_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Generate referral code
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

-- Generate room code
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

-- Squad functions (drop first to allow return type changes)
DROP FUNCTION IF EXISTS public.can_change_squad(UUID);
DROP FUNCTION IF EXISTS public.join_squad(UUID, UUID);
DROP FUNCTION IF EXISTS public.leave_squad(UUID);

CREATE OR REPLACE FUNCTION public.can_change_squad(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_joined_at TIMESTAMPTZ;
BEGIN
    SELECT squad_joined_at INTO v_joined_at
    FROM profiles WHERE id = p_user_id;
    
    IF v_joined_at IS NULL THEN
        RETURN TRUE;
    END IF;
    
    RETURN v_joined_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.join_squad(p_user_id UUID, p_squad_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_can_change BOOLEAN;
BEGIN
    SELECT can_change_squad(p_user_id) INTO v_can_change;
    
    IF NOT v_can_change THEN
        RETURN jsonb_build_object('success', false, 'error', 'Сменить команду можно раз в 7 дней');
    END IF;
    
    UPDATE profiles SET 
        squad_id = p_squad_id,
        squad_joined_at = NOW()
    WHERE id = p_user_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.leave_squad(p_user_id UUID)
RETURNS JSONB AS $$
BEGIN
    UPDATE profiles SET 
        squad_id = NULL,
        squad_joined_at = NULL
    WHERE id = p_user_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- Squad leaderboard (drop first)
DROP FUNCTION IF EXISTS public.get_squad_leaderboard(INT);
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

-- Update squad member count
CREATE OR REPLACE FUNCTION public.update_squad_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.squad_id IS NOT NULL AND (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        UPDATE squads SET member_count = (
            SELECT COUNT(*) FROM profiles WHERE squad_id = OLD.squad_id
        ) WHERE id = OLD.squad_id;
    END IF;
    
    IF NEW.squad_id IS NOT NULL AND (TG_OP = 'UPDATE' OR TG_OP = 'INSERT') THEN
        UPDATE squads SET member_count = (
            SELECT COUNT(*) FROM profiles WHERE squad_id = NEW.squad_id
        ) WHERE id = NEW.squad_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Creators leaderboard (drop first)
DROP FUNCTION IF EXISTS get_leaderboard_by_popcorns(INT);
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
    SELECT 
      q.created_by as creator_id,
      COALESCE(SUM(q.like_count), 0) as likes,
      COUNT(*) as content_count
    FROM quizzes q
    WHERE q.status = 'published' AND q.created_by IS NOT NULL
    GROUP BY q.created_by
    
    UNION ALL
    
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

-- Score leaderboard (drop first)
DROP FUNCTION IF EXISTS get_leaderboard_by_score(INT);
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
  HAVING COALESCE(SUM(qr.score), 0) > 0
  ORDER BY total_score DESC
  LIMIT limit_count;
$$ LANGUAGE sql STABLE;

-- Tests leaderboard (drop first)
DROP FUNCTION IF EXISTS get_leaderboard_by_tests(INT);
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
    COUNT(*)::BIGINT as count,
    RANK() OVER (ORDER BY COUNT(*) DESC) as rank
  FROM quiz_results qr
  JOIN profiles p ON p.id = qr.user_id
  GROUP BY qr.user_id, p.username, p.first_name, p.avatar_url, p.has_telegram_premium
  ORDER BY count DESC
  LIMIT limit_count;
$$ LANGUAGE sql STABLE;

-- Challenges leaderboard (drop first)
DROP FUNCTION IF EXISTS get_leaderboard_by_challenges(INT);
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
    COUNT(*)::BIGINT as wins,
    RANK() OVER (ORDER BY COUNT(*) DESC) as rank
  FROM challenges c
  JOIN profiles p ON p.id = c.winner_id
  WHERE c.status = 'completed' AND c.winner_id IS NOT NULL
  GROUP BY c.winner_id, p.username, p.first_name, p.avatar_url, p.has_telegram_premium
  ORDER BY wins DESC
  LIMIT limit_count;
$$ LANGUAGE sql STABLE;

-- Analytics functions (drop first)
DROP FUNCTION IF EXISTS get_dau(DATE);
DROP FUNCTION IF EXISTS get_wau(DATE);
DROP FUNCTION IF EXISTS get_mau(DATE);
DROP FUNCTION IF EXISTS get_total_shares();
DROP FUNCTION IF EXISTS get_quiz_funnel();
DROP FUNCTION IF EXISTS get_avg_completion_time();
DROP FUNCTION IF EXISTS get_top_quizzes_by_completions(INT);

CREATE OR REPLACE FUNCTION get_dau(p_date DATE DEFAULT CURRENT_DATE)
RETURNS BIGINT AS $$
  SELECT COUNT(DISTINCT user_id)::BIGINT
  FROM events
  WHERE DATE(created_at) = p_date;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_wau(p_date DATE DEFAULT CURRENT_DATE)
RETURNS BIGINT AS $$
  SELECT COUNT(DISTINCT user_id)::BIGINT
  FROM events
  WHERE created_at >= p_date - INTERVAL '7 days';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_mau(p_date DATE DEFAULT CURRENT_DATE)
RETURNS BIGINT AS $$
  SELECT COUNT(DISTINCT user_id)::BIGINT
  FROM events
  WHERE created_at >= p_date - INTERVAL '30 days';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_total_shares()
RETURNS BIGINT AS $$
  SELECT COUNT(*)::BIGINT FROM shares;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_quiz_funnel()
RETURNS TABLE (
  viewed BIGINT,
  started BIGINT,
  completed BIGINT,
  shared BIGINT
) AS $$
  SELECT
    (SELECT COUNT(*) FROM events WHERE event_type = 'quiz_view')::BIGINT as viewed,
    (SELECT COUNT(*) FROM events WHERE event_type = 'quiz_start')::BIGINT as started,
    (SELECT COUNT(*) FROM quiz_results)::BIGINT as completed,
    (SELECT COUNT(*) FROM shares)::BIGINT as shared;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_avg_completion_time()
RETURNS NUMERIC AS $$
  SELECT COALESCE(AVG(time_taken_seconds), 0)::NUMERIC
  FROM quiz_results
  WHERE time_taken_seconds IS NOT NULL AND time_taken_seconds > 0;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_top_quizzes_by_completions(p_limit INT DEFAULT 10)
RETURNS TABLE (
  quiz_id UUID,
  title TEXT,
  completions BIGINT,
  shares BIGINT
) AS $$
  SELECT 
    q.id as quiz_id,
    q.title,
    COUNT(qr.id)::BIGINT as completions,
    0::BIGINT as shares
  FROM quizzes q
  LEFT JOIN quiz_results qr ON qr.quiz_id = q.id
  WHERE q.status = 'published'
  GROUP BY q.id, q.title
  ORDER BY completions DESC
  LIMIT p_limit;
$$ LANGUAGE sql STABLE;

-- =====================
-- TRIGGERS (drop first, then create)
-- =====================
DROP TRIGGER IF EXISTS on_quiz_result_insert ON public.quiz_results;
DROP TRIGGER IF EXISTS on_question_change ON public.questions;
DROP TRIGGER IF EXISTS update_quiz_likes_count ON public.quiz_likes;
DROP TRIGGER IF EXISTS update_quiz_saves_count ON public.favorites;
DROP TRIGGER IF EXISTS update_pt_likes_count ON public.personality_test_likes;
DROP TRIGGER IF EXISTS on_personality_result_insert ON public.user_personality_results;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_quizzes_updated_at ON public.quizzes;
DROP TRIGGER IF EXISTS update_banners_updated_at ON public.banners;
DROP TRIGGER IF EXISTS generate_referral_code_trigger ON public.profiles;
DROP TRIGGER IF EXISTS trigger_update_squad_member_count ON public.profiles;

CREATE TRIGGER on_quiz_result_insert
AFTER INSERT ON public.quiz_results
FOR EACH ROW EXECUTE FUNCTION public.update_participant_count();

CREATE TRIGGER on_question_change
AFTER INSERT OR DELETE ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.update_question_count();

CREATE TRIGGER update_quiz_likes_count
AFTER INSERT OR DELETE ON public.quiz_likes
FOR EACH ROW EXECUTE FUNCTION public.update_quiz_like_count();

CREATE TRIGGER update_quiz_saves_count
AFTER INSERT OR DELETE ON public.favorites
FOR EACH ROW EXECUTE FUNCTION public.update_quiz_save_count();

CREATE TRIGGER update_pt_likes_count
AFTER INSERT OR DELETE ON public.personality_test_likes
FOR EACH ROW EXECUTE FUNCTION public.update_personality_test_like_count();

CREATE TRIGGER on_personality_result_insert
AFTER INSERT ON public.user_personality_results
FOR EACH ROW EXECUTE FUNCTION public.update_personality_test_participant_count();

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quizzes_updated_at
BEFORE UPDATE ON public.quizzes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_banners_updated_at
BEFORE UPDATE ON public.banners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER generate_referral_code_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.generate_referral_code();

CREATE TRIGGER trigger_update_squad_member_count
AFTER INSERT OR UPDATE OF squad_id OR DELETE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_squad_member_count();

-- =====================
-- RLS POLICIES (drop all first, then create)
-- =====================

-- Drop all existing policies first (ignore errors)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- Profiles policies
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (true);
CREATE POLICY "Users can insert profile" ON public.profiles FOR INSERT WITH CHECK (true);

-- Squads policies
CREATE POLICY "Squads viewable by everyone" ON public.squads FOR SELECT USING (true);
CREATE POLICY "Squads insert allowed" ON public.squads FOR INSERT WITH CHECK (true);
CREATE POLICY "Squads update allowed" ON public.squads FOR UPDATE USING (true);

-- Quizzes policies
CREATE POLICY "Published quizzes viewable" ON public.quizzes FOR SELECT USING (status = 'published' OR true);
CREATE POLICY "Users can create quizzes" ON public.quizzes FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update quizzes" ON public.quizzes FOR UPDATE USING (true);
CREATE POLICY "Users can delete quizzes" ON public.quizzes FOR DELETE USING (true);

-- Questions policies
CREATE POLICY "Questions viewable" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Questions insert" ON public.questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Questions update" ON public.questions FOR UPDATE USING (true);
CREATE POLICY "Questions delete" ON public.questions FOR DELETE USING (true);

-- Quiz results policies
CREATE POLICY "Results viewable" ON public.quiz_results FOR SELECT USING (true);
CREATE POLICY "Results insert" ON public.quiz_results FOR INSERT WITH CHECK (true);

-- Personality tests policies
CREATE POLICY "PT viewable" ON public.personality_tests FOR SELECT USING (true);
CREATE POLICY "PT insert" ON public.personality_tests FOR INSERT WITH CHECK (true);
CREATE POLICY "PT update" ON public.personality_tests FOR UPDATE USING (true);
CREATE POLICY "PT delete" ON public.personality_tests FOR DELETE USING (true);

-- Personality test questions policies
CREATE POLICY "PTQ viewable" ON public.personality_test_questions FOR SELECT USING (true);
CREATE POLICY "PTQ insert" ON public.personality_test_questions FOR INSERT WITH CHECK (true);
CREATE POLICY "PTQ update" ON public.personality_test_questions FOR UPDATE USING (true);
CREATE POLICY "PTQ delete" ON public.personality_test_questions FOR DELETE USING (true);

-- Personality test answers policies
CREATE POLICY "PTA viewable" ON public.personality_test_answers FOR SELECT USING (true);
CREATE POLICY "PTA insert" ON public.personality_test_answers FOR INSERT WITH CHECK (true);
CREATE POLICY "PTA update" ON public.personality_test_answers FOR UPDATE USING (true);
CREATE POLICY "PTA delete" ON public.personality_test_answers FOR DELETE USING (true);

-- Personality test results policies
CREATE POLICY "PTR viewable" ON public.personality_test_results FOR SELECT USING (true);
CREATE POLICY "PTR insert" ON public.personality_test_results FOR INSERT WITH CHECK (true);
CREATE POLICY "PTR update" ON public.personality_test_results FOR UPDATE USING (true);
CREATE POLICY "PTR delete" ON public.personality_test_results FOR DELETE USING (true);

-- User personality results policies
CREATE POLICY "UPR viewable" ON public.user_personality_results FOR SELECT USING (true);
CREATE POLICY "UPR insert" ON public.user_personality_results FOR INSERT WITH CHECK (true);

-- Banners policies
CREATE POLICY "Banners viewable" ON public.banners FOR SELECT USING (is_active = true);
CREATE POLICY "Banners manage" ON public.banners FOR ALL USING (true);

-- Favorites policies
CREATE POLICY "Favorites viewable" ON public.favorites FOR SELECT USING (true);
CREATE POLICY "Favorites insert" ON public.favorites FOR INSERT WITH CHECK (true);
CREATE POLICY "Favorites delete" ON public.favorites FOR DELETE USING (true);

-- Quiz likes policies
CREATE POLICY "Likes viewable" ON public.quiz_likes FOR SELECT USING (true);
CREATE POLICY "Likes insert" ON public.quiz_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Likes delete" ON public.quiz_likes FOR DELETE USING (true);

-- Personality test likes policies
CREATE POLICY "PT Likes viewable" ON public.personality_test_likes FOR SELECT USING (true);
CREATE POLICY "PT Likes insert" ON public.personality_test_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "PT Likes delete" ON public.personality_test_likes FOR DELETE USING (true);

-- Verdicts policies
CREATE POLICY "Verdicts viewable" ON public.verdicts FOR SELECT USING (true);
CREATE POLICY "Verdicts manage" ON public.verdicts FOR ALL USING (true);

-- Shares policies
CREATE POLICY "Shares viewable" ON public.shares FOR SELECT USING (true);
CREATE POLICY "Shares insert" ON public.shares FOR INSERT WITH CHECK (true);

-- Events policies
CREATE POLICY "Events viewable" ON public.events FOR SELECT USING (true);
CREATE POLICY "Events insert" ON public.events FOR INSERT WITH CHECK (true);

-- Challenges policies
CREATE POLICY "Challenges viewable" ON public.challenges FOR SELECT USING (true);
CREATE POLICY "Challenges insert" ON public.challenges FOR INSERT WITH CHECK (true);
CREATE POLICY "Challenges update" ON public.challenges FOR UPDATE USING (true);

-- PvP rooms policies
CREATE POLICY "PvP viewable" ON public.pvp_rooms FOR SELECT USING (true);
CREATE POLICY "PvP insert" ON public.pvp_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "PvP update" ON public.pvp_rooms FOR UPDATE USING (true);
CREATE POLICY "PvP delete" ON public.pvp_rooms FOR DELETE USING (true);

-- Referrals policies
CREATE POLICY "Referrals viewable" ON public.referrals FOR SELECT USING (true);
CREATE POLICY "Referrals insert" ON public.referrals FOR INSERT WITH CHECK (true);

-- Tasks policies
CREATE POLICY "Tasks viewable" ON public.tasks FOR SELECT USING (is_active = true);
CREATE POLICY "Tasks manage" ON public.tasks FOR ALL USING (true);

-- User tasks policies
CREATE POLICY "User tasks viewable" ON public.user_tasks FOR SELECT USING (true);
CREATE POLICY "User tasks insert" ON public.user_tasks FOR INSERT WITH CHECK (true);

-- Squad members policies
CREATE POLICY "Squad members viewable" ON public.squad_members FOR SELECT USING (true);
CREATE POLICY "Squad members insert" ON public.squad_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Squad members delete" ON public.squad_members FOR DELETE USING (true);

-- User roles policies
CREATE POLICY "Roles viewable" ON public.user_roles FOR SELECT USING (true);

-- App settings policies
CREATE POLICY "Settings viewable" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Settings manage" ON public.app_settings FOR ALL USING (true);

-- Leaderboard seasons policies
CREATE POLICY "Seasons viewable" ON public.leaderboard_seasons FOR SELECT USING (true);
CREATE POLICY "Seasons manage" ON public.leaderboard_seasons FOR ALL USING (true);

-- Live quizzes policies
CREATE POLICY "Live quiz viewable" ON public.live_quizzes FOR SELECT USING (true);
CREATE POLICY "Live quiz insert" ON public.live_quizzes FOR INSERT WITH CHECK (true);
CREATE POLICY "Live quiz update" ON public.live_quizzes FOR UPDATE USING (true);

-- Live quiz participants policies
CREATE POLICY "LQP viewable" ON public.live_quiz_participants FOR SELECT USING (true);
CREATE POLICY "LQP insert" ON public.live_quiz_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "LQP update" ON public.live_quiz_participants FOR UPDATE USING (true);

-- Live quiz answers policies
CREATE POLICY "LQA viewable" ON public.live_quiz_answers FOR SELECT USING (true);
CREATE POLICY "LQA insert" ON public.live_quiz_answers FOR INSERT WITH CHECK (true);

-- Live quiz reactions policies
CREATE POLICY "LQR viewable" ON public.live_quiz_reactions FOR SELECT USING (true);
CREATE POLICY "LQR insert" ON public.live_quiz_reactions FOR INSERT WITH CHECK (true);

-- Quiz ratings policies
CREATE POLICY "Ratings viewable" ON public.quiz_ratings FOR SELECT USING (true);
CREATE POLICY "Ratings insert" ON public.quiz_ratings FOR INSERT WITH CHECK (true);
CREATE POLICY "Ratings update" ON public.quiz_ratings FOR UPDATE USING (true);

-- =====================
-- GRANTS
-- =====================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- =====================
-- REALTIME (ignore errors if already added)
-- =====================
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_quizzes;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_quiz_participants;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_quiz_answers;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_quiz_reactions;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.challenges;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pvp_rooms;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- =====================
-- DONE
-- =====================
SELECT 'Migration completed successfully!' as result;
