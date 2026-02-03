import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type QuizStatus = 'draft' | 'pending' | 'published' | 'rejected';

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
  status: QuizStatus;
  rejection_reason: string | null;
  submitted_at: string | null;
  moderated_by: string | null;
  moderated_at: string | null;
  created_at: string;
  rating: number;
  rating_count: number;
  like_count: number;
  save_count: number;
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

export const usePublishedQuizzes = () => {
  return useQuery({
    queryKey: ["quizzes", "published"],
    queryFn: async (): Promise<Quiz[]> => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("*")
        .or("is_published.eq.true,status.eq.published")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Quiz[];
    },
  });
};

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

export const useMyQuizzes = () => {
  return useQuery({
    queryKey: ["quizzes", "my"],
    queryFn: async (): Promise<Quiz[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("quizzes")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};

interface QuestionInput {
  text: string;
  options: string[];
  correctAnswer: number;
}

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create quiz with status='pending' for moderation
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .insert({
          title: quiz.title,
          description: quiz.description,
          image_url: quiz.image_url,
          duration_seconds: quiz.duration_seconds || 60,
          created_by: user.id,
          question_count: quiz.questions?.length || 0,
          status: 'pending',
          submitted_at: new Date().toISOString(),
          is_published: false,
        })
        .select()
        .single();

      if (quizError) throw quizError;

      // Create questions if provided
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
          throw questionsError;
        }
      }

      return quizData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
    },
  });
};

// Submit quiz for review (notify admins via API)
export const useSubmitForReview = () => {
  return useMutation({
    mutationFn: async (quizId: string) => {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      
      // Get initData for auth
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
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to submit for review');
      }

      return response.json();
    },
  });
};

// Admin: Approve/Reject quiz
export const useModerateQuiz = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      quizId, 
      action, 
      rejectionReason 
    }: { 
      quizId: string; 
      action: 'approve' | 'reject'; 
      rejectionReason?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const updates: Record<string, unknown> = {
        status: action === 'approve' ? 'published' : 'rejected',
        is_published: action === 'approve',
        moderated_by: user.id,
        moderated_at: new Date().toISOString(),
      };

      if (action === 'reject' && rejectionReason) {
        updates.rejection_reason = rejectionReason;
      }

      const { data, error } = await supabase
        .from("quizzes")
        .update(updates)
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

// Get quizzes pending moderation (for admin)
export const usePendingQuizzes = () => {
  return useQuery({
    queryKey: ["quizzes", "pending"],
    queryFn: async (): Promise<Quiz[]> => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("*")
        .eq("status", "pending")
        .order("submitted_at", { ascending: true });

      if (error) throw error;
      return (data || []) as Quiz[];
    },
  });
};

export const useSubmitQuizResult = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (result: { quiz_id: string; score: number; max_score: number; percentile: number; answers: number[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("quiz_results")
        .insert({
          quiz_id: result.quiz_id,
          user_id: user.id,
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