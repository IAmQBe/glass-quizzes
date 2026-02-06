import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramUser, haptic } from "@/lib/telegram";
import { toast } from "@/hooks/use-toast";
import { initUser } from "@/lib/user";
import {
  getLocalFavoriteIds,
  getLocalFavoriteTimestampMap,
  setLocalFavorite,
} from "@/lib/favoritesStorage";

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

async function ensureAuthUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id) return user.id;

  const initialized = await initUser();
  if (!initialized) {
    return null;
  }

  const {
    data: { user: refreshedUser },
  } = await supabase.auth.getUser();
  if (refreshedUser?.id) return refreshedUser.id;

  // Last-resort fallback for stale sessions.
  const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
  if (anonError) {
    console.error("ensureAuthUserId anonymous fallback failed:", anonError);
    return null;
  }

  return anonData.user?.id || null;
}

async function getCandidateUserIds(preferAuthFirst: boolean): Promise<string[]> {
  const [profileId, authUserId] = await Promise.all([
    getProfileId(),
    ensureAuthUserId(),
  ]);

  const ids = preferAuthFirst
    ? [authUserId, profileId]
    : [profileId, authUserId];

  return [...new Set(ids.filter(Boolean) as string[])];
}

async function reconcilePersonalityTestSaveCount(testId: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from("personality_test_favorites")
    .select("id", { count: "exact", head: true })
    .eq("test_id", testId);

  if (countError || typeof count !== "number") {
    if (countError) {
      console.warn("Failed to count personality test favorites:", countError);
    }
    return;
  }

  const { error: updateError } = await supabase
    .from("personality_tests")
    .update({ save_count: count })
    .eq("id", testId);

  if (updateError) {
    console.warn("Failed to sync personality test save_count:", updateError);
  }
}

async function fetchFavoriteQuizzesByIds(quizIds: string[]): Promise<any[]> {
  if (quizIds.length === 0) return [];

  let quizzes: any[] = [];

  const viewWithAnon = await supabase
    .from("quizzes_public")
    .select("id, title, description, image_url, question_count, participant_count, duration_seconds, rating, rating_count, like_count, save_count, created_by, created_at, is_anonymous")
    .in("id", quizIds);

  if (!viewWithAnon.error && (viewWithAnon.data?.length || 0) > 0) {
    quizzes = viewWithAnon.data || [];
  } else {
    const viewLegacy = await supabase
      .from("quizzes_public")
      .select("id, title, description, image_url, question_count, participant_count, duration_seconds, rating, rating_count, like_count, save_count, created_by, created_at")
      .in("id", quizIds);

    if (!viewLegacy.error && (viewLegacy.data?.length || 0) > 0) {
      quizzes = (viewLegacy.data || []).map((quiz: any) => ({
        ...quiz,
        is_anonymous: false,
      }));
    } else {
      const tableWithAnon = await supabase
        .from("quizzes")
        .select("id, title, description, image_url, question_count, participant_count, duration_seconds, rating, rating_count, like_count, save_count, created_by, created_at, is_anonymous")
        .in("id", quizIds);

      if (!tableWithAnon.error && (tableWithAnon.data?.length || 0) > 0) {
        quizzes = (tableWithAnon.data || []).map((quiz: any) => ({
          ...quiz,
          is_anonymous: quiz.is_anonymous === true,
        }));
      } else {
        const tableLegacy = await supabase
          .from("quizzes")
          .select("id, title, description, image_url, question_count, participant_count, duration_seconds, rating, rating_count, like_count, save_count, created_by, created_at")
          .in("id", quizIds);

        if (tableLegacy.error) {
          console.error(
            "Error fetching favorite quiz details:",
            viewWithAnon.error || viewLegacy.error || tableWithAnon.error || tableLegacy.error
          );
          return [];
        }

        quizzes = (tableLegacy.data || []).map((quiz: any) => ({
          ...quiz,
          is_anonymous: false,
        }));
      }
    }
  }

  return quizzes;
}

async function fetchFavoriteTestsByIds(testIds: string[]): Promise<any[]> {
  if (testIds.length === 0) return [];

  let tests: any[] = [];

  const viewWithAnon = await supabase
    .from("personality_tests_public")
    .select("id, title, description, image_url, question_count, result_count, participant_count, like_count, save_count, created_by, created_at, is_anonymous")
    .in("id", testIds);

  if (!viewWithAnon.error && (viewWithAnon.data?.length || 0) > 0) {
    tests = viewWithAnon.data || [];
  } else {
    const viewLegacy = await supabase
      .from("personality_tests_public")
      .select("id, title, description, image_url, question_count, result_count, participant_count, like_count, save_count, created_by, created_at")
      .in("id", testIds);

    if (!viewLegacy.error && (viewLegacy.data?.length || 0) > 0) {
      tests = (viewLegacy.data || []).map((test: any) => ({
        ...test,
        is_anonymous: false,
      }));
    } else {
      const tableWithAnon = await supabase
        .from("personality_tests")
        .select("id, title, description, image_url, question_count, result_count, participant_count, like_count, save_count, created_by, created_at, is_anonymous")
        .in("id", testIds);

      if (!tableWithAnon.error && (tableWithAnon.data?.length || 0) > 0) {
        tests = (tableWithAnon.data || []).map((test: any) => ({
          ...test,
          is_anonymous: test.is_anonymous === true,
        }));
      } else {
        const tableLegacy = await supabase
          .from("personality_tests")
          .select("id, title, description, image_url, question_count, result_count, participant_count, like_count, save_count, created_by, created_at")
          .in("id", testIds);

        if (tableLegacy.error) {
          console.error(
            "Error fetching favorite test details:",
            viewWithAnon.error || viewLegacy.error || tableWithAnon.error || tableLegacy.error
          );
          return [];
        }

        tests = (tableLegacy.data || []).map((test: any) => ({
          ...test,
          is_anonymous: false,
        }));
      }
    }
  }

  return tests;
}

/**
 * Get all favorites with quiz details
 */
export const useFavorites = () => {
  return useQuery({
    queryKey: ["favorites"],
    queryFn: async () => {
      const userIds = await getCandidateUserIds(true);
      const localQuizTimestampMap = getLocalFavoriteTimestampMap("quiz");
      const localTestTimestampMap = getLocalFavoriteTimestampMap("test");

      let favoritesList: any[] = [];
      let testFavorites: any[] = [];

      if (userIds.length > 0) {
        const [
          { data: favoritesData, error: favoritesError },
          { data: remoteTestFavorites, error: testFavError },
        ] = await Promise.all([
          supabase
            .from("favorites")
            .select("id, quiz_id, created_at")
            .in("user_id", userIds)
            .order("created_at", { ascending: false }),
          supabase
            .from("personality_test_favorites")
            .select("id, test_id, created_at")
            .in("user_id", userIds)
            .order("created_at", { ascending: false }),
        ]);

        if (favoritesError) {
          console.error("Error fetching quiz favorites:", favoritesError);
        }
        if (testFavError) {
          console.error("Error fetching test favorites:", testFavError);
        }

        favoritesList = favoritesData || [];
        testFavorites = remoteTestFavorites || [];
      }

      const quizIds = [
        ...new Set(
          favoritesList
            .map((f: any) => f.quiz_id)
            .concat(Object.keys(localQuizTimestampMap))
            .filter(Boolean) as string[]
        )
      ];
      const testIds = [
        ...new Set(
          testFavorites
            .map((f: any) => f.test_id)
            .concat(Object.keys(localTestTimestampMap))
            .filter(Boolean) as string[]
        )
      ];

      const [quizzes, tests] = await Promise.all([
        fetchFavoriteQuizzesByIds(quizIds),
        fetchFavoriteTestsByIds(testIds),
      ]);

      const creatorIds = [
        ...new Set(
          quizzes
            .map((q: any) => q.created_by)
            .concat(tests.map((t: any) => t.created_by))
            .filter(Boolean) as string[]
        ),
      ];
      const creatorsMap = await fetchCreatorsMap(creatorIds);

      const quizzesMap = new Map(
        quizzes.map((q: any) => [
          q.id,
          {
            ...q,
            creator: q.created_by ? creatorsMap[q.created_by] || null : null,
          }
        ])
      );
      const testsMap = new Map(
        tests.map((t: any) => [
          t.id,
          {
            ...t,
            creator: t.created_by ? creatorsMap[t.created_by] || null : null,
          }
        ])
      );

      const normalizedFavorites = favoritesList.map((f: any) => ({
        id: f.id,
        quiz_id: f.quiz_id,
        test_id: null,
        created_at: f.created_at,
        quizzes: f.quiz_id ? quizzesMap.get(f.quiz_id) || null : null,
        personality_tests: null,
      }));

      const remoteQuizIdSet = new Set(
        favoritesList.map((f: any) => f.quiz_id).filter(Boolean) as string[]
      );
      const localQuizRows = Object.entries(localQuizTimestampMap)
        .filter(([quizId]) => !remoteQuizIdSet.has(quizId))
        .map(([quizId, createdAt]) => ({
          id: `local-quiz-${quizId}`,
          quiz_id: quizId,
          test_id: null,
          created_at: createdAt || new Date().toISOString(),
          quizzes: quizzesMap.get(quizId) || null,
          personality_tests: null,
        }));

      const testFavoriteRows = testFavorites.map((f: any) => ({
        id: f.id,
        quiz_id: null,
        test_id: f.test_id,
        created_at: f.created_at,
        quizzes: null,
        personality_tests: f.test_id ? testsMap.get(f.test_id) || null : null,
      }));

      const remoteTestIdSet = new Set(
        testFavorites.map((f: any) => f.test_id).filter(Boolean) as string[]
      );
      const localTestRows = Object.entries(localTestTimestampMap)
        .filter(([testId]) => !remoteTestIdSet.has(testId))
        .map(([testId, createdAt]) => ({
          id: `local-test-${testId}`,
          quiz_id: null,
          test_id: testId,
          created_at: createdAt || new Date().toISOString(),
          quizzes: null,
          personality_tests: testsMap.get(testId) || null,
        }));

      const merged = [
        ...normalizedFavorites,
        ...localQuizRows,
        ...testFavoriteRows,
        ...localTestRows,
      ]
        .filter((item) => item.quizzes || item.personality_tests)
        .sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

      return merged;
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
      const localIds = getLocalFavoriteIds("test");
      const userIds = await getCandidateUserIds(false);
      if (userIds.length === 0) return localIds;

      const { data, error } = await supabase
        .from("personality_test_favorites")
        .select("test_id")
        .in("user_id", userIds);

      if (error) {
        console.error("Error fetching test favorite IDs:", error);
        return localIds;
      }

      const merged = new Set((data || []).map((f) => f.test_id).filter(Boolean) as string[]);
      localIds.forEach((id) => merged.add(id));
      return merged;
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
      const nextFavoriteState = !isFavorite;
      const userIds = await getCandidateUserIds(false);

      let lastError: any = userIds.length === 0 ? new Error("Нужно открыть через Telegram") : null;
      let applied = false;

      for (const userId of userIds) {
        if (isFavorite) {
          const { error } = await supabase
            .from("personality_test_favorites")
            .delete()
            .eq("user_id", userId)
            .eq("test_id", testId);

          if (!error) {
            applied = true;
            break;
          }
          lastError = error;
        } else {
          const { error } = await supabase
            .from("personality_test_favorites")
            .insert({ user_id: userId, test_id: testId });

          if (!error || error.code === "23505") {
            applied = true;
            break;
          }
          lastError = error;
        }
      }

      if (!applied) {
        throw lastError || new Error("Не удалось обновить избранное теста");
      }

      if (!applied) {
        const localApplied = setLocalFavorite("test", testId, nextFavoriteState);
        if (localApplied) {
          console.warn("Using local fallback for test favorites toggle:", lastError);
          return { remoteApplied: false, localApplied: true };
        }
        throw lastError || new Error("Не удалось обновить избранное теста");
      }

      // Keep local state in sync and reconcile counter to exact remote value.
      setLocalFavorite("test", testId, nextFavoriteState);
      await reconcilePersonalityTestSaveCount(testId);

      return { remoteApplied: true, localApplied: true };
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
      toast({
        title: "Ошибка",
        description: "Не удалось обновить избранное",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["testFavoriteIds"] });
      queryClient.invalidateQueries({ queryKey: ["personalityTestFavorites"] });
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
      const localIds = getLocalFavoriteIds("quiz");
      const userIds = await getCandidateUserIds(true);
      if (userIds.length === 0) return localIds;

      const { data, error } = await supabase
        .from("favorites")
        .select("quiz_id")
        .in("user_id", userIds);

      if (error) {
        console.error("Error fetching favorite IDs:", error);
        return localIds;
      }

      const merged = new Set((data || []).map((f) => f.quiz_id));
      localIds.forEach((id) => merged.add(id));
      return merged;
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
      const nextFavoriteState = !isFavorite;
      const userIds = await getCandidateUserIds(true);

      let lastError: any = userIds.length === 0 ? new Error("Нужно открыть через Telegram") : null;
      let applied = false;

      for (const userId of userIds) {
        if (isFavorite) {
          const { error } = await supabase
            .from("favorites")
            .delete()
            .eq("user_id", userId)
            .eq("quiz_id", quizId);

          if (!error) {
            applied = true;
            break;
          }
          lastError = error;
        } else {
          const { error } = await supabase
            .from("favorites")
            .insert({ user_id: userId, quiz_id: quizId });

          if (!error || error.code === "23505") {
            applied = true;
            break;
          }
          lastError = error;
        }
      }

      if (!applied) {
        const localApplied = setLocalFavorite("quiz", quizId, nextFavoriteState);
        if (localApplied) {
          console.warn("Using local fallback for quiz favorites toggle:", lastError);
          return { remoteApplied: false, localApplied: true };
        }
        throw lastError || new Error("Не удалось обновить избранное квиза");
      }

      setLocalFavorite("quiz", quizId, nextFavoriteState);
      return { remoteApplied: true, localApplied: true };
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
      toast({
        title: "Ошибка",
        description: "Не удалось обновить избранное",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["favoriteIds"] });
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
    },
  });
};
