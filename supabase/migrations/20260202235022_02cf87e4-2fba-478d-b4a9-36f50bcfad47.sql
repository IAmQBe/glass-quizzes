-- Drop the foreign key constraint on created_by since we need flexibility for sample data
ALTER TABLE public.quizzes DROP CONSTRAINT IF EXISTS quizzes_created_by_fkey;