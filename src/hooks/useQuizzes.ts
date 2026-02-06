import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadManualModerationEnabled } from "@/lib/moderationSettings";

// Creator info for display
export interface CreatorInfo {
  id: string;
  first_name: string | null;
  username: string | null;
  avatar_url: string | null;
  squad?: {
    id: string;
    title: string;
    username: string | null;
    invite_link?: string | null;
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
  let squadsMap: Record<string, { id: string; title: string; username: string | null; invite_link?: string | null }> = {};

  if (squadIds.length > 0) {
    const { data: squads } = await supabase
      .from("squads")
      .select("id, title, username, invite_link")
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

// Quiz interface matching actual Supabase schema
export interface Quiz {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  created_by: string | null;
  question_count: number;
  participant_count: number;
  duration_seconds: number;
  is_published: boolean;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
  rating: number | null;
  rating_count: number | null;
  like_count: number;
  save_count: number;
  creator?: CreatorInfo | null;
}

export interface QuestionOption {
  text: string;
}

export interface Question {
  id: string;
  quiz_id: string;
  question_text: string;
  image_url: string | null;
  options: QuestionOption[];
  correct_answer: number;
  order_index: number;
}

// Get all published quizzes with creator info
export const usePublishedQuizzes = () => {
  return useQuery({
    queryKey: ["quizzes", "published"],
    queryFn: async (): Promise<Quiz[]> => {
      // Primary source: public view (with anonymous masking).
      const { data: viewQuizzes, error: viewError } = await supabase
        .from("quizzes_public")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      let quizzes = viewQuizzes || [];

      // Fallback source: base table (for environments where the view is empty/broken).
      if ((viewError || quizzes.length === 0)) {
        const { data: tableQuizzes, error: tableError } = await supabase
          .from("quizzes")
          .select("*")
          .or("is_published.eq.true,status.eq.published")
          .order("created_at", { ascending: false });

        if (tableError && viewError) {
          console.error("Error fetching quizzes from view and table:", viewError, tableError);
          throw tableError;
        }

        if (tableQuizzes && tableQuizzes.length > 0) {
          quizzes = tableQuizzes;
        }
      }

      const visibleQuizzes = (quizzes || []).filter(
        (quiz) => quiz && (quiz.is_published === true || (quiz as { status?: string | null }).status === "published")
      );

      if (visibleQuizzes.length === 0) {
        return [];
      }

      // Get unique creator IDs
      const creatorIds = [...new Set(
        visibleQuizzes
          .filter((q) => !q.is_anonymous)
          .map(q => q.created_by)
          .filter(Boolean)
      )];

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
          let squadsMap: Record<string, { id: string; title: string; username: string | null; invite_link?: string | null }> = {};

          if (squadIds.length > 0) {
            const { data: squads } = await supabase
              .from("squads")
              .select("id, title, username, invite_link")
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

      // Merge quizzes with creators
      return visibleQuizzes.map(quiz => ({
        ...quiz,
        creator: !quiz.is_anonymous && quiz.created_by ? creatorsMap[quiz.created_by] || null : null,
      })) as Quiz[];
    },
  });
};

// Get quiz with questions
export const useQuizWithQuestions = (quizId: string | null) => {
  return useQuery({
    queryKey: ["quiz", quizId],
    queryFn: async () => {
      if (!quizId) return null;

      const { data: viewQuiz, error: viewError } = await supabase
        .from("quizzes_public")
        .select("*")
        .eq("id", quizId)
        .single();

      let quiz = viewQuiz;

      if (!quiz) {
        const { data: tableQuiz, error: tableError } = await supabase
          .from("quizzes")
          .select("*")
          .eq("id", quizId)
          .single();

        if (tableError && viewError) {
          throw tableError;
        }

        quiz = tableQuiz;
      }

      if (!quiz) {
        throw viewError ?? new Error("Quiz not found");
      }

      let creator: CreatorInfo | null = null;
      if (quiz.created_by && !quiz.is_anonymous) {
        const creatorsMap = await fetchCreatorsMap([quiz.created_by]);
        creator = creatorsMap[quiz.created_by] || null;
      }

      const { data: questions, error: questionsError } = await supabase
        .from("questions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("order_index", { ascending: true });

      if (questionsError) throw questionsError;

      return {
        quiz: {
          ...quiz,
          creator,
        },
        questions: (questions || []).map(q => ({
          ...q,
          options: Array.isArray(q.options) ? (q.options as unknown as QuestionOption[]) : []
        })),
      };
    },
    enabled: !!quizId,
  });
};

// Get quizzes created by current user (by telegram_id)
export const useMyQuizzes = () => {
  return useQuery({
    queryKey: ["quizzes", "my"],
    queryFn: async (): Promise<Quiz[]> => {
      const { getTelegramUser } = await import("@/lib/telegram");
      const tgUser = getTelegramUser();

      if (!tgUser?.id) return [];

      // Find profile by telegram_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("telegram_id", tgUser.id)
        .maybeSingle();

      if (!profile) return [];

      const { data, error } = await supabase
        .from("quizzes")
        .select("*")
        .eq("created_by", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};

// Get quizzes pending moderation (not published)
export const usePendingQuizzes = () => {
  return useQuery({
    queryKey: ["quizzes", "pending"],
    queryFn: async (): Promise<Quiz[]> => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("*")
        .eq("is_published", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Quiz[];
    },
  });
};

interface QuestionInput {
  text: string;
  options: string[];
  correctAnswer: number;
}

// Create a new quiz
export const useCreateQuiz = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quiz: {
      title: string;
      description?: string;
      image_url?: string;
      duration_seconds?: number;
      is_anonymous?: boolean;
      questions?: QuestionInput[];
    }) => {
      console.log("Creating quiz...", quiz.title);

      // Import telegram helpers
      const { getTelegramUser } = await import("@/lib/telegram");
      const tgUser = getTelegramUser();

      if (!tgUser?.id) {
        throw new Error("Откройте приложение через Telegram");
      }

      console.log("Telegram user:", tgUser.id, tgUser.first_name);

      // Step 1: Find or create profile by telegram_id
      let profileId: string;

      // Try to find existing profile
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("telegram_id", tgUser.id)
        .maybeSingle();

      if (existingProfile) {
        profileId = existingProfile.id;
        console.log("Found existing profile:", profileId);
      } else {
        // Create new profile
        const newId = crypto.randomUUID();

        const { data: newProfile, error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: newId,
            telegram_id: tgUser.id,
            username: tgUser.username || null,
            first_name: tgUser.first_name,
            last_name: tgUser.last_name || null,
            avatar_url: tgUser.photo_url || null,
            has_telegram_premium: tgUser.is_premium || false,
          })
          .select("id")
          .single();

        if (profileError || !newProfile) {
          console.error("Failed to create profile:", profileError);
          console.error("Profile error details:", JSON.stringify(profileError, null, 2));
          throw new Error(`Не удалось создать профиль: ${profileError?.message || 'Unknown error'}`);
        }

        profileId = newProfile.id;
        console.log("Created new profile:", profileId);
      }

      // Step 2: Create quiz
      const manualModerationEnabled = await loadManualModerationEnabled();
      const publishImmediately = !manualModerationEnabled;
      const now = new Date().toISOString();

      const insertPayload = {
        title: quiz.title,
        description: quiz.description || null,
        image_url: quiz.image_url || null,
        duration_seconds: quiz.duration_seconds || 60,
        question_count: quiz.questions?.length || 0,
        is_published: publishImmediately,
        created_by: profileId,
        is_anonymous: quiz.is_anonymous ?? false,
      };

      let quizData: any = null;
      const { data: quizWithStatus, error: quizWithStatusError } = await (supabase as any)
        .from("quizzes")
        .insert({
          ...insertPayload,
          status: publishImmediately ? "published" : "pending",
          rejection_reason: null,
          submitted_at: manualModerationEnabled ? now : null,
          moderated_at: publishImmediately ? now : null,
        })
        .select()
        .single();

      if (quizWithStatusError) {
        const { data: fallbackQuiz, error: fallbackQuizError } = await supabase
          .from("quizzes")
          .insert(insertPayload)
          .select()
          .single();

        if (fallbackQuizError) {
          console.error("Quiz creation error:", fallbackQuizError);
          throw new Error(`Ошибка создания квиза: ${fallbackQuizError.message}`);
        }

        quizData = fallbackQuiz;
      } else {
        quizData = quizWithStatus;
      }

      console.log("Quiz created:", quizData.id);

      // Step 3: Create questions if provided
      if (quiz.questions && quiz.questions.length > 0) {
        const questionsToInsert = quiz.questions.map((q, index) => ({
          quiz_id: quizData.id,
          question_text: q.text,
          options: q.options.map(opt => ({ text: opt })),
          correct_answer: q.correctAnswer,
          order_index: index,
        }));

        const { error: questionsError } = await supabase
          .from("questions")
          .insert(questionsToInsert);

        if (questionsError) {
          // Rollback: delete the quiz if questions failed
          await supabase.from("quizzes").delete().eq("id", quizData.id);
          console.error("Questions creation error:", questionsError);
          throw new Error(`Ошибка создания вопросов: ${questionsError.message}`);
        }
      }

      return quizData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
    },
  });
};

// Submit quiz for review (optional - just logs, API may not be available)
export const useSubmitForReview = () => {
  return useMutation({
    mutationFn: async (quizId: string) => {
      console.log("Quiz submitted for review:", quizId);

      // Try to notify API if available
      const apiUrl = import.meta.env.VITE_API_URL;
      if (!apiUrl) {
        console.log("No API URL configured, skipping review notification");
        return { success: true, message: 'Quiz created (API not configured)' };
      }

      try {
        const tg = window.Telegram?.WebApp;
        const initData = tg?.initData || '';

        const response = await fetch(`${apiUrl}/api/quizzes/submit-for-review`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `tma ${initData}`,
          },
          body: JSON.stringify({ quizId }),
        });

        if (!response.ok) {
          console.warn("Review submission failed, but quiz was created");
          return { success: true, message: 'Quiz created (notification failed)' };
        }

        return response.json();
      } catch (e) {
        console.warn("Review API error:", e);
        return { success: true, message: 'Quiz created' };
      }
    },
  });
};

// Admin: Publish or unpublish quiz
export const useModerateQuiz = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      quizId,
      action,
    }: {
      quizId: string;
      action: 'approve' | 'reject';
    }) => {
      const { data, error } = await supabase
        .from("quizzes")
        .update({
          is_published: action === 'approve',
        })
        .eq("id", quizId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
    },
  });
};

// Submit quiz result
export const useSubmitQuizResult = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (result: {
      quiz_id: string;
      score: number;
      max_score: number;
      percentile: number;
      answers: number[]
    }) => {
      // Get current user profile by telegram_id
      const { getTelegramUser } = await import("@/lib/telegram");
      const tgUser = getTelegramUser();

      if (!tgUser?.id) {
        throw new Error("Откройте приложение через Telegram");
      }

      // Find profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("telegram_id", tgUser.id)
        .maybeSingle();

      if (!profile) {
        throw new Error("Профиль не найден");
      }

      const { data, error } = await supabase
        .from("quiz_results")
        .upsert({
          quiz_id: result.quiz_id,
          user_id: profile.id,
          score: result.score,
          max_score: result.max_score,
          percentile: result.percentile,
          answers: result.answers,
          completed_at: new Date().toISOString(),
        }, {
          onConflict: "quiz_id,user_id",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
    },
  });
};

/**
 * Get IDs of quizzes the current user has completed
 */
export const useCompletedQuizIds = () => {
  return useQuery({
    queryKey: ["quizzes", "completedIds"],
    queryFn: async (): Promise<Set<string>> => {
      const { getTelegramUser } = await import("@/lib/telegram");
      const tgUser = getTelegramUser();

      if (!tgUser?.id) return new Set();

      // Find profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("telegram_id", tgUser.id)
        .maybeSingle();

      if (!profile) return new Set();

      // Get all quiz IDs that user has completed
      const { data, error } = await supabase
        .from("quiz_results")
        .select("quiz_id")
        .eq("user_id", profile.id);

      if (error) {
        console.error("Error fetching completed quiz IDs:", error);
        return new Set();
      }

      return new Set(data?.map(r => r.quiz_id) || []);
    },
  });
};

/**
 * Get current user's completed quizzes (history)
 */
export const useMyQuizResults = () => {
  return useQuery({
    queryKey: ["quizResults", "my"],
    queryFn: async () => {
      const { getTelegramUser } = await import("@/lib/telegram");
      const tgUser = getTelegramUser();

      if (!tgUser?.id) return [];

      // Find profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("telegram_id", tgUser.id)
        .maybeSingle();

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      const candidateUserIds = [...new Set([profile?.id, authUser?.id].filter(Boolean) as string[])];
      if (candidateUserIds.length === 0) return [];

      // Prefer completed_at. If the environment is on a legacy schema, fallback to created_at.
      const primaryResultsRes = await supabase
        .from("quiz_results")
        .select("id, score, max_score, percentile, completed_at, quiz_id")
        .in("user_id", candidateUserIds)
        .order("completed_at", { ascending: false });

      let rawResults: any[] = [];

      if (primaryResultsRes.error) {
        const legacyResultsRes = await supabase
          .from("quiz_results")
          .select("id, score, max_score, percentile, created_at, quiz_id")
          .in("user_id", candidateUserIds)
          .order("created_at", { ascending: false });

        if (legacyResultsRes.error) throw primaryResultsRes.error;
        rawResults = legacyResultsRes.data || [];
      } else {
        rawResults = primaryResultsRes.data || [];
      }

      const results = rawResults.map((row: any) => ({
        ...row,
        completed_at: row.completed_at || row.created_at || null,
      }));

      const quizIds = [
        ...new Set(results.map((r: any) => r.quiz_id).filter(Boolean) as string[])
      ];

      let quizzesMap = new Map<string, any>();
      if (quizIds.length > 0) {
        let quizzes: any[] = [];

        const viewWithAnon = await supabase
          .from("quizzes_public")
          .select("id, title, image_url, question_count, created_by, is_anonymous")
          .in("id", quizIds);

        if (!viewWithAnon.error && (viewWithAnon.data?.length || 0) > 0) {
          quizzes = viewWithAnon.data || [];
        } else {
          const viewLegacy = await supabase
            .from("quizzes_public")
            .select("id, title, image_url, question_count, created_by")
            .in("id", quizIds);

          if (!viewLegacy.error && (viewLegacy.data?.length || 0) > 0) {
            quizzes = (viewLegacy.data || []).map((quiz: any) => ({
              ...quiz,
              is_anonymous: false,
            }));
          } else {
            const tableWithAnon = await supabase
              .from("quizzes")
              .select("id, title, image_url, question_count, created_by, is_anonymous, is_published, status")
              .in("id", quizIds);

            if (!tableWithAnon.error && (tableWithAnon.data?.length || 0) > 0) {
              quizzes = (tableWithAnon.data || [])
                .filter((quiz: any) => quiz && (quiz.is_published !== false || quiz.status === "published"))
                .map((quiz: any) => ({
                  ...quiz,
                  is_anonymous: quiz.is_anonymous === true,
                }));
            } else {
              const tableLegacy = await supabase
                .from("quizzes")
                .select("id, title, image_url, question_count, created_by, is_published, status")
                .in("id", quizIds);

              quizzes = (tableLegacy.data || [])
                .filter((quiz: any) => quiz && (quiz.is_published !== false || quiz.status === "published"))
                .map((quiz: any) => ({
                  ...quiz,
                  is_anonymous: false,
                }));
            }
          }
        }

        const creatorIds = [
          ...new Set((quizzes || []).map((q: any) => q.created_by).filter(Boolean) as string[])
        ];
        const creatorsMap = await fetchCreatorsMap(creatorIds);

        quizzesMap = new Map(
          (quizzes || []).map((quiz: any) => [
            quiz.id,
            {
              ...quiz,
              creator: quiz.created_by ? creatorsMap[quiz.created_by] || null : null,
            }
          ])
        );
      }

      return results.map((r: any) => ({
        ...r,
        quiz: quizzesMap.get(r.quiz_id) || null,
      }));
    },
  });
};

/**
 * Update an existing quiz (for creators)
 */
export const useUpdateQuiz = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      quizId,
      updates,
      questions,
    }: {
      quizId: string;
      updates: {
        title?: string;
        description?: string;
        image_url?: string;
        duration_seconds?: number;
      };
      questions?: QuestionInput[];
    }) => {
      const { getTelegramUser } = await import("@/lib/telegram");
      const tgUser = getTelegramUser();

      if (!tgUser?.id) {
        throw new Error("Откройте приложение через Telegram");
      }

      // Verify ownership
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("telegram_id", tgUser.id)
        .maybeSingle();

      if (!profile) throw new Error("Профиль не найден");

      const { data: quiz } = await supabase
        .from("quizzes")
        .select("created_by")
        .eq("id", quizId)
        .single();

      if (!quiz || quiz.created_by !== profile.id) {
        throw new Error("Вы не можете редактировать этот квиз");
      }

      // Update quiz
      const { error: updateError } = await supabase
        .from("quizzes")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", quizId);

      if (updateError) throw updateError;

      // Update questions if provided
      if (questions && questions.length > 0) {
        // Delete old questions
        await supabase
          .from("questions")
          .delete()
          .eq("quiz_id", quizId);

        // Insert new questions
        const questionsToInsert = questions.map((q, index) => ({
          quiz_id: quizId,
          question_text: q.text,
          options: q.options.map(text => ({ text })),
          correct_answer: q.correctAnswer,
          order_index: index,
        }));

        const { error: questionsError } = await supabase
          .from("questions")
          .insert(questionsToInsert);

        if (questionsError) throw questionsError;

        // Update question count
        await supabase
          .from("quizzes")
          .update({ question_count: questions.length })
          .eq("id", quizId);
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      queryClient.invalidateQueries({ queryKey: ["quiz"] });
    },
  });
};

/**
 * Check if current user is the creator of a quiz
 */
export const useIsQuizCreator = (quizId: string | null) => {
  return useQuery({
    queryKey: ["isQuizCreator", quizId],
    queryFn: async (): Promise<boolean> => {
      if (!quizId) return false;

      const { getTelegramUser } = await import("@/lib/telegram");
      const tgUser = getTelegramUser();

      if (!tgUser?.id) return false;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("telegram_id", tgUser.id)
        .maybeSingle();

      if (!profile) return false;

      const { data: quiz } = await supabase
        .from("quizzes")
        .select("created_by")
        .eq("id", quizId)
        .single();

      return quiz?.created_by === profile.id;
    },
    enabled: !!quizId,
  });
};
