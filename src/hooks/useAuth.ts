import { useQuery } from "@tanstack/react-query";
import { getTelegramUser } from "@/lib/telegram";

// Admin IDs from env
const ADMIN_TELEGRAM_IDS = (import.meta.env.VITE_ADMIN_TELEGRAM_IDS || "")
  .split(",")
  .map((id: string) => parseInt(id.trim(), 10))
  .filter((id: number) => !isNaN(id));

export const useIsAdmin = () => {
  return useQuery({
    queryKey: ["isAdmin"],
    queryFn: async (): Promise<boolean> => {
      const tgUser = getTelegramUser();
      if (!tgUser) return false;

      // Check if Telegram user ID is in admin list
      return ADMIN_TELEGRAM_IDS.includes(tgUser.id);
    },
    staleTime: Infinity, // Admin status doesn't change
  });
};

export const useUserRole = () => {
  return useQuery({
    queryKey: ["userRole"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error fetching user role:", error);
        return "user";
      }

      return data?.role || "user";
    },
  });
};