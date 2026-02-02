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