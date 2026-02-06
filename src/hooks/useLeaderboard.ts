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
export const useLeaderboard = (
  category: LeaderboardCategory,
  limit: number = 100,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ['leaderboard', category, limit],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      let data: LeaderboardEntry[] = [];

      const loadCreatorsFallback = async (): Promise<LeaderboardEntry[]> => {
        const selectWithFallback = async (
          sources: string[],
          columnVariants: string[],
          label: string
        ): Promise<any[]> => {
          for (const source of sources) {
            for (const columns of columnVariants) {
              const { data: rows, error: rowsError } = await (supabase as any)
                .from(source)
                .select(columns);

              if (!rowsError) {
                return rows || [];
              }

              console.warn(
                `Fallback leaderboard: ${label} fetch failed for ${source} (${columns}):`,
                rowsError.message
              );
            }
          }

          return [];
        };

        const [quizRows, testRows] = await Promise.all([
          selectWithFallback(
            ["quizzes_public", "quizzes"],
            [
              "created_by, like_count, is_published, status, is_anonymous",
              "created_by, like_count, is_published, status",
              "created_by, like_count, is_published",
              "created_by, like_count, status",
              "created_by, like_count",
            ],
            "quizzes"
          ),
          selectWithFallback(
            ["personality_tests_public", "personality_tests"],
            [
              "created_by, like_count, is_published, is_anonymous",
              "created_by, like_count, is_published",
              "created_by, like_count",
            ],
            "personality_tests"
          ),
        ]);

        const isPublishedQuiz = (row: any) => {
          const normalizedStatus = typeof row?.status === "string" ? row.status.toLowerCase() : "";
          if (normalizedStatus === "published") return true;
          if (row?.is_published === false) return false;
          return true;
        };

        const isPublishedTest = (row: any) => {
          if (row?.is_published === false) return false;
          return true;
        };

        const publishedQuizzes = (quizRows || []).filter((row: any) =>
          isPublishedQuiz(row) && row?.is_anonymous !== true
        );

        const publishedTests = (testRows || []).filter((row: any) =>
          isPublishedTest(row) && row?.is_anonymous !== true
        );

        const likedQuizzesFallback = (quizRows || []).filter((row: any) =>
          row?.is_anonymous !== true && Number(row?.like_count || 0) > 0
        );

        const likedTestsFallback = (testRows || []).filter((row: any) =>
          row?.is_anonymous !== true && Number(row?.like_count || 0) > 0
        );

        const quizzesForAggregation =
          publishedQuizzes.length > 0 ? publishedQuizzes : likedQuizzesFallback;

        const testsForAggregation =
          publishedTests.length > 0 ? publishedTests : likedTestsFallback;

        const aggregated = new Map<string, { total_popcorns: number; quiz_count: number }>();

        quizzesForAggregation.forEach((q: any) => {
          if (!q?.created_by) return;
          const current = aggregated.get(q.created_by) || { total_popcorns: 0, quiz_count: 0 };
          const likeCount = Number(q.like_count || 0);
          current.total_popcorns += likeCount;
          current.quiz_count += 1;
          aggregated.set(q.created_by, current);
        });

        testsForAggregation.forEach((t: any) => {
          if (!t?.created_by) return;
          const current = aggregated.get(t.created_by) || { total_popcorns: 0, quiz_count: 0 };
          const likeCount = Number(t.like_count || 0);
          current.total_popcorns += likeCount;
          current.quiz_count += 1;
          aggregated.set(t.created_by, current);
        });

        const creatorIds = Array.from(aggregated.keys());
        if (creatorIds.length === 0) {
          return [];
        }

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, username, first_name, avatar_url, has_telegram_premium")
          .in("id", creatorIds);

        if (profilesError) {
          console.warn("Fallback leaderboard: profiles fetch failed:", profilesError.message);
        }

        const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile]));

        const sorted = creatorIds
          .map((id) => ({ user_id: id, ...aggregated.get(id)! }))
          .sort((a, b) => {
            if (b.total_popcorns !== a.total_popcorns) return b.total_popcorns - a.total_popcorns;
            return b.quiz_count - a.quiz_count;
          })
          .slice(0, limit);

        return sorted.map((row, index) => {
          const profile = profileMap.get(row.user_id);
          return {
            user_id: row.user_id,
            username: profile?.username ?? null,
            first_name: profile?.first_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
            has_premium: profile?.has_telegram_premium ?? false,
            total_popcorns: row.total_popcorns,
            popcorns: row.total_popcorns,
            quiz_count: row.quiz_count,
            rank: index + 1,
          } as LeaderboardEntry;
        });
      };

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
          if (result.error) {
            console.warn("Leaderboard RPC get_leaderboard_by_popcorns failed, using fallback:", result.error.message);
            data = await loadCreatorsFallback();
            break;
          }

          data = (result.data || []).map((entry: any, index: number) => ({
            ...entry,
            total_popcorns: Number(entry.total_popcorns || entry.popcorns || 0),
            popcorns: Number(entry.popcorns || entry.total_popcorns || 0),
            quiz_count: Number(entry.quiz_count || 0),
            rank: Number(entry.rank || index + 1),
          }));

          // Fallback for empty RPC payloads (legacy/misaligned DB state)
          if (data.length === 0) {
            data = await loadCreatorsFallback();
          }
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
    enabled,
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
