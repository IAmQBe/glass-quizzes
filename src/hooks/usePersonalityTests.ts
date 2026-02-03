import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramUser, haptic } from "@/lib/telegram";

// ============================================
// Types
// ============================================

export interface CreatorInfo {
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

export interface PersonalityTest {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  created_by: string | null;
  question_count: number;
  result_count: number;
  participant_count: number;
  like_count: number;
  save_count: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  creator?: CreatorInfo | null;
}

export interface PersonalityTestQuestion {
  id: string;
  test_id: string;
  question_text: string;
  image_url: string | null;
  order_index: number;
  answers?: PersonalityTestAnswer[];
}

export interface PersonalityTestAnswer {
  id: string;
  question_id: string;
  answer_text: string;
  result_points: Record<string, number>;
  order_index: number;
}

export interface PersonalityTestResult {
  id: string;
  test_id: string;
  result_key: string;
  title: string;
  description: string;
  image_url: string | null;
  share_text: string | null;
  order_index: number;
}

export interface PersonalityTestCompletion {
  id: string;
  user_id: string | null;
  test_id: string;
  result_id: string;
  answers: Record<string, number> | null;
  completed_at: string;
  result?: PersonalityTestResult;
  test?: PersonalityTest;
}

// ============================================
// Helper Functions
// ============================================

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

// ============================================
// Hooks - Fetching Tests
// ============================================

/**
 * Get all published personality tests
 */
export const usePublishedPersonalityTests = () => {
  return useQuery({
    queryKey: ["personalityTests", "published"],
    queryFn: async (): Promise<PersonalityTest[]> => {
      // First, get tests
      const { data: tests, error: testError } = await supabase
        .from("personality_tests")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (testError) {
        console.error("Error fetching personality tests:", testError);
        throw testError;
      }

      if (!tests || tests.length === 0) {
        return [];
      }

      // Get unique creator IDs
      const creatorIds = [...new Set(tests.map(t => t.created_by).filter(Boolean))];

      // Fetch creators separately
      let creatorsMap: Record<string, CreatorInfo> = {};
      if (creatorIds.length > 0) {
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

        if (creators) {
          // Get squad info for creators who have squads
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

          creatorsMap = Object.fromEntries(creators.map(c => [c.id, {
            id: c.id,
            first_name: c.first_name,
            username: c.username,
            avatar_url: c.avatar_url,
            squad: c.squad_id ? squadsMap[c.squad_id] || null : null,
          }]));
        }
      }

      // Merge tests with creators
      return tests.map(test => ({
        ...test,
        creator: test.created_by ? creatorsMap[test.created_by] || null : null,
      })) as PersonalityTest[];
    },
  });
};

/**
 * Get personality tests created by current user
 */
export const useMyPersonalityTests = () => {
  return useQuery({
    queryKey: ["personalityTests", "my"],
    queryFn: async (): Promise<PersonalityTest[]> => {
      const profileId = await getProfileId();
      if (!profileId) return [];

      const { data, error } = await supabase
        .from("personality_tests")
        .select("*")
        .eq("created_by", profileId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as PersonalityTest[];
    },
  });
};

/**
 * Get pending personality tests for moderation
 */
export const usePendingPersonalityTests = () => {
  return useQuery({
    queryKey: ["personalityTests", "pending"],
    queryFn: async (): Promise<PersonalityTest[]> => {
      const { data, error } = await supabase
        .from("personality_tests")
        .select("*")
        .eq("is_published", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as PersonalityTest[];
    },
  });
};

/**
 * Get a single personality test with all questions, answers, and results
 */
export const usePersonalityTestWithDetails = (testId: string | null) => {
  return useQuery({
    queryKey: ["personalityTest", testId],
    queryFn: async () => {
      if (!testId) return null;

      // Fetch test
      const { data: test, error: testError } = await supabase
        .from("personality_tests")
        .select("*")
        .eq("id", testId)
        .single();

      if (testError) throw testError;

      // Fetch questions
      const { data: questions, error: questionsError } = await supabase
        .from("personality_test_questions")
        .select("*")
        .eq("test_id", testId)
        .order("order_index", { ascending: true });

      if (questionsError) throw questionsError;

      // Fetch answers for all questions
      const questionIds = questions?.map(q => q.id) || [];
      const { data: answers, error: answersError } = await supabase
        .from("personality_test_answers")
        .select("*")
        .in("question_id", questionIds.length > 0 ? questionIds : ['none'])
        .order("order_index", { ascending: true });

      if (answersError) throw answersError;

      // Fetch results
      const { data: results, error: resultsError } = await supabase
        .from("personality_test_results")
        .select("*")
        .eq("test_id", testId)
        .order("order_index", { ascending: true });

      if (resultsError) throw resultsError;

      // Map answers to questions
      const questionsWithAnswers = questions?.map(q => ({
        ...q,
        answers: (answers || []).filter(a => a.question_id === q.id)
      })) || [];

      return {
        test: test as PersonalityTest,
        questions: questionsWithAnswers as PersonalityTestQuestion[],
        results: (results || []) as PersonalityTestResult[],
      };
    },
    enabled: !!testId,
  });
};

// ============================================
// Hooks - Creating Tests
// ============================================

interface CreatePersonalityTestInput {
  title: string;
  description?: string;
  image_url?: string;
  results: {
    result_key: string;
    title: string;
    description: string;
    image_url?: string;
    share_text?: string;
  }[];
  questions: {
    question_text: string;
    image_url?: string;
    answers: {
      answer_text: string;
      result_points: Record<string, number>;
    }[];
  }[];
}

/**
 * Create a new personality test
 */
export const useCreatePersonalityTest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePersonalityTestInput) => {
      const profileId = await getProfileId();
      if (!profileId) {
        throw new Error("Нужно открыть через Telegram");
      }

      // 1. Create the test
      const { data: test, error: testError } = await supabase
        .from("personality_tests")
        .insert({
          title: input.title,
          description: input.description || null,
          image_url: input.image_url || null,
          created_by: profileId,
          question_count: input.questions.length,
          result_count: input.results.length,
          is_published: false,
        })
        .select()
        .single();

      if (testError) throw testError;

      // 2. Create results
      const resultsToInsert = input.results.map((r, index) => ({
        test_id: test.id,
        result_key: r.result_key,
        title: r.title,
        description: r.description,
        image_url: r.image_url || null,
        share_text: r.share_text || null,
        order_index: index,
      }));

      const { error: resultsError } = await supabase
        .from("personality_test_results")
        .insert(resultsToInsert);

      if (resultsError) throw resultsError;

      // 3. Create questions
      for (let qIndex = 0; qIndex < input.questions.length; qIndex++) {
        const q = input.questions[qIndex];

        const { data: question, error: questionError } = await supabase
          .from("personality_test_questions")
          .insert({
            test_id: test.id,
            question_text: q.question_text,
            image_url: q.image_url || null,
            order_index: qIndex,
          })
          .select()
          .single();

        if (questionError) throw questionError;

        // 4. Create answers for this question
        const answersToInsert = q.answers.map((a, aIndex) => ({
          question_id: question.id,
          answer_text: a.answer_text,
          result_points: a.result_points,
          order_index: aIndex,
        }));

        const { error: answersError } = await supabase
          .from("personality_test_answers")
          .insert(answersToInsert);

        if (answersError) throw answersError;
      }

      return test as PersonalityTest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personalityTests"] });
    },
  });
};

// ============================================
// Hooks - Completing Tests
// ============================================

/**
 * Calculate result based on answers
 */
export function calculatePersonalityResult(
  answers: number[],
  questions: PersonalityTestQuestion[]
): string {
  const scores: Record<string, number> = {};

  answers.forEach((answerIndex, questionIndex) => {
    const question = questions[questionIndex];
    if (!question?.answers?.[answerIndex]) return;

    const answer = question.answers[answerIndex];
    const resultPoints = answer.result_points || {};

    Object.entries(resultPoints).forEach(([key, points]) => {
      scores[key] = (scores[key] || 0) + (points as number);
    });
  });

  // Find result with max score
  const sortedResults = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return sortedResults.length > 0 ? sortedResults[0][0] : '';
}

/**
 * Submit test completion
 */
export const useSubmitPersonalityTestCompletion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      testId,
      resultKey,
      answers,
    }: {
      testId: string;
      resultKey: string;
      answers: number[];
    }) => {
      const profileId = await getProfileId();

      // Find result by key
      const { data: result, error: resultError } = await supabase
        .from("personality_test_results")
        .select("*")
        .eq("test_id", testId)
        .eq("result_key", resultKey)
        .single();

      if (resultError) throw resultError;

      // Create completion record
      const { data: completion, error: completionError } = await supabase
        .from("personality_test_completions")
        .insert({
          user_id: profileId,
          test_id: testId,
          result_id: result.id,
          answers: { indices: answers },
        })
        .select()
        .single();

      if (completionError) throw completionError;

      // Increment participant count
      await supabase
        .from("personality_tests")
        .update({
          participant_count: supabase.rpc ? undefined : 0 // Will be incremented manually
        })
        .eq("id", testId);

      // Manual increment
      const { data: test } = await supabase
        .from("personality_tests")
        .select("participant_count")
        .eq("id", testId)
        .single();

      await supabase
        .from("personality_tests")
        .update({ participant_count: (test?.participant_count || 0) + 1 })
        .eq("id", testId);

      return {
        completion,
        result: result as PersonalityTestResult,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personalityTests"] });
      queryClient.invalidateQueries({ queryKey: ["personalityTestCompletions"] });
    },
  });
};

/**
 * Get user's test completions
 */
export const useMyPersonalityTestCompletions = () => {
  return useQuery({
    queryKey: ["personalityTestCompletions", "my"],
    queryFn: async (): Promise<PersonalityTestCompletion[]> => {
      const profileId = await getProfileId();
      if (!profileId) return [];

      const { data, error } = await supabase
        .from("personality_test_completions")
        .select(`
          *,
          result:personality_test_results(*),
          test:personality_tests(*)
        `)
        .eq("user_id", profileId)
        .order("completed_at", { ascending: false });

      if (error) throw error;
      return (data || []) as PersonalityTestCompletion[];
    },
  });
};

/**
 * Get Set of completed test IDs for current user
 */
export const useCompletedTestIds = () => {
  return useQuery({
    queryKey: ["completedTestIds"],
    queryFn: async (): Promise<Set<string>> => {
      const profileId = await getProfileId();
      if (!profileId) return new Set();

      const { data, error } = await supabase
        .from("personality_test_completions")
        .select("test_id")
        .eq("user_id", profileId);

      if (error) return new Set();
      return new Set((data || []).map(c => c.test_id));
    },
  });
};

// ============================================
// Hooks - Likes & Favorites
// ============================================

/**
 * Get liked test IDs
 */
export const usePersonalityTestLikeIds = () => {
  return useQuery({
    queryKey: ["personalityTestLikes"],
    queryFn: async (): Promise<Set<string>> => {
      const profileId = await getProfileId();
      if (!profileId) return new Set();

      const { data, error } = await supabase
        .from("personality_test_likes")
        .select("test_id")
        .eq("user_id", profileId);

      if (error) return new Set();
      return new Set(data?.map(l => l.test_id) || []);
    },
  });
};

/**
 * Toggle like on a personality test
 */
export const useTogglePersonalityTestLike = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ testId, isLiked }: { testId: string; isLiked: boolean }) => {
      const profileId = await getProfileId();
      if (!profileId) throw new Error("Нужно открыть через Telegram");

      if (isLiked) {
        await supabase
          .from("personality_test_likes")
          .delete()
          .eq("test_id", testId)
          .eq("user_id", profileId);

        // Decrement
        const { data: test } = await supabase
          .from("personality_tests")
          .select("like_count")
          .eq("id", testId)
          .single();

        await supabase
          .from("personality_tests")
          .update({ like_count: Math.max(0, (test?.like_count || 1) - 1) })
          .eq("id", testId);
      } else {
        await supabase
          .from("personality_test_likes")
          .insert({ test_id: testId, user_id: profileId });

        // Increment
        const { data: test } = await supabase
          .from("personality_tests")
          .select("like_count")
          .eq("id", testId)
          .single();

        await supabase
          .from("personality_tests")
          .update({ like_count: (test?.like_count || 0) + 1 })
          .eq("id", testId);
      }
    },
    onMutate: async ({ testId, isLiked }) => {
      haptic.impact('light');

      await queryClient.cancelQueries({ queryKey: ["personalityTestLikes"] });
      const previous = queryClient.getQueryData<Set<string>>(["personalityTestLikes"]);

      queryClient.setQueryData<Set<string>>(["personalityTestLikes"], (old) => {
        const newSet = new Set(old);
        if (isLiked) {
          newSet.delete(testId);
        } else {
          newSet.add(testId);
        }
        return newSet;
      });

      return { previous };
    },
    onError: (err, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["personalityTestLikes"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["personalityTestLikes"] });
      queryClient.invalidateQueries({ queryKey: ["personalityTests"] });
    },
  });
};

/**
 * Get favorite test IDs
 */
export const usePersonalityTestFavoriteIds = () => {
  return useQuery({
    queryKey: ["personalityTestFavorites"],
    queryFn: async (): Promise<Set<string>> => {
      const profileId = await getProfileId();
      if (!profileId) return new Set();

      const { data, error } = await supabase
        .from("personality_test_favorites")
        .select("test_id")
        .eq("user_id", profileId);

      if (error) return new Set();
      return new Set(data?.map(f => f.test_id) || []);
    },
  });
};

/**
 * Toggle favorite on a personality test
 */
export const useTogglePersonalityTestFavorite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ testId, isFavorite }: { testId: string; isFavorite: boolean }) => {
      const profileId = await getProfileId();
      if (!profileId) throw new Error("Нужно открыть через Telegram");

      if (isFavorite) {
        await supabase
          .from("personality_test_favorites")
          .delete()
          .eq("test_id", testId)
          .eq("user_id", profileId);

        // Decrement
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
        await supabase
          .from("personality_test_favorites")
          .insert({ test_id: testId, user_id: profileId });

        // Increment
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

      await queryClient.cancelQueries({ queryKey: ["personalityTestFavorites"] });
      const previous = queryClient.getQueryData<Set<string>>(["personalityTestFavorites"]);

      queryClient.setQueryData<Set<string>>(["personalityTestFavorites"], (old) => {
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
    onError: (err, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["personalityTestFavorites"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["personalityTestFavorites"] });
      queryClient.invalidateQueries({ queryKey: ["personalityTests"] });
    },
  });
};

// ============================================
// Hooks - Moderation
// ============================================

/**
 * Publish/unpublish a personality test (admin only)
 */
export const useModeratePersonalityTest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ testId, publish }: { testId: string; publish: boolean }) => {
      const { data, error } = await supabase
        .from("personality_tests")
        .update({ is_published: publish })
        .eq("id", testId)
        .select()
        .single();

      if (error) throw error;
      return data as PersonalityTest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personalityTests"] });
    },
  });
};
