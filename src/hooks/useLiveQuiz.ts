import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface LiveQuiz {
  id: string;
  quiz_id: string;
  host_user_id: string;
  status: "waiting" | "active" | "finished";
  current_question: number;
  started_at: string | null;
  finished_at: string | null;
  max_participants: number;
  is_paid: boolean;
  price_stars: number;
  created_at: string;
}

export interface LiveQuizParticipant {
  id: string;
  live_quiz_id: string;
  user_id: string;
  score: number;
  correct_answers: number;
  total_time_ms: number;
  joined_at: string;
}

export interface LiveQuizReaction {
  id: string;
  live_quiz_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

// Fetch active live quizzes
export const useActiveLiveQuizzes = () => {
  return useQuery({
    queryKey: ["live_quizzes", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_quizzes")
        .select("*, quizzes(*)")
        .in("status", ["waiting", "active"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
};

// Fetch a specific live quiz with participants
export const useLiveQuiz = (liveQuizId: string | null) => {
  return useQuery({
    queryKey: ["live_quiz", liveQuizId],
    queryFn: async () => {
      if (!liveQuizId) return null;

      const { data: liveQuiz, error: liveQuizError } = await supabase
        .from("live_quizzes")
        .select("*, quizzes(*)")
        .eq("id", liveQuizId)
        .single();
      if (liveQuizError) throw liveQuizError;

      const { data: participants, error: participantsError } = await supabase
        .from("live_quiz_participants")
        .select("*, profiles(*)")
        .eq("live_quiz_id", liveQuizId)
        .order("score", { ascending: false });
      if (participantsError) throw participantsError;

      return { liveQuiz, participants: participants || [] };
    },
    enabled: !!liveQuizId,
    refetchInterval: 2000, // Poll every 2 seconds
  });
};

// Subscribe to live quiz updates
export const useLiveQuizRealtime = (liveQuizId: string | null, onUpdate: () => void) => {
  useEffect(() => {
    if (!liveQuizId) return;

    const channel = supabase
      .channel(`live_quiz_${liveQuizId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_quizzes',
          filter: `id=eq.${liveQuizId}`,
        },
        onUpdate
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_quiz_participants',
          filter: `live_quiz_id=eq.${liveQuizId}`,
        },
        onUpdate
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_quiz_reactions',
          filter: `live_quiz_id=eq.${liveQuizId}`,
        },
        onUpdate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveQuizId, onUpdate]);
};

// Subscribe to reactions
export const useLiveQuizReactions = (
  liveQuizId: string | null,
  onReaction: (reaction: LiveQuizReaction) => void
) => {
  useEffect(() => {
    if (!liveQuizId) return;

    const channel = supabase
      .channel(`live_quiz_reactions_${liveQuizId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_quiz_reactions',
          filter: `live_quiz_id=eq.${liveQuizId}`,
        },
        (payload) => {
          onReaction(payload.new as LiveQuizReaction);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveQuizId, onReaction]);
};

// Create a live quiz
export const useCreateLiveQuiz = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { quiz_id: string; is_paid?: boolean; price_stars?: number; max_participants?: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("live_quizzes")
        .insert({
          quiz_id: params.quiz_id,
          host_user_id: user.id,
          is_paid: params.is_paid ?? false,
          price_stars: params.price_stars ?? 0,
          max_participants: params.max_participants ?? 100,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live_quizzes"] });
    },
  });
};

// Join a live quiz
export const useJoinLiveQuiz = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (liveQuizId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("live_quiz_participants")
        .insert({
          live_quiz_id: liveQuizId,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, liveQuizId) => {
      queryClient.invalidateQueries({ queryKey: ["live_quiz", liveQuizId] });
    },
  });
};

// Start a live quiz (host only)
export const useStartLiveQuiz = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (liveQuizId: string) => {
      const { error } = await supabase
        .from("live_quizzes")
        .update({ status: "active", started_at: new Date().toISOString() })
        .eq("id", liveQuizId);

      if (error) throw error;
    },
    onSuccess: (_, liveQuizId) => {
      queryClient.invalidateQueries({ queryKey: ["live_quiz", liveQuizId] });
    },
  });
};

// Submit an answer
export const useSubmitLiveAnswer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      live_quiz_id: string;
      question_index: number;
      answer_index: number;
      is_correct: boolean;
      time_ms: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Insert answer
      const { error: answerError } = await supabase
        .from("live_quiz_answers")
        .insert({
          live_quiz_id: params.live_quiz_id,
          user_id: user.id,
          question_index: params.question_index,
          answer_index: params.answer_index,
          is_correct: params.is_correct,
          time_ms: params.time_ms,
        });

      if (answerError) throw answerError;

      // Update participant score
      if (params.is_correct) {
        const points = Math.max(100, 1000 - params.time_ms); // Faster = more points
        
        // Fetch current participant data
        const { data: participant } = await supabase
          .from("live_quiz_participants")
          .select("*")
          .eq("live_quiz_id", params.live_quiz_id)
          .eq("user_id", user.id)
          .single();

        if (participant) {
          const { error: updateError } = await supabase
            .from("live_quiz_participants")
            .update({
              score: participant.score + points,
              correct_answers: participant.correct_answers + 1,
              total_time_ms: participant.total_time_ms + params.time_ms,
            })
            .eq("id", participant.id);

          if (updateError) throw updateError;
        }
      }
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ["live_quiz", params.live_quiz_id] });
    },
  });
};

// Send reaction
export const useSendReaction = () => {
  return useMutation({
    mutationFn: async (params: { live_quiz_id: string; emoji: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("live_quiz_reactions")
        .insert({
          live_quiz_id: params.live_quiz_id,
          user_id: user.id,
          emoji: params.emoji,
        });

      if (error) throw error;
    },
  });
};

// Advance to next question (host only)
export const useNextQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (liveQuizId: string) => {
      const { data: liveQuiz } = await supabase
        .from("live_quizzes")
        .select("current_question")
        .eq("id", liveQuizId)
        .single();

      if (!liveQuiz) throw new Error("Live quiz not found");

      const { error } = await supabase
        .from("live_quizzes")
        .update({ current_question: liveQuiz.current_question + 1 })
        .eq("id", liveQuizId);

      if (error) throw error;
    },
    onSuccess: (_, liveQuizId) => {
      queryClient.invalidateQueries({ queryKey: ["live_quiz", liveQuizId] });
    },
  });
};

// End live quiz (host only)
export const useEndLiveQuiz = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (liveQuizId: string) => {
      const { error } = await supabase
        .from("live_quizzes")
        .update({ status: "finished", finished_at: new Date().toISOString() })
        .eq("id", liveQuizId);

      if (error) throw error;
    },
    onSuccess: (_, liveQuizId) => {
      queryClient.invalidateQueries({ queryKey: ["live_quiz", liveQuizId] });
      queryClient.invalidateQueries({ queryKey: ["live_quizzes"] });
    },
  });
};
