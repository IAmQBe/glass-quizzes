-- ============================================
-- Personality Tests Feature Migration
-- ============================================

-- 1. Main personality tests table
CREATE TABLE IF NOT EXISTS personality_tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  question_count INT DEFAULT 0,
  result_count INT DEFAULT 0,
  participant_count INT DEFAULT 0,
  like_count INT DEFAULT 0,
  save_count INT DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Questions for personality tests
CREATE TABLE IF NOT EXISTS personality_test_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID NOT NULL REFERENCES personality_tests(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  image_url TEXT,
  order_index INT NOT NULL
);

-- 3. Answers with result points
CREATE TABLE IF NOT EXISTS personality_test_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES personality_test_questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  result_points JSONB NOT NULL DEFAULT '{}',
  order_index INT NOT NULL
);

-- 4. Results/Characters
CREATE TABLE IF NOT EXISTS personality_test_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID NOT NULL REFERENCES personality_tests(id) ON DELETE CASCADE,
  result_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  share_text TEXT,
  order_index INT NOT NULL,
  UNIQUE(test_id, result_key)
);

-- 5. User completions
CREATE TABLE IF NOT EXISTS personality_test_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  test_id UUID NOT NULL REFERENCES personality_tests(id) ON DELETE CASCADE,
  result_id UUID NOT NULL REFERENCES personality_test_results(id) ON DELETE CASCADE,
  answers JSONB,
  completed_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Likes for personality tests
CREATE TABLE IF NOT EXISTS personality_test_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES personality_tests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, test_id)
);

-- 7. Favorites for personality tests
CREATE TABLE IF NOT EXISTS personality_test_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES personality_tests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, test_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_personality_tests_published ON personality_tests(is_published);
CREATE INDEX IF NOT EXISTS idx_personality_tests_created_by ON personality_tests(created_by);
CREATE INDEX IF NOT EXISTS idx_personality_test_questions_test_id ON personality_test_questions(test_id);
CREATE INDEX IF NOT EXISTS idx_personality_test_answers_question_id ON personality_test_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_personality_test_results_test_id ON personality_test_results(test_id);
CREATE INDEX IF NOT EXISTS idx_personality_test_completions_user_id ON personality_test_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_personality_test_completions_test_id ON personality_test_completions(test_id);

-- Disable RLS for now (can be enabled later with proper policies)
ALTER TABLE personality_tests DISABLE ROW LEVEL SECURITY;
ALTER TABLE personality_test_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE personality_test_answers DISABLE ROW LEVEL SECURITY;
ALTER TABLE personality_test_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE personality_test_completions DISABLE ROW LEVEL SECURITY;
ALTER TABLE personality_test_likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE personality_test_favorites DISABLE ROW LEVEL SECURITY;
