import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Task {
  id: string;
  title: string;
  description: string | null;
  reward_type: string;
  reward_amount: number;
  task_type: string;
  action_url: string | null;
  icon: string;
  is_active: boolean;
  display_order: number;
}

// Fetch active tasks
export const useTasks = () => {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as Task[];
    },
  });
};

// Fetch all tasks (for admin)
export const useAllTasks = () => {
  return useQuery({
    queryKey: ["allTasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as Task[];
    },
  });
};

// Fetch user's completed tasks
export const useCompletedTasks = () => {
  return useQuery({
    queryKey: ["completedTasks"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return new Set<string>();

      const { data, error } = await supabase
        .from("user_tasks")
        .select("task_id")
        .eq("user_id", user.id);

      if (error) throw error;
      return new Set(data.map(t => t.task_id));
    },
  });
};

// Complete a task
export const useCompleteTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("user_tasks")
        .insert({ user_id: user.id, task_id: taskId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["completedTasks"] });
      toast({ title: "Задание выполнено! 🎉" });
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast({ title: "Уже выполнено", description: "Вы уже выполнили это задание" });
      } else {
        toast({ title: "Ошибка", description: error.message, variant: "destructive" });
      }
    },
  });
};

// Admin: Create task
export const useCreateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: Omit<Task, "id">) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert(task)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
      toast({ title: "Задание создано!" });
    },
  });
};

// Admin: Update task
export const useUpdateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Task> & { id: string }) => {
      const { data, error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
};

// Admin: Delete task
export const useDeleteTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
      toast({ title: "Задание удалено" });
    },
  });
};
