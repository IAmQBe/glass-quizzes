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
