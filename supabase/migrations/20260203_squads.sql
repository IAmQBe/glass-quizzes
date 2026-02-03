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
