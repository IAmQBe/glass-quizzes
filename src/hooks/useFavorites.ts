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
 * Get all favorites with quiz details
 */
export const useFavorites = () => {
  return useQuery({
    queryKey: ["favorites"],
    queryFn: async () => {
      const profileId = await getProfileId();
      if (!profileId) return [];

      const { data, error } = await supabase
        .from("favorites")
        .select(`
          id,
          quiz_id,
          test_id,
          created_at,
          quizzes (
            id,
            title,
            description,
            image_url,
            question_count,
            participant_count,
            duration_seconds,
            rating,
            rating_count,
            like_count,
            save_count,
            status,
            created_at
          ),
          personality_tests (
            id,
            title,
            description,
            image_url,
            question_count,
            result_count,
            participant_count,
            like_count,
            save_count,
            status,
            created_at
          )
        `)
        .eq("user_id", profileId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching favorites:", error);
        return [];
      }

      return data || [];
    },
  });
};

/**
 * Get IDs of saved/favorited tests
 */
export const useTestFavoriteIds = () => {
  return useQuery({
    queryKey: ["testFavoriteIds"],
    queryFn: async (): Promise<Set<string>> => {
      const profileId = await getProfileId();
      if (!profileId) return new Set<string>();

      const { data, error } = await supabase
        .from("favorites")
        .select("test_id")
        .eq("user_id", profileId)
        .not("test_id", "is", null);

      if (error) {
        console.error("Error fetching test favorite IDs:", error);
        return new Set<string>();
      }

      return new Set((data || []).map((f) => f.test_id).filter(Boolean) as string[]);
    },
  });
};

/**
 * Toggle favorite (save) on a test
 */
export const useToggleTestFavorite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ testId, isFavorite }: { testId: string; isFavorite: boolean }) => {
      const profileId = await getProfileId();
      if (!profileId) {
        throw new Error("Нужно открыть через Telegram");
      }

      if (isFavorite) {
        // Remove favorite
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", profileId)
          .eq("test_id", testId);

        if (error) throw error;

        // Decrement save_count on test
        const { data: test } = await supabase
          .from("personality_tests")
          .select("save_count")
          .eq("id", testId)
          .single();

        await supabase
          .from("personality_tests")
          .update({ save_count: Math.max(0, (test?.save_count || 1) - 1) })
          .eq("id", testId);
      } else {
        // Add favorite
        const { error } = await supabase
          .from("favorites")
          .insert({ user_id: profileId, test_id: testId });

        if (error) throw error;

        // Increment save_count on test
        const { data: test } = await supabase
          .from("personality_tests")
          .select("save_count")
          .eq("id", testId)
          .single();

        await supabase
          .from("personality_tests")
          .update({ save_count: (test?.save_count || 0) + 1 })
          .eq("id", testId);
      }
    },
    onMutate: async ({ testId, isFavorite }) => {
      haptic.impact('light');

      await queryClient.cancelQueries({ queryKey: ["testFavoriteIds"] });
      const previous = queryClient.getQueryData<Set<string>>(["testFavoriteIds"]);

      queryClient.setQueryData<Set<string>>(["testFavoriteIds"], (old) => {
        const newSet = new Set(old);
        if (isFavorite) {
          newSet.delete(testId);
        } else {
          newSet.add(testId);
        }
        return newSet;
      });

      return { previous };
    },
    onError: (err, variables, context) => {
      console.error("Test favorite toggle error:", err);
      if (context?.previous) {
        queryClient.setQueryData(["testFavoriteIds"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["testFavoriteIds"] });
      queryClient.invalidateQueries({ queryKey: ["personalityTests"] });
    },
  });
};

/**
 * Get IDs of saved/favorited quizzes
 */
export const useFavoriteIds = () => {
  return useQuery({
    queryKey: ["favoriteIds"],
    queryFn: async (): Promise<Set<string>> => {
      const profileId = await getProfileId();
      if (!profileId) return new Set<string>();

      const { data, error } = await supabase
        .from("favorites")
        .select("quiz_id")
        .eq("user_id", profileId);

      if (error) {
        console.error("Error fetching favorite IDs:", error);
        return new Set<string>();
      }

      return new Set((data || []).map((f) => f.quiz_id));
    },
  });
};

/**
 * Toggle favorite (save) on a quiz
 */
export const useToggleFavorite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ quizId, isFavorite }: { quizId: string; isFavorite: boolean }) => {
      const profileId = await getProfileId();
      if (!profileId) {
        throw new Error("Нужно открыть через Telegram");
      }

      if (isFavorite) {
        // Remove favorite - trigger will decrement save_count
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", profileId)
          .eq("quiz_id", quizId);

        if (error) throw error;
      } else {
        // Add favorite - trigger will increment save_count
        const { error } = await supabase
          .from("favorites")
          .insert({ user_id: profileId, quiz_id: quizId });

        if (error) throw error;
      }
    },
    onMutate: async ({ quizId, isFavorite }) => {
      haptic.impact('light');

      await queryClient.cancelQueries({ queryKey: ["favoriteIds"] });
      const previousFavorites = queryClient.getQueryData<Set<string>>(["favoriteIds"]);

      // Optimistic update
      queryClient.setQueryData<Set<string>>(["favoriteIds"], (old) => {
        const newSet = new Set(old);
        if (isFavorite) {
          newSet.delete(quizId);
        } else {
          newSet.add(quizId);
        }
        return newSet;
      });

      return { previousFavorites };
    },
    onError: (err, variables, context) => {
      console.error("Favorite toggle error:", err);
      if (context?.previousFavorites) {
        queryClient.setQueryData(["favoriteIds"], context.previousFavorites);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["favoriteIds"] });
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
    },
  });
};
