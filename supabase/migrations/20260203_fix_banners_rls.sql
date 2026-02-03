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
