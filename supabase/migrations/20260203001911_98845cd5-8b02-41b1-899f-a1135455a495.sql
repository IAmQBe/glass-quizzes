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