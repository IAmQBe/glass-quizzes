import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramUser, getTelegram } from "@/lib/telegram";

export interface Profile {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  has_telegram_premium: boolean;
  referral_code: string | null;
  onboarding_completed: boolean;
  challenge_notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get Telegram user data
 */
function getTelegramData() {
  const tgUser = getTelegramUser();

  if (!tgUser) return null;

  return {
    telegram_id: tgUser.id,
    username: tgUser.username || null,
    first_name: tgUser.first_name,
    last_name: tgUser.last_name || null,
    avatar_url: tgUser.photo_url || null,
    has_telegram_premium: tgUser.is_premium || false,
  };
}

/**
 * Get start_param for referral tracking
 */
function getStartParam(): string | null {
  const tg = getTelegram();
  return tg?.initDataUnsafe?.start_param || null;
}

/**
 * Hook to get current user's profile
 */
export const useCurrentProfile = () => {
  return useQuery({
    queryKey: ["currentProfile"],
    queryFn: async (): Promise<Profile | null> => {
      const tgData = getTelegramData();
      if (!tgData?.telegram_id) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("telegram_id", tgData.telegram_id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        return null;
      }

      return data as Profile | null;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook to ensure profile exists and is up-to-date
 * Uses upsert for atomic create-or-update
 */
export const useEnsureProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<Profile | null> => {
      const tgData = getTelegramData();

      if (!tgData?.telegram_id) {
        console.log("No Telegram user, skipping profile init");
        return null;
      }

      console.log("Ensuring profile for telegram_id:", tgData.telegram_id);

      // First try to get existing profile
      const { data: existing, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("telegram_id", tgData.telegram_id)
        .maybeSingle();

      if (fetchError) {
        console.warn("Error fetching profile (may be RLS):", fetchError.message);
      }

      // If profile exists, try to update it
      if (existing) {
        console.log("Profile exists:", existing.id);

        const { data: updated, error: updateError } = await supabase
          .from("profiles")
          .update({
            username: tgData.username,
            first_name: tgData.first_name,
            last_name: tgData.last_name,
            avatar_url: tgData.avatar_url,
            has_telegram_premium: tgData.has_telegram_premium,
          })
          .eq("telegram_id", tgData.telegram_id)
          .select()
          .single();

        if (updateError) {
          console.warn("Could not update profile (RLS?):", updateError.message);
          return existing as Profile;
        }

        console.log("Profile updated");
        return updated as Profile;
      }

      // Profile doesn't exist - try upsert (works better with RLS)
      console.log("Creating new profile...");
      const newId = crypto.randomUUID();

      const { data: created, error: createError } = await supabase
        .from("profiles")
        .upsert({
          id: newId,
          telegram_id: tgData.telegram_id,
          username: tgData.username,
          first_name: tgData.first_name,
          last_name: tgData.last_name,
          avatar_url: tgData.avatar_url,
          has_telegram_premium: tgData.has_telegram_premium,
        }, {
          onConflict: 'telegram_id',
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating profile:", createError.message);
        console.error("Error code:", createError.code);
        console.error("Error details:", createError.details);
        console.error("Error hint:", createError.hint);
        // Don't throw - allow app to work without profile
        return null;
      }

      console.log("Profile created:", created.id);
      return created as Profile;
    },
    onSuccess: (profile) => {
      if (profile) {
        queryClient.setQueryData(["currentProfile"], profile);
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      }
    },
    onError: (error) => {
      // Log but don't crash - app should work even without profile
      console.error("Profile mutation error:", error);
    },
  });
};

/**
 * Hook to update profile settings
 */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<Profile>): Promise<Profile> => {
      const tgData = getTelegramData();

      if (!tgData?.telegram_id) {
        throw new Error("Откройте приложение через Telegram");
      }

      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("telegram_id", tgData.telegram_id)
        .select()
        .single();

      if (error) {
        console.error("Error updating profile:", error);
        throw new Error("Не удалось обновить профиль");
      }

      return data as Profile;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(["currentProfile"], profile);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};

/**
 * Generate a unique referral code for the user
 */
export const useGenerateReferralCode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<string> => {
      const tgData = getTelegramData();

      if (!tgData?.telegram_id) {
        throw new Error("Откройте приложение через Telegram");
      }

      // Generate unique code
      const code = `${tgData.telegram_id}_${Date.now().toString(36)}`;

      const { error } = await supabase
        .from("profiles")
        .update({ referral_code: code })
        .eq("telegram_id", tgData.telegram_id);

      if (error) {
        throw new Error("Не удалось создать реферальный код");
      }

      return code;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentProfile"] });
    },
  });
};
