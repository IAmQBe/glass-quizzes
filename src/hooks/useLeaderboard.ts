import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LeaderboardCategory = 'score' | 'challenges' | 'quizzes' | 'popcorns';

export interface LeaderboardEntry {
  user_id: string;
  username: string | null;
  first_name: string | null;
  avatar_url: string | null;
  has_premium: boolean;
  rank: number;
  // Category-specific values
  total_score?: number;
  wins?: number;
  count?: number;
  total_popcorns?: number;
  quiz_count?: number;
  tests_count?: number;
  popcorns?: number; // alias for total_popcorns
}

/**
 * Fetch leaderboard by category
 */
export const useLeaderboard = (category: LeaderboardCategory, limit: number = 100) => {
  return useQuery({
    queryKey: ['leaderboard', category, limit],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      let data: LeaderboardEntry[] = [];
      let error: Error | null = null;

      switch (category) {
        case 'quizzes': {
          const result = await supabase.rpc('get_leaderboard_by_tests', { limit_count: limit });
          if (result.error) throw result.error;
          data = (result.data || []).map((entry: any) => ({
            ...entry,
            count: Number(entry.count),
            rank: Number(entry.rank),
          }));
          break;
        }
        case 'challenges': {
          const result = await supabase.rpc('get_leaderboard_by_challenges', { limit_count: limit });
          if (result.error) throw result.error;
          data = (result.data || []).map((entry: any) => ({
            ...entry,
            wins: Number(entry.wins),
            rank: Number(entry.rank),
          }));
          break;
        }
        case 'popcorns': {
          const result = await supabase.rpc('get_leaderboard_by_popcorns', { limit_count: limit });
          if (result.error) throw result.error;
          data = (result.data || []).map((entry: any) => ({
            ...entry,
            total_popcorns: Number(entry.total_popcorns || entry.popcorns || 0),
            popcorns: Number(entry.popcorns || entry.total_popcorns || 0),
            quiz_count: Number(entry.quiz_count || 0),
            rank: Number(entry.rank),
          }));
          break;
        }
        case 'score':
        default: {
          const result = await supabase.rpc('get_leaderboard_by_score', { limit_count: limit });
          if (result.error) throw result.error;
          data = (result.data || []).map((entry: any) => ({
            ...entry,
            total_score: Number(entry.total_score),
            tests_count: Number(entry.tests_count),
            rank: Number(entry.rank),
          }));
          break;
        }
      }

      return data;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false,
  });
};

/**
 * Get display value for leaderboard entry based on category
 */
export const getLeaderboardValue = (entry: LeaderboardEntry, category: LeaderboardCategory): { value: number; suffix: string } => {
  switch (category) {
    case 'challenges':
      return { value: entry.wins || 0, suffix: 'wins' };
    case 'quizzes':
      return { value: entry.count || 0, suffix: 'тестов' };
    case 'popcorns':
      return { value: entry.total_popcorns || 0, suffix: '' };
    case 'score':
    default:
      return { value: entry.total_score || 0, suffix: 'pts' };
  }
};

/**
 * Format number for display (e.g., 1234 -> 1.2K)
 */
export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};
