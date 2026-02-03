import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramUser } from "@/lib/telegram";

export interface UserStats {
  testsCompleted: number;
  bestScore: number;
  globalRank: number;
  activeChallenges: number;
  challengeWins: number;
  trophies: number;
  totalPopcorns: number;     // Likes received on created quizzes
  quizzesCreated: number;    // Number of quizzes created
  totalLikesGiven: number;   // How many quizzes user liked
}

const defaultStats: UserStats = {
  testsCompleted: 0,
  bestScore: 0,
  globalRank: 0,
  activeChallenges: 0,
  challengeWins: 0,
  trophies: 0,
  totalPopcorns: 0,
  quizzesCreated: 0,
  totalLikesGiven: 0,
};

/**
 * Get profile ID by telegram_id
 */
async function getProfileId(): Promise<string | null> {
  const tgUser = getTelegramUser();
  if (!tgUser?.id) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("telegram_id", tgUser.id)
    .maybeSingle();

  return data?.id || null;
}

/**
 * Fetch comprehensive user statistics
 */
export const useUserStats = () => {
  return useQuery({
    queryKey: ['userStats'],
    queryFn: async (): Promise<UserStats> => {
      const profileId = await getProfileId();

      if (!profileId) {
        return defaultStats;
      }

      try {
        // Parallel fetch all stats
        const [
          quizResultsRes,
          myQuizzesRes,
          likesGivenRes,
          challengesRes,
        ] = await Promise.all([
          // Quiz results (completed tests)
          supabase
            .from("quiz_results")
            .select("score, max_score")
            .eq("user_id", profileId),

          // My quizzes (created) with like counts
          supabase
            .from("quizzes")
            .select("id, like_count")
            .eq("created_by", profileId),

          // Likes given
          supabase
            .from("quiz_likes")
            .select("id", { count: "exact", head: true })
            .eq("user_id", profileId),

          // Challenges (both as challenger and challenged)
          supabase
            .from("challenges")
            .select("id, status, winner_id")
            .or(`challenger_id.eq.${profileId},challenged_id.eq.${profileId}`),
        ]);

        // Calculate tests completed
        const testsCompleted = quizResultsRes.data?.length || 0;

        // Calculate best score (percentage)
        let bestScore = 0;
        if (quizResultsRes.data && quizResultsRes.data.length > 0) {
          const scores = quizResultsRes.data.map(r =>
            r.max_score > 0 ? Math.round((r.score / r.max_score) * 100) : 0
          );
          bestScore = Math.max(...scores);
        }

        // Quizzes created
        const quizzesCreated = myQuizzesRes.data?.length || 0;

        // Total popcorns (likes received)
        const totalPopcorns = myQuizzesRes.data?.reduce(
          (sum, quiz) => sum + (quiz.like_count || 0), 0
        ) || 0;

        // Likes given
        const totalLikesGiven = likesGivenRes.count || 0;

        // Challenges stats
        const challenges = challengesRes.data || [];
        const activeChallenges = challenges.filter(c => c.status === 'pending' || c.status === 'active').length;
        const challengeWins = challenges.filter(c => c.winner_id === profileId).length;

        // Trophies (1 trophy per 10 challenge wins)
        const trophies = Math.floor(challengeWins / 10);

        // Global rank (simplified - based on tests completed)
        const { count: totalUsers } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true });

        const { count: usersWithMoreTests } = await supabase
          .from("quiz_results")
          .select("user_id", { count: "exact", head: true })
          .neq("user_id", profileId);

        // Simple rank calculation
        const globalRank = totalUsers ? Math.max(1, Math.min(totalUsers, testsCompleted > 0 ? Math.ceil(totalUsers * 0.5) : totalUsers)) : 0;

        return {
          testsCompleted,
          bestScore,
          globalRank,
          activeChallenges,
          challengeWins,
          trophies,
          totalPopcorns,
          quizzesCreated,
          totalLikesGiven,
        };
      } catch (err) {
        console.error('Error in useUserStats:', err);
        return defaultStats;
      }
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });
};

/**
 * Get leaderboard data
 */
export const useLeaderboardStats = (limit = 50) => {
  return useQuery({
    queryKey: ['leaderboardStats', limit],
    queryFn: async () => {
      // Get users with most completed quizzes
      const { data: results, error } = await supabase
        .from("quiz_results")
        .select(`
          user_id,
          score,
          profiles!inner(
            id,
            telegram_id,
            username,
            first_name,
            avatar_url,
            has_telegram_premium
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Leaderboard error:", error);
        return [];
      }

      // Aggregate by user
      const userMap = new Map<string, {
        userId: string;
        username: string;
        firstName: string;
        avatarUrl: string | null;
        isPremium: boolean;
        testsCompleted: number;
        totalScore: number;
      }>();

      results?.forEach(r => {
        const profile = r.profiles as any;
        const existing = userMap.get(r.user_id);

        if (existing) {
          existing.testsCompleted++;
          existing.totalScore += r.score;
        } else {
          userMap.set(r.user_id, {
            userId: r.user_id,
            username: profile.username || profile.first_name || 'Анонимус',
            firstName: profile.first_name || '',
            avatarUrl: profile.avatar_url,
            isPremium: profile.has_telegram_premium || false,
            testsCompleted: 1,
            totalScore: r.score,
          });
        }
      });

      // Sort by tests completed, then by total score
      const leaderboard = Array.from(userMap.values())
        .sort((a, b) => {
          if (b.testsCompleted !== a.testsCompleted) {
            return b.testsCompleted - a.testsCompleted;
          }
          return b.totalScore - a.totalScore;
        })
        .slice(0, limit);

      return leaderboard;
    },
    staleTime: 60 * 1000, // 1 minute
  });
};
