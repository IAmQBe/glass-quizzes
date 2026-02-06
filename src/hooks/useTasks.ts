import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getTelegram, getTelegramUser } from "@/lib/telegram";

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

const getApiUrl = () => {
  const url = import.meta.env.VITE_API_URL as string | undefined;
  return url?.replace(/\/+$/, "") || null;
};

const getInitDataAuthHeader = () => {
  const initData = getTelegram()?.initData;
  if (!initData) return null;
  return `tma ${initData}`;
};

const getProfileId = async (): Promise<string | null> => {
  const tgUser = getTelegramUser();
  if (!tgUser?.id) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("telegram_id", tgUser.id)
    .maybeSingle();

  if (error) {
    console.error("Error resolving profile id for tasks:", error);
    return null;
  }

  return data?.id || null;
};

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
      const apiUrl = getApiUrl();
      const authHeader = getInitDataAuthHeader();

      if (apiUrl && authHeader) {
        try {
          const response = await fetch(`${apiUrl}/api/tasks/completed`, {
            headers: {
              Authorization: authHeader,
            },
          });

          if (response.ok) {
            const payload = await response.json() as { taskIds?: unknown };
            if (Array.isArray(payload.taskIds)) {
              return new Set(
                payload.taskIds.filter((taskId): taskId is string => typeof taskId === "string")
              );
            }
            return new Set<string>();
          }
        } catch (error) {
          console.warn("Tasks API fetch failed, falling back to direct query:", error);
        }
      }

      const profileId = await getProfileId();
      if (!profileId) return new Set<string>();

      const { data, error } = await supabase
        .from("user_tasks")
        .select("task_id")
        .eq("user_id", profileId);

      if (error) {
        console.error("Error fetching completed tasks directly:", error);
        return new Set<string>();
      }
      return new Set((data || []).map((task) => task.task_id));
    },
  });
};

// Complete a task
export const useCompleteTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const apiUrl = getApiUrl();
      const authHeader = getInitDataAuthHeader();

      if (apiUrl && authHeader) {
        try {
          const response = await fetch(`${apiUrl}/api/tasks/complete`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader,
            },
            body: JSON.stringify({ taskId }),
          });

          if (response.ok) {
            const payload = await response.json() as { alreadyCompleted?: boolean };
            return { alreadyCompleted: Boolean(payload.alreadyCompleted) };
          }

          const payload = await response.json().catch(() => ({ error: "Task verification failed" })) as { error?: string };
          const message = payload.error || "Task verification failed";
          const canFallbackToDirectInsert =
            response.status === 401 ||
            /not authenticated|invalid initdata|authorization/i.test(message);

          if (!canFallbackToDirectInsert) {
            throw new Error(message);
          }

          console.warn("Tasks API auth failed, trying direct completion fallback:", message);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const isNetworkLikeError = /network|failed to fetch|load failed/i.test(message);
          if (!isNetworkLikeError) {
            throw error;
          }
          console.warn("Tasks API network failed, trying direct completion fallback:", message);
        }
      }

      const profileId = await getProfileId();
      if (!profileId) throw new Error("Профиль не найден");

      const { error } = await supabase
        .from("user_tasks")
        .insert({ user_id: profileId, task_id: taskId });

      if (error) {
        if (error.code === "23505") {
          return { alreadyCompleted: true };
        }
        throw error;
      }

      return { alreadyCompleted: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["completedTasks"] });
      toast({
        title: result.alreadyCompleted ? "Уже выполнено" : "Задание выполнено! 🎉",
        description: result.alreadyCompleted ? "Это задание уже засчитано" : undefined,
      });
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
