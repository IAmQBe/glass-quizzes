-- Create tasks table for admin-managed tasks
CREATE TABLE public.tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    reward_type TEXT NOT NULL DEFAULT 'popcorns', -- popcorns, badge, etc.
    reward_amount INTEGER NOT NULL DEFAULT 10,
    task_type TEXT NOT NULL DEFAULT 'link', -- link, subscribe, invite, daily
    action_url TEXT, -- URL to open or channel to subscribe
    icon TEXT DEFAULT '🎯', -- emoji icon
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user task completions tracking
CREATE TABLE public.user_tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, task_id)
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

-- Tasks policies
CREATE POLICY "Tasks are viewable by everyone"
ON public.tasks FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage tasks"
ON public.tasks FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- User tasks policies
CREATE POLICY "Users can view own completed tasks"
ON public.user_tasks FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can complete tasks"
ON public.user_tasks FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();