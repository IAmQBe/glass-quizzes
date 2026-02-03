import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserStats {
  bestScore: number;
  testsCompleted: number;
  globalRank: number;
  activeChallenges: number;
  challengeWins: number;
  trophies: number;
  totalPopcorns: number;
}

const defaultStats: UserStats = {
  bestScore: 0,
  testsCompleted: 0,
  globalRank: 0,
  activeChallenges: 0,
  challengeWins: 0,
  trophies: 0,
  totalPopcorns: 0,
};

/**
 * Fetch user statistics from database
 */
export const useUserStats = () => {
  return useQuery({
    queryKey: ['userStats'],
    queryFn: async (): Promise<UserStats> => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return defaultStats;
      }

      try {
        const { data, error } = await supabase.rpc('get_user_stats', {
          p_user_id: user.id
        });

        if (error) {
          console.error('Error fetching user stats:', error);
          return defaultStats;
        }

        if (!data) {
          return defaultStats;
        }

        return {
          bestScore: data.best_score ?? 0,
          testsCompleted: data.tests_completed ?? 0,
          globalRank: data.global_rank ?? 0,
          activeChallenges: data.active_challenges ?? 0,
          challengeWins: data.challenge_wins ?? 0,
          trophies: data.trophies ?? 0,
          totalPopcorns: data.total_popcorns ?? 0,
        };
      } catch (err) {
        console.error('Error in useUserStats:', err);
        return defaultStats;
      }
    },
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
  });
};

/**
 * Calculate global rank based on tests completed
 * This is a fallback when RPC function is not available
 */
export const useGlobalRank = () => {
  return useQuery({
    queryKey: ['globalRank'],
    queryFn: async (): Promise<number> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      // Count how many users have more quiz_results than current user
      const { count: myCount } = await supabase
        .from('quiz_results')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const { data: betterUsers } = await supabase
        .from('quiz_results')
        .select('user_id')
        .neq('user_id', user.id);

      if (!betterUsers) return 1;

      // Count unique users with more results
      const userCounts = new Map<string, number>();
      betterUsers.forEach(r => {
        userCounts.set(r.user_id, (userCounts.get(r.user_id) || 0) + 1);
      });

      let rank = 1;
      userCounts.forEach(count => {
        if (count > (myCount || 0)) rank++;
      });

      return rank;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
