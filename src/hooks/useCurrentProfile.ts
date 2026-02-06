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
 * Parse referrer telegram_id from start_param
 * Supports multiple formats:
 * - ..._ref_<telegram_id>_... (legacy)
 * - ..._ref<telegram_id>_... (new compact)
 * - ...:<telegram_id> (inline share)
 */
function getReferrerTelegramId(): number | null {
  const startParam = getStartParam();
  if (!startParam) return null;

  // Format: ref_123456 or ref123456
  const refMatch = startParam.match(/ref_?(\d+)/);
  if (refMatch) {
    return parseInt(refMatch[1], 10);
  }

  // Format from inline: test_result:testId:title:123456 (last part is userId)
  const parts = startParam.split(/[_:]/);
  const lastPart = parts[parts.length - 1];
  if (lastPart && /^\d+$/.test(lastPart) && lastPart.length >= 5) {
    return parseInt(lastPart, 10);
  }

  return null;
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

      const { data: authUserData, error: authUserError } = await supabase.auth.getUser();
      if (authUserError) {
        console.warn("Error fetching auth user:", authUserError.message);
      }

      let authUserId = authUserData.user?.id || null;
      if (!authUserId) {
        const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) {
          console.error("Anonymous auth failed during profile init:", signInError.message);
          return null;
        }
        authUserId = signInData.user?.id || null;
      }

      if (!authUserId) {
        console.error("No auth user id available for profile initialization");
        return null;
      }

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

      const { data: created, error: createError } = await supabase
        .from("profiles")
        .upsert({
          id: authUserId,
          telegram_id: tgData.telegram_id,
          username: tgData.username,
          first_name: tgData.first_name,
          last_name: tgData.last_name,
          avatar_url: tgData.avatar_url,
          has_telegram_premium: tgData.has_telegram_premium,
        }, {
          onConflict: 'id',
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating profile:", createError.message);
        console.error("Error code:", createError.code);
        console.error("Error details:", createError.details);
        console.error("Error hint:", createError.hint);

        const { data: fallbackProfile, error: fallbackError } = await supabase
          .from("profiles")
          .select("*")
          .eq("telegram_id", tgData.telegram_id)
          .maybeSingle();

        if (fallbackError) {
          console.error("Fallback profile lookup failed:", fallbackError.message);
        }

        // Don't throw - allow app to work without profile
        return (fallbackProfile as Profile | null) || null;
      }

      console.log("Profile created:", created.id);

      // Track referral if this is a new user from a share link
      const referrerTelegramId = getReferrerTelegramId();
      if (referrerTelegramId && referrerTelegramId !== tgData.telegram_id) {
        console.log("Referrer telegram_id:", referrerTelegramId);

        // Find referrer's profile by telegram_id
        const { data: referrer } = await supabase
          .from("profiles")
          .select("id")
          .eq("telegram_id", referrerTelegramId)
          .maybeSingle();

        if (referrer) {
          // Check if referral already exists (shouldn't due to UNIQUE constraint, but be safe)
          const { data: existingReferral } = await supabase
            .from("referrals")
            .select("id")
            .eq("referred_id", created.id)
            .maybeSingle();

          if (!existingReferral) {
            const { error: referralError } = await supabase
              .from("referrals")
              .insert({
                referrer_id: referrer.id,
                referred_id: created.id,
              });

            if (referralError) {
              console.warn("Could not create referral:", referralError.message);
            } else {
              console.log("Referral recorded! Referrer:", referrer.id);
            }
          }
        } else {
          console.log("Referrer not found for telegram_id:", referrerTelegramId);
        }
      }

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
