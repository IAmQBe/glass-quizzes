import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramUser } from "@/lib/telegram";

const profileIdCacheByTelegramId = new Map<number, string | null>();
const profileIdPromiseByTelegramId = new Map<number, Promise<string | null>>();

// Event types for type safety
export type EventType =
  // App lifecycle
  | "app_open"
  | "app_close"
  // Quiz funnel
  | "quiz_view"
  | "quiz_start"
  | "quiz_answer"
  | "quiz_complete"
  | "quiz_abandon"
  | "quiz_share"
  // Personality tests funnel
  | "test_view"
  | "test_start"
  | "test_complete"
  | "test_share"
  // Predictions and tasks
  | "prediction_create"
  | "prediction_report"
  | "task_complete"
  // Engagement
  | "quiz_like"
  | "quiz_unlike"
  | "quiz_favorite"
  | "quiz_unfavorite"
  // Social
  | "challenge_send"
  | "challenge_accept"
  | "challenge_complete"
  // Navigation
  | "screen_view"
  | "profile_view"
  | "leaderboard_view"
  | "deep_link_open"
  // Creation
  | "quiz_create_start"
  | "quiz_create_complete"
  // Other
  | "search"
  | "error";

// Event data types
export interface QuizEventData {
  quiz_id?: string;
  quiz_title?: string;
  question_index?: number;
  answer_index?: number;
  is_correct?: boolean;
  time_ms?: number;
  time_total_ms?: number;
  score?: number;
  max_score?: number;
  percentile?: number;
  share_type?: "inline" | "link" | "story";
  reason?: string;
}

export interface TestEventData {
  test_id?: string;
  result_id?: string;
  test_title?: string;
  share_type?: "inline" | "link" | "story";
}

export interface PredictionEventData {
  poll_id?: string;
  next_status?: string | null;
  transitioned_to_under_review?: boolean;
  reason?: string | null;
}

export interface TaskEventData {
  task_id?: string;
  task_type?: string | null;
}

export interface DeepLinkEventData {
  start_param?: string;
  deep_link_type?: string;
  source?: string;
  content_id?: string;
}

export interface ScreenEventData {
  screen_name?: string;
  previous_screen?: string | null;
}

export interface SearchEventData {
  query?: string;
  results_count?: number;
}

export interface ErrorEventData {
  error_type?: string;
  error_message?: string;
  component?: string;
}

export type EventData =
  | QuizEventData
  | TestEventData
  | PredictionEventData
  | TaskEventData
  | DeepLinkEventData
  | ScreenEventData
  | SearchEventData
  | ErrorEventData
  | Record<string, unknown>;

interface TrackEventOptions {
  // Don't send to PostHog (for sensitive events)
  skipExternal?: boolean;
  // Profile ID if already known
  profileId?: string | null;
}

const resolveProfileIdByTelegramId = async (telegramId: number): Promise<string | null> => {
  if (profileIdCacheByTelegramId.has(telegramId)) {
    return profileIdCacheByTelegramId.get(telegramId) ?? null;
  }

  const inFlight = profileIdPromiseByTelegramId.get(telegramId);
  if (inFlight) return inFlight;

  const promise = (async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (error) {
      console.error("Failed to resolve profile id for tracking:", error);
      profileIdCacheByTelegramId.set(telegramId, null);
      return null;
    }

    const profileId = data?.id || null;
    profileIdCacheByTelegramId.set(telegramId, profileId);
    return profileId;
  })();

  profileIdPromiseByTelegramId.set(telegramId, promise);
  try {
    return await promise;
  } finally {
    profileIdPromiseByTelegramId.delete(telegramId);
  }
};

/**
 * Hook for tracking user events
 * Stores events in Supabase and optionally sends to PostHog
 */
export const useTrackEvent = () => {
  // Generate session ID once per hook instance
  const sessionId = useRef(crypto.randomUUID());

  // Track last screen for navigation events
  const lastScreen = useRef<string | null>(null);
  const profileIdRef = useRef<string | null | undefined>(undefined);

  const resolveProfileId = useCallback(
    async (telegramId: number, explicitProfileId?: string | null) => {
      if (explicitProfileId) {
        profileIdRef.current = explicitProfileId;
        return explicitProfileId;
      }

      if (profileIdRef.current !== undefined) {
        return profileIdRef.current;
      }

      const resolved = await resolveProfileIdByTelegramId(telegramId);
      profileIdRef.current = resolved;
      return resolved;
    },
    []
  );

  /**
   * Track an event
   */
  const track = useCallback(
    async (
      eventType: EventType,
      eventData?: EventData,
      quizId?: string,
      options?: TrackEventOptions
    ) => {
      const tgUser = getTelegramUser();

      // Must have telegram user
      if (!tgUser?.id) {
        console.warn("Cannot track event: no Telegram user");
        return;
      }

      const profileId = await resolveProfileId(tgUser.id, options?.profileId);

      const payload = {
        telegram_id: tgUser.id,
        user_id: profileId,
        event_type: eventType,
        event_data: eventData || {},
        quiz_id: quizId || null,
        session_id: sessionId.current,
      };

      try {
        // 1. Save to Supabase
        const { error } = await supabase.from("user_events").insert(payload);

        if (error) {
          console.error("Failed to track event:", error);
        }

        // 2. Send to PostHog if available and not skipped
        if (!options?.skipExternal && typeof window !== "undefined" && (window as any).posthog) {
          (window as any).posthog.capture(eventType, {
            ...eventData,
            quiz_id: quizId,
            session_id: sessionId.current,
            telegram_id: tgUser.id,
            user_id: profileId,
          });
        }
      } catch (e) {
        console.error("Error tracking event:", e);
      }
    },
    [resolveProfileId]
  );

  /**
   * Track screen view with automatic previous screen
   */
  const trackScreen = useCallback(
    (screenName: string) => {
      const previousScreen = lastScreen.current;
      lastScreen.current = screenName;

      track("screen_view", {
        screen_name: screenName,
        previous_screen: previousScreen,
      });
    },
    [track]
  );

  /**
   * Track quiz start
   */
  const trackQuizStart = useCallback(
    (quizId: string, quizTitle?: string) => {
      track("quiz_start", { quiz_id: quizId, quiz_title: quizTitle }, quizId);
    },
    [track]
  );

  /**
   * Track quiz answer
   */
  const trackQuizAnswer = useCallback(
    (
      quizId: string,
      questionIndex: number,
      answerIndex: number,
      isCorrect: boolean,
      timeMs: number
    ) => {
      track(
        "quiz_answer",
        {
          question_index: questionIndex,
          answer_index: answerIndex,
          is_correct: isCorrect,
          time_ms: timeMs,
        },
        quizId
      );
    },
    [track]
  );

  /**
   * Track quiz completion
   */
  const trackQuizComplete = useCallback(
    (quizId: string, score: number, maxScore: number, timeTotalMs: number, percentile?: number) => {
      track(
        "quiz_complete",
        {
          score,
          max_score: maxScore,
          time_total_ms: timeTotalMs,
          percentile,
        },
        quizId
      );
    },
    [track]
  );

  /**
   * Track quiz abandonment
   */
  const trackQuizAbandon = useCallback(
    (quizId: string, questionIndex: number, timeSpentMs: number) => {
      track(
        "quiz_abandon",
        {
          question_index: questionIndex,
          time_ms: timeSpentMs,
        },
        quizId
      );
    },
    [track]
  );

  /**
   * Track quiz share
   */
  const trackQuizShare = useCallback(
    (quizId: string, shareType: "inline" | "link" | "story" = "link") => {
      track("quiz_share", { share_type: shareType }, quizId);
    },
    [track]
  );

  /**
   * Track error
   */
  const trackError = useCallback(
    (errorType: string, errorMessage: string, component?: string) => {
      track("error", {
        error_type: errorType,
        error_message: errorMessage,
        component,
      });
    },
    [track]
  );

  return {
    track,
    trackScreen,
    trackQuizStart,
    trackQuizAnswer,
    trackQuizComplete,
    trackQuizAbandon,
    trackQuizShare,
    trackError,
    sessionId: sessionId.current,
  };
};

/**
 * Standalone track function for use outside React components
 */
export async function trackEvent(eventType: EventType, eventData?: EventData, quizId?: string) {
  const tgUser = getTelegramUser();

  if (!tgUser?.id) {
    console.warn("Cannot track event: no Telegram user");
    return;
  }

  try {
    const profileId = await resolveProfileIdByTelegramId(tgUser.id);

    await supabase.from("user_events").insert({
      telegram_id: tgUser.id,
      user_id: profileId,
      event_type: eventType,
      event_data: eventData || {},
      quiz_id: quizId || null,
      session_id: crypto.randomUUID(),
    });
  } catch (e) {
    console.error("Error tracking event:", e);
  }
}
