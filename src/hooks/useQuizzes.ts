import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
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

export const useCreateQuiz = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quiz: { title: string; description?: string; image_url?: string; duration_seconds?: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("quizzes")
        .insert({
          title: quiz.title,
          description: quiz.description,
          image_url: quiz.image_url,
          duration_seconds: quiz.duration_seconds || 60,
          created_by: user.id,
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