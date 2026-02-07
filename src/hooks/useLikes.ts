import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramUser, haptic } from "@/lib/telegram";

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
 * Get IDs of quizzes the user has liked (popcorn)
 */
export const useLikeIds = () => {
  return useQuery({
    queryKey: ["likes"],
    queryFn: async (): Promise<Set<string>> => {
      const profileId = await getProfileId();
      if (!profileId) return new Set<string>();

      const { data, error } = await supabase
        .from("quiz_likes")
        .select("quiz_id")
        .eq("user_id", profileId);

      if (error) {
        console.error("Error fetching likes:", error);
        return new Set<string>();
      }

      return new Set(data?.map(l => l.quiz_id) || []);
    },
  });
};

/**
 * Get total like count for a quiz
 */
export const useQuizLikeCount = (quizId: string | null) => {
  return useQuery({
    queryKey: ["quizLikeCount", quizId],
    queryFn: async (): Promise<number> => {
      if (!quizId) return 0;

      const { count, error } = await supabase
        .from("quiz_likes")
        .select("*", { count: "exact", head: true })
        .eq("quiz_id", quizId);

      if (error) {
        console.error("Error fetching like count:", error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!quizId,
  });
};

/**
 * Toggle like (popcorn) on a quiz
 */
export const useToggleLike = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ quizId, isLiked }: { quizId: string; isLiked: boolean }) => {
      const profileId = await getProfileId();
      if (!profileId) {
        throw new Error("Нужно открыть через Telegram");
      }

      if (isLiked) {
        // Remove like - trigger will decrement like_count
        const { error } = await supabase
          .from("quiz_likes")
          .delete()
          .eq("quiz_id", quizId)
          .eq("user_id", profileId);

        if (error) throw error;
      } else {
        // Add like - trigger will increment like_count
        const { error } = await supabase
          .from("quiz_likes")
          .insert({ quiz_id: quizId, user_id: profileId });

        if (error) throw error;
      }
    },
    onMutate: async ({ quizId, isLiked }) => {
      haptic.impact('light');

      await queryClient.cancelQueries({ queryKey: ["likes"] });
      const previousLikes = queryClient.getQueryData<Set<string>>(["likes"]);

      // Optimistic update
      queryClient.setQueryData<Set<string>>(["likes"], (old) => {
        const newSet = new Set(old);
        if (isLiked) {
          newSet.delete(quizId);
        } else {
          newSet.add(quizId);
        }
        return newSet;
      });

      return { previousLikes };
    },
    onError: (err, variables, context) => {
      console.error("Like toggle error:", err);
      if (context?.previousLikes) {
        queryClient.setQueryData(["likes"], context.previousLikes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["likes"] });
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      queryClient.invalidateQueries({ queryKey: ["quizLikeCount"] });
      queryClient.invalidateQueries({ queryKey: ["userStats"] });
    },
  });
};

/**
 * Get total popcorns received by user (likes on their created quizzes)
 */
export const useTotalPopcornsReceived = () => {
  return useQuery({
    queryKey: ["totalPopcornsReceived"],
    queryFn: async (): Promise<number> => {
      const profileId = await getProfileId();
      if (!profileId) return 0;

      // Keep definition consistent with creators leaderboard:
      // - quizzes: published OR is_published, and not anonymous
      // - tests: is_published, and not anonymous
      const fetchQuizzes = async () => {
        const primary = await supabase
          .from("quizzes")
          .select("like_count")
          .eq("created_by", profileId)
          .eq("is_anonymous", false)
          .or("is_published.eq.true,status.eq.published");

        if (!primary.error) return primary;

        // Legacy fallback if `status` isn't present.
        return supabase
          .from("quizzes")
          .select("like_count")
          .eq("created_by", profileId)
          .eq("is_anonymous", false)
          .eq("is_published", true);
      };

      const fetchTests = async () => {
        const primary = await supabase
          .from("personality_tests")
          .select("like_count")
          .eq("created_by", profileId)
          .eq("is_anonymous", false)
          .eq("is_published", true);

        if (!primary.error) return primary;

        // Legacy fallback if `is_anonymous` isn't present.
        return supabase
          .from("personality_tests")
          .select("like_count")
          .eq("created_by", profileId)
          .eq("is_published", true);
      };

      const [quizzesRes, testsRes] = await Promise.all([fetchQuizzes(), fetchTests()]);

      if (quizzesRes.error) {
        console.error("Error fetching user quizzes:", quizzesRes.error);
      }
      if (testsRes.error) {
        console.error("Error fetching user tests:", testsRes.error);
      }

      const quizTotal = quizzesRes.data?.reduce((sum, quiz) => sum + (quiz.like_count || 0), 0) || 0;
      const testTotal = testsRes.data?.reduce((sum, test) => sum + (test.like_count || 0), 0) || 0;

      return quizTotal + testTotal;
    },
  });
};
