import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramUser } from "@/lib/telegram";

// Get current user's profile id
async function getProfileId(): Promise<string | null> {
  const tgUser = getTelegramUser();
  if (!tgUser?.id) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("telegram_id", tgUser.id)
    .maybeSingle();

  return data?.id || null;
}

// Track an event
export const useTrackEvent = () => {
  return useMutation({
    mutationFn: async ({ eventType, eventData = {} }: { eventType: string; eventData?: Record<string, any> }) => {
      const userId = await getProfileId();

      const { error } = await supabase
        .from("events")
        .insert({
          user_id: userId,
          event_type: eventType,
          event_data: eventData,
        });

      if (error) {
        console.error("Failed to track event:", error);
      }
    },
  });
};

// Track a share
export const useTrackShare = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contentType,
      contentId,
      shareType = 'inline'
    }: {
      contentType: 'quiz' | 'personality_test';
      contentId: string;
      shareType?: 'inline' | 'link' | 'direct';
    }) => {
      const userId = await getProfileId();

      const { error } = await supabase
        .from("shares")
        .insert({
          user_id: userId,
          content_type: contentType,
          content_id: contentId,
          share_type: shareType,
        });

      if (error) {
        console.error("Failed to track share:", error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics", "totalShares"] });
    },
  });
};

// Update last seen
export const useUpdateLastSeen = () => {
  return useMutation({
    mutationFn: async () => {
      const tgUser = getTelegramUser();
      if (!tgUser?.id) return;

      await supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("telegram_id", tgUser.id);
    },
  });
};

// Common events
export const EVENT_TYPES = {
  QUIZ_VIEWED: 'quiz_viewed',
  QUIZ_STARTED: 'quiz_started',
  QUIZ_COMPLETED: 'quiz_completed',
  TEST_VIEWED: 'test_viewed',
  TEST_STARTED: 'test_started',
  TEST_COMPLETED: 'test_completed',
  SHARE_CLICKED: 'share_clicked',
  PROFILE_VIEWED: 'profile_viewed',
  LEADERBOARD_VIEWED: 'leaderboard_viewed',
} as const;
