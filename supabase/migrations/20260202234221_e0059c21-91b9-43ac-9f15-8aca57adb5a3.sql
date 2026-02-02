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