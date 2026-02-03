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
            is_published,
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
        // Remove favorite
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", profileId)
          .eq("quiz_id", quizId);

        if (error) throw error;

        // Decrement save_count
        const { data: quiz } = await supabase
          .from("quizzes")
          .select("save_count")
          .eq("id", quizId)
          .single();

        await supabase
          .from("quizzes")
          .update({ save_count: Math.max(0, (quiz?.save_count || 1) - 1) })
          .eq("id", quizId);
      } else {
        // Add favorite
        const { error } = await supabase
          .from("favorites")
          .insert({ user_id: profileId, quiz_id: quizId });

        if (error) throw error;

        // Increment save_count
        const { data: quiz } = await supabase
          .from("quizzes")
          .select("save_count")
          .eq("id", quizId)
          .single();

        await supabase
          .from("quizzes")
          .update({ save_count: (quiz?.save_count || 0) + 1 })
          .eq("id", quizId);
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
