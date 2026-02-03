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
