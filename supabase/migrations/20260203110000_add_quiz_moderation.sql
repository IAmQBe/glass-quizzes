-- Add moderation fields to quizzes table
-- This enables quiz review workflow: draft -> pending -> published/rejected

-- Add status field with CHECK constraint
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' 
  CHECK (status IN ('draft', 'pending', 'published', 'rejected'));

-- Add moderation-related fields
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS moderated_by TEXT,
ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;

-- Migrate existing data based on is_published flag
UPDATE public.quizzes SET status = 'published' WHERE is_published = true AND status IS NULL;
UPDATE public.quizzes SET status = 'draft' WHERE is_published = false AND status IS NULL;

-- Create index for faster filtering by status
CREATE INDEX IF NOT EXISTS idx_quizzes_status ON public.quizzes(status);

-- Comment for documentation
COMMENT ON COLUMN public.quizzes.status IS 'Quiz moderation status: draft, pending, published, rejected';
COMMENT ON COLUMN public.quizzes.rejection_reason IS 'Reason for rejection (if status=rejected)';
COMMENT ON COLUMN public.quizzes.submitted_at IS 'When the quiz was submitted for review';
COMMENT ON COLUMN public.quizzes.moderated_by IS 'Telegram ID of admin who moderated';
COMMENT ON COLUMN public.quizzes.moderated_at IS 'When the quiz was moderated';
