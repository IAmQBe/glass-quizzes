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