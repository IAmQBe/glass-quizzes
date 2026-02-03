import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Load .env from project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ENV vars:', { 
    SUPABASE_URL: process.env.SUPABASE_URL ? 'set' : 'missing',
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? 'set' : 'missing',
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? 'set' : 'missing',
  });
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Types from the frontend (simplified)
export type QuizStatus = 'draft' | 'pending' | 'published' | 'rejected';

export interface Quiz {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  created_by: string;
  question_count: number;
  participant_count: number;
  duration_seconds: number;
  is_published: boolean;
  status: QuizStatus;
  rejection_reason: string | null;
  submitted_at: string | null;
  moderated_by: string | null;
  moderated_at: string | null;
  like_count: number;
  save_count: number;
}

export interface Profile {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
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

/**
 * Update quiz status (for moderation)
 */
export async function updateQuizStatus(
  quizId: string, 
  status: QuizStatus, 
  moderatedBy?: string,
  rejectionReason?: string
): Promise<Quiz | null> {
  const updates: Record<string, unknown> = {
    status,
    is_published: status === 'published',
    moderated_at: new Date().toISOString(),
  };

  if (moderatedBy) {
    updates.moderated_by = moderatedBy;
  }

  if (status === 'rejected' && rejectionReason) {
    updates.rejection_reason = rejectionReason;
  }

  const { data, error } = await supabase
    .from('quizzes')
    .update(updates)
    .eq('id', quizId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get profile by Telegram ID
 */
export async function getProfileByTelegramId(telegramId: number): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

/**
 * Get quizzes pending moderation
 */
export async function getPendingQuizzes(): Promise<Quiz[]> {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true });

  if (error) throw error;
  return data || [];
}
