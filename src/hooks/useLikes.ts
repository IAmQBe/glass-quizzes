import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { haptic } from "@/lib/telegram";

export const useLikeIds = () => {
  return useQuery({
    queryKey: ["likes"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return new Set<string>();

      const { data, error } = await supabase
        .from("quiz_likes")
        .select("quiz_id")
        .eq("user_id", user.id);

      if (error) throw error;
      return new Set(data?.map(l => l.quiz_id) || []);
    },
  });
};

export const useToggleLike = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ quizId, isLiked }: { quizId: string; isLiked: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (isLiked) {
        const { error } = await supabase
          .from("quiz_likes")
          .delete()
          .eq("quiz_id", quizId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("quiz_likes")
          .insert({ quiz_id: quizId, user_id: user.id });
        if (error) throw error;
      }
    },
    onMutate: async ({ quizId, isLiked }) => {
      haptic.impact('light');
      
      await queryClient.cancelQueries({ queryKey: ["likes"] });
      const previousLikes = queryClient.getQueryData<Set<string>>(["likes"]);

      queryClient.setQueryData<Set<string>>(["likes"], (old) => {
        const newSet = new Set(old);
        if (isLiked) {
          newSet.delete(quizId);
        } else {
          newSet.add(quizId);
        }
        return newSet;
      });

      return { previousLikes };
    },
    onError: (err, variables, context) => {
      if (context?.previousLikes) {
        queryClient.setQueryData(["likes"], context.previousLikes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["likes"] });
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
    },
  });
};
