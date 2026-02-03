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