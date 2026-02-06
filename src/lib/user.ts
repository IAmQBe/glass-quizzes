// User management for Telegram Mini App
// Since we don't use Supabase Auth, we manage users via telegram_id

import { supabase } from "@/integrations/supabase/client";
import { getTelegramUser } from "@/lib/telegram";

// Get or create user profile by Telegram ID
export const getOrCreateUser = async () => {
  const tgUser = getTelegramUser();
  if (!tgUser) {
    throw new Error("Not in Telegram environment");
  }

  // Try to find existing profile
  const { data: existingProfile, error: findError } = await supabase
    .from("profiles")
    .select("*")
    .eq("telegram_id", tgUser.id)
    .maybeSingle();

  if (existingProfile) {
    return existingProfile;
  }

  // Create new profile
  // First create auth user (anonymous) to satisfy foreign key
  const { data: authData, error: authError } = await supabase.auth.signInAnonymously();

  if (authError) {
    console.error("Auth error:", authError);
    throw new Error("Failed to create user session");
  }

  const userId = authData.user?.id;
  if (!userId) {
    throw new Error("No user ID from auth");
  }

  // Update profile with Telegram data
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      telegram_id: tgUser.id,
      username: tgUser.username,
      first_name: tgUser.first_name,
      last_name: tgUser.last_name,
      avatar_url: tgUser.photo_url,
    })
    .select()
    .single();

  if (profileError) {
    console.error("Profile error:", profileError);
    throw new Error("Failed to create profile");
  }

  return profile;
};

// Get current user ID (auth user id, not telegram id)
export const getCurrentUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return user.id;
  }

  // Try to get or create user
  try {
    const profile = await getOrCreateUser();
    return profile.id;
  } catch {
    return null;
  }
};

// Check if current user is admin (by Telegram ID)
export const isCurrentUserAdmin = (): boolean => {
  const tgUser = getTelegramUser();
  if (!tgUser) return false;

  // Admin IDs from env (comma-separated)
  const adminIds = (import.meta.env.VITE_ADMIN_TELEGRAM_IDS || "").split(",").map(Number);
  return adminIds.includes(tgUser.id);
};

// Initialize user on app start
export const initUser = async () => {
  try {
    // Check if we have an existing session
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      // Ensure profile exists/updated for Telegram user.
      await getOrCreateUser();

      // Some legacy flows can return from getOrCreateUser without creating an auth session.
      const { data: { session: afterProfileSession } } = await supabase.auth.getSession();
      if (!afterProfileSession) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.error("Anonymous sign-in fallback failed:", error);
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error("User init error:", error);
    return false;
  }
};
