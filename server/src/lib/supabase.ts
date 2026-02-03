import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Types from the frontend (simplified)
export interface Quiz {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  question_count: number;
  participant_count: number;
  duration_seconds: number;
  is_published: boolean;
  like_count: number;
  save_count: number;
}

export interface Question {
  id: string;
  quiz_id: string;
  question_text: string;
  options: { text: string }[];
  correct_answer: number;
  order_index: number;
}

/**
 * Get published quizzes
 */
export async function getPublishedQuizzes(limit = 10): Promise<Quiz[]> {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('is_published', true)
    .order('like_count', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

/**
 * Get quiz by ID
 */
export async function getQuizById(id: string): Promise<Quiz | null> {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

/**
 * Get random published quiz
 */
export async function getRandomQuiz(): Promise<Quiz | null> {
  // Get total count first
  const { count } = await supabase
    .from('quizzes')
    .select('*', { count: 'exact', head: true })
    .eq('is_published', true);
  
  if (!count || count === 0) return null;
  
  // Get random offset
  const offset = Math.floor(Math.random() * count);
  
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('is_published', true)
    .range(offset, offset)
    .single();
  
  if (error) return null;
  return data;
}

/**
 * Get "daily" quiz (most popular today or random if none)
 */
export async function getDailyQuiz(): Promise<Quiz | null> {
  // For now, just return the most popular quiz
  // TODO: Implement actual daily rotation
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('is_published', true)
    .order('participant_count', { ascending: false })
    .limit(1)
    .single();
  
  if (error) return getRandomQuiz();
  return data;
}
