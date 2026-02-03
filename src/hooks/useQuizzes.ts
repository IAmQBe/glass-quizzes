import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  } | null;
}

// Quiz interface matching actual Supabase schema
export interface Quiz {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  created_by: string;
  question_count: number;
  participant_count: number;
  duration_seconds: number;
  is_published: boolean;
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
      const { data, error } = await supabase
        .from("quizzes")
        .select(`
          *,
          creator:profiles (
            id,
            first_name,
            username,
            avatar_url,
            squad:squads (
              id,
              title,
              username
            )
          )
        `)
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Quiz[];
    },
  });
};

// Get quiz with questions
export const useQuizWithQuestions = (quizId: string | null) => {
  return useQuery({
    queryKey: ["quiz", quizId],
    queryFn: async () => {
      if (!quizId) return null;

      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", quizId)
        .single();

      if (quizError) throw quizError;

      const { data: questions, error: questionsError } = await supabase
        .from("questions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("order_index", { ascending: true });

      if (questionsError) throw questionsError;

      return {
        quiz,
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
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .insert({
          title: quiz.title,
          description: quiz.description || null,
          image_url: quiz.image_url || null,
          duration_seconds: quiz.duration_seconds || 60,
          question_count: quiz.questions?.length || 0,
          is_published: false, // Not published until admin approves
          created_by: profileId,
        })
        .select()
        .single();

      if (quizError) {
        console.error("Quiz creation error:", quizError);
        throw new Error(`Ошибка создания квиза: ${quizError.message}`);
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
        .insert({
          quiz_id: result.quiz_id,
          user_id: profile.id,
          score: result.score,
          max_score: result.max_score,
          percentile: result.percentile,
          answers: result.answers,
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

      if (!profile) return [];

      // Get quiz results with quiz info
      const { data, error } = await supabase
        .from("quiz_results")
        .select(`
          id,
          score,
          max_score,
          percentile,
          created_at,
          quiz:quizzes (
            id,
            title,
            image_url,
            question_count
          )
        `)
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
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
