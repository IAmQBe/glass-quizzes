import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getTelegramUser } from "@/lib/telegram";

interface Profile {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  referral_code: string | null;
  challenge_notifications_enabled: boolean;
  has_telegram_premium: boolean | null;
}

async function getProfileIdByTelegramId(): Promise<string | null> {
  const tgUser = getTelegramUser();
  if (!tgUser?.id) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("telegram_id", tgUser.id)
    .maybeSingle();

  return data?.id || null;
}

export const useProfile = () => {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const tgUser = getTelegramUser();
      if (!tgUser?.id) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("telegram_id", tgUser.id)
        .maybeSingle();

      if (error) throw error;
      return (data as Profile) || null;
    },
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      const tgUser = getTelegramUser();
      if (!tgUser?.id) throw new Error("Откройте приложение через Telegram");

      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("telegram_id", tgUser.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });
};

export const useReferralCount = () => {
  return useQuery({
    queryKey: ["referralCount"],
    queryFn: async () => {
      const profileId = await getProfileIdByTelegramId();
      if (!profileId) return 0;

      const { count, error } = await supabase
        .from("referrals")
        .select("*", { count: "exact", head: true })
        .eq("referrer_id", profileId);

      if (error) throw error;
      return count ?? 0;
    },
  });
};
