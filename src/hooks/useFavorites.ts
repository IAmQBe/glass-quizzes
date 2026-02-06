import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramUser, haptic } from "@/lib/telegram";

interface CreatorInfo {
  id: string;
  first_name: string | null;
  username: string | null;
  avatar_url: string | null;
  squad?: {
    id: string;
    title: string;
    username: string | null;
  } | null;
}

async function fetchCreatorsMap(creatorIds: string[]): Promise<Record<string, CreatorInfo>> {
  if (creatorIds.length === 0) return {};

  const { data: creators } = await supabase
    .from("profiles")
    .select(`
      id,
      first_name,
      username,
      avatar_url,
      squad_id
    `)
    .in("id", creatorIds);

  if (!creators || creators.length === 0) return {};

  const squadIds = [...new Set(creators.map(c => c.squad_id).filter(Boolean))];
  let squadsMap: Record<string, { id: string; title: string; username: string | null }> = {};

  if (squadIds.length > 0) {
    const { data: squads } = await supabase
      .from("squads")
      .select("id, title, username")
      .in("id", squadIds);

    if (squads) {
      squadsMap = Object.fromEntries(squads.map(s => [s.id, s]));
    }
  }

  return Object.fromEntries(creators.map(c => [c.id, {
    id: c.id,
    first_name: c.first_name,
    username: c.username,
    avatar_url: c.avatar_url,
    squad: c.squad_id ? squadsMap[c.squad_id] || null : null,
  }]));
}

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
            created_by,
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
            created_by,
            created_at
          )
        `)
        .eq("user_id", profileId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching favorites:", error);
        return [];
      }

      const favorites = data || [];

      const { data: testFavorites, error: testFavError } = await supabase
        .from("personality_test_favorites")
        .select(`
          id,
          test_id,
          created_at,
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
            created_at,
            created_by
          )
        `)
        .eq("user_id", profileId)
        .order("created_at", { ascending: false });

      if (testFavError) {
        console.error("Error fetching test favorites:", testFavError);
      }

      const testFavoriteRows = (testFavorites || []).map((f: any) => ({
        id: f.id,
        quiz_id: null,
        test_id: f.test_id,
        created_at: f.created_at,
        quizzes: null,
        personality_tests: f.personality_tests,
      }));

      const creatorIds = [
        ...new Set(
          favorites
            .flatMap(f => [f.quizzes?.created_by, f.personality_tests?.created_by])
            .concat(
              testFavoriteRows.map((f: any) => f.personality_tests?.created_by)
            )
            .filter(Boolean) as string[]
        ),
      ];

      const creatorsMap = await fetchCreatorsMap(creatorIds);

      const withCreators = (rows: any[]) => rows.map(f => ({
        ...f,
        quizzes: f.quizzes
          ? {
              ...f.quizzes,
              creator: f.quizzes.created_by ? creatorsMap[f.quizzes.created_by] || null : null,
            }
          : f.quizzes,
        personality_tests: f.personality_tests
          ? {
              ...f.personality_tests,
              creator: f.personality_tests.created_by
                ? creatorsMap[f.personality_tests.created_by] || null
                : null,
            }
          : f.personality_tests,
      }));

      const merged = [...favorites, ...testFavoriteRows].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return withCreators(merged);
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
