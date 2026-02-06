import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRolePreview } from "@/hooks/useRolePreview";
import { getTelegramUser } from "@/lib/telegram";

interface AuthHookOptions {
  respectRolePreview?: boolean;
}

const getAdminTelegramIds = (): number[] => {
  const raw = import.meta.env.VITE_ADMIN_TELEGRAM_IDS as string | undefined;
  if (!raw) return [];

  return raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
};

const isTelegramUserInAdminAllowlist = (): boolean => {
  const tgUser = getTelegramUser();
  if (!tgUser?.id) return false;
  return getAdminTelegramIds().includes(tgUser.id);
};

export const useIsAdmin = ({ respectRolePreview = true }: AuthHookOptions = {}) => {
  const { forcedRole } = useRolePreview();
  const roleOverride = respectRolePreview ? forcedRole : null;

  return useQuery({
    queryKey: ["isAdmin", roleOverride],
    queryFn: async (): Promise<boolean> => {
      if (roleOverride === "admin") return true;
      if (roleOverride === "user") return false;

      if (isTelegramUserInAdminAllowlist()) {
        return true;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase.rpc("is_admin", {
        check_user_id: user.id,
      });

      if (error) {
        console.error("Error checking admin role:", error);
        return isTelegramUserInAdminAllowlist();
      }

      return Boolean(data);
    },
    staleTime: 60_000,
  });
};

export const useUserRole = ({ respectRolePreview = true }: AuthHookOptions = {}) => {
  const { forcedRole } = useRolePreview();
  const roleOverride = respectRolePreview ? forcedRole : null;

  return useQuery({
    queryKey: ["userRole", roleOverride],
    queryFn: async (): Promise<"admin" | "user" | null> => {
      if (roleOverride === "admin") return "admin";
      if (roleOverride === "user") return "user";

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
