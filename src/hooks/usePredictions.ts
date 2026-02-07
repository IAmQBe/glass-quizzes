import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { trackEvent } from "@/hooks/useTrackEvent";
import { initUser } from "@/lib/user";
import {
  AdminDeletePredictionPollResult,
  AdminUpdatePredictionPollPayload,
  AdminUpdatePredictionPollResult,
  CreatePredictionPayload,
  CreatePredictionResult,
  ModeratePredictionPayload,
  ModeratePredictionResult,
  PredictionCreationEligibility,
  PredictionPoll,
  PredictionSquadMonthlyQuota,
  PredictionStatus,
  ReportPredictionResult,
} from "@/types/prediction";

const DEFAULT_REQUIRED_COMPLETED_COUNT = 3;
const DEFAULT_MONTHLY_LIMIT = 5;

const getNextUtcMonthStartIso = () => {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
  return next.toISOString();
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: unknown) => Boolean(value);

const toNullableString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const hasOwn = (obj: unknown, key: string) => {
  if (!obj || typeof obj !== "object") return false;
  return Object.prototype.hasOwnProperty.call(obj, key);
};

const buildPredictionError = (message: string, code?: string | null): never => {
  const error = new Error(message);
  (error as any).code = code || null;
  throw error;
};

const notifyPredictionModerationEvent = async (pollId: string, eventType: "pending" | "under_review") => {
  if (!pollId) return;

  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl || typeof window === "undefined") {
    return;
  }

  try {
    const tg = (window as any).Telegram?.WebApp;
    const initData = tg?.initData || "";
    if (!initData) return;

    await fetch(`${apiUrl}/api/predictions/moderation-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `tma ${initData}`,
      },
      body: JSON.stringify({ pollId, eventType }),
    });
  } catch (error) {
    console.warn("Prediction moderation notify failed:", error);
  }
};

const defaultEligibility = (): PredictionCreationEligibility => ({
  eligible: false,
  required_completed_count: DEFAULT_REQUIRED_COMPLETED_COUNT,
  completed_count: 0,
  has_squad: false,
  squad_id: null,
  squad_title: null,
  is_squad_captain: false,
  is_admin: false,
  monthly_limit: DEFAULT_MONTHLY_LIMIT,
  used_this_month: 0,
  remaining_this_month: DEFAULT_MONTHLY_LIMIT,
  cooldown_hours_left: 0,
  next_available_at: null,
  blocking_reason_code: "need_progress",
});

const normalizeEligibility = (row: any): PredictionCreationEligibility => {
  const normalizedDefault = defaultEligibility();
  if (!row || typeof row !== "object") {
    return normalizedDefault;
  }

  return {
    eligible: toBoolean(row.eligible),
    required_completed_count: toNumber(row.required_completed_count, DEFAULT_REQUIRED_COMPLETED_COUNT),
    completed_count: toNumber(row.completed_count, 0),
    has_squad: toBoolean(row.has_squad),
    squad_id: toNullableString(row.squad_id),
    squad_title: toNullableString(row.squad_title),
    is_squad_captain: toBoolean(row.is_squad_captain),
    is_admin: toBoolean(row.is_admin),
    monthly_limit: toNumber(row.monthly_limit, DEFAULT_MONTHLY_LIMIT),
    used_this_month: toNumber(row.used_this_month, 0),
    remaining_this_month: toNumber(row.remaining_this_month, DEFAULT_MONTHLY_LIMIT),
    cooldown_hours_left: toNumber(row.cooldown_hours_left, 0),
    next_available_at: toNullableString(row.next_available_at),
    blocking_reason_code: toNullableString(row.blocking_reason_code) as PredictionCreationEligibility["blocking_reason_code"],
  };
};

const normalizeQuota = (row: any): PredictionSquadMonthlyQuota => ({
  monthly_limit: toNumber(row?.monthly_limit, DEFAULT_MONTHLY_LIMIT),
  used_this_month: toNumber(row?.used_this_month, 0),
  remaining_this_month: toNumber(row?.remaining_this_month, DEFAULT_MONTHLY_LIMIT),
  resets_at: toNullableString(row?.resets_at) || getNextUtcMonthStartIso(),
});

const normalizeCreateResult = (row: any): CreatePredictionResult => ({
  success: toBoolean(row?.success),
  poll_id: toNullableString(row?.poll_id),
  next_status: (toNullableString(row?.next_status) as PredictionStatus) || null,
  error_code: toNullableString(row?.error_code),
  error_message: toNullableString(row?.error_message),
});

const normalizeUpdatedPollPatch = (row: any): Partial<PredictionPoll> => {
  const updated = row?.updated_poll;
  if (!updated || typeof updated !== "object") {
    return {};
  }

  const patch: Partial<PredictionPoll> = {};

  if (hasOwn(updated, "title")) {
    patch.title = toNullableString(updated.title) || "Без названия";
  }
  if (hasOwn(updated, "option_a_label")) {
    patch.option_a_label = toNullableString(updated.option_a_label) || "Вариант A";
  }
  if (hasOwn(updated, "option_b_label")) {
    patch.option_b_label = toNullableString(updated.option_b_label) || "Вариант B";
  }
  if (hasOwn(updated, "cover_image_url")) {
    patch.cover_image_url = toNullableString(updated.cover_image_url) || "/placeholder.svg";
  }
  if (hasOwn(updated, "deadline_at")) {
    patch.deadline_at = toNullableString(updated.deadline_at) || new Date().toISOString();
  }

  if (hasOwn(updated, "status")) {
    patch.status = (toNullableString(updated.status) as PredictionStatus) || "open";
  }
  if (hasOwn(updated, "resolved_option")) {
    patch.resolved_option = toNullableString(updated.resolved_option) as PredictionPoll["resolved_option"];
  }
  if (hasOwn(updated, "proof_url")) {
    patch.proof_url = toNullableString(updated.proof_url) || undefined;
  }
  if (hasOwn(updated, "resolved_by")) {
    patch.resolved_by = toNullableString(updated.resolved_by) || undefined;
  }
  if (hasOwn(updated, "resolved_at")) {
    patch.resolved_at = toNullableString(updated.resolved_at) || undefined;
  }
  if (hasOwn(updated, "report_count")) {
    patch.report_count = toNumber(updated.report_count, 0);
  }
  if (hasOwn(updated, "is_hidden")) {
    patch.is_hidden = toBoolean(updated.is_hidden);
  }
  if (hasOwn(updated, "updated_at")) {
    patch.updated_at = toNullableString(updated.updated_at) || new Date().toISOString();
  }
  if (hasOwn(updated, "moderated_by")) {
    patch.moderated_by = toNullableString(updated.moderated_by) || undefined;
  }
  if (hasOwn(updated, "moderated_at")) {
    patch.moderated_at = toNullableString(updated.moderated_at) || undefined;
  }
  if (hasOwn(updated, "rejection_reason")) {
    patch.rejection_reason = toNullableString(updated.rejection_reason) || undefined;
  }
  if (hasOwn(updated, "submitted_at")) {
    patch.submitted_at = toNullableString(updated.submitted_at) || undefined;
  }
  if (hasOwn(updated, "pool_a")) {
    patch.pool_a = toNumber(updated.pool_a, 0);
  }
  if (hasOwn(updated, "pool_b")) {
    patch.pool_b = toNumber(updated.pool_b, 0);
  }
  if (hasOwn(updated, "participant_count")) {
    patch.participant_count = toNumber(updated.participant_count, 0);
  }
  if (hasOwn(updated, "stake_enabled")) {
    patch.stake_enabled = toBoolean(updated.stake_enabled);
  }
  if (hasOwn(updated, "vote_enabled")) {
    patch.vote_enabled = toBoolean(updated.vote_enabled);
  }

  return patch;
};

const normalizeModerationResult = (row: any): ModeratePredictionResult => ({
  success: toBoolean(row?.success),
  poll_id: toNullableString(row?.poll_id),
  next_status: (toNullableString(row?.next_status) as PredictionStatus) || null,
  error_code: toNullableString(row?.error_code),
  error_message: toNullableString(row?.error_message),
  updated_poll_patch: normalizeUpdatedPollPatch(row),
});

const normalizeReportResult = (row: any): ReportPredictionResult => ({
  success: toBoolean(row?.success),
  poll_id: toNullableString(row?.poll_id),
  report_count: toNumber(row?.report_count, 0),
  transitioned_to_under_review: toBoolean(row?.transitioned_to_under_review),
  next_status: (toNullableString(row?.next_status) as PredictionStatus) || null,
  error_code: toNullableString(row?.error_code),
  error_message: toNullableString(row?.error_message),
  updated_poll_patch: normalizeUpdatedPollPatch(row),
});

const normalizeAdminUpdateResult = (row: any): AdminUpdatePredictionPollResult => ({
  success: toBoolean(row?.success),
  poll_id: toNullableString(row?.poll_id),
  error_code: toNullableString(row?.error_code),
  error_message: toNullableString(row?.error_message),
  updated_poll_patch: normalizeUpdatedPollPatch(row),
});

const normalizeAdminDeleteResult = (row: any): AdminDeletePredictionPollResult => ({
  success: toBoolean(row?.success),
  poll_id: toNullableString(row?.poll_id),
  operation: toNullableString(row?.operation),
  error_code: toNullableString(row?.error_code),
  error_message: toNullableString(row?.error_message),
});

const normalizePoll = (row: any, squadTitleMap: Map<string, string>): PredictionPoll => {
  const squadId = toNullableString(row?.squad_id) || "";
  const createdAt = toNullableString(row?.created_at) || new Date().toISOString();

  return {
    id: toNullableString(row?.id) || crypto.randomUUID(),
    squad_id: squadId,
    squad_title: squadTitleMap.get(squadId) || "Сквад",
    title: toNullableString(row?.title) || "Без названия",
    option_a_label: toNullableString(row?.option_a_label) || "Вариант A",
    option_b_label: toNullableString(row?.option_b_label) || "Вариант B",
    cover_image_url: toNullableString(row?.cover_image_url) || "/placeholder.svg",
    deadline_at: toNullableString(row?.deadline_at) || createdAt,
    status: (toNullableString(row?.status) as PredictionPoll["status"]) || "open",
    created_by: toNullableString(row?.created_by) || "",
    submitted_at: toNullableString(row?.submitted_at) || undefined,
    moderated_by: toNullableString(row?.moderated_by) || undefined,
    moderated_at: toNullableString(row?.moderated_at) || undefined,
    rejection_reason: toNullableString(row?.rejection_reason) || undefined,
    created_at: createdAt,
    updated_at: toNullableString(row?.updated_at) || createdAt,
    pool_a: toNumber(row?.pool_a, 0),
    pool_b: toNumber(row?.pool_b, 0),
    participant_count: toNumber(row?.participant_count, 0),
    resolved_option: toNullableString(row?.resolved_option) as PredictionPoll["resolved_option"],
    proof_url: toNullableString(row?.proof_url) || undefined,
    resolved_by: toNullableString(row?.resolved_by) || undefined,
    resolved_at: toNullableString(row?.resolved_at) || undefined,
    report_count: toNumber(row?.report_count, 0),
    is_hidden: toBoolean(row?.is_hidden),
    stake_enabled: row?.stake_enabled === undefined ? true : toBoolean(row?.stake_enabled),
    vote_enabled: row?.vote_enabled === undefined ? true : toBoolean(row?.vote_enabled),
  };
};

interface EligibilityOptions {
  enabled?: boolean;
  userId?: string | null;
}

export const usePredictionCreationEligibility = (options: EligibilityOptions = {}) => {
  const { data: profile } = useCurrentProfile();
  const userId = options.userId ?? profile?.id ?? null;

  return useQuery({
    queryKey: ["predictionCreationEligibility", userId],
    enabled: options.enabled ?? true,
    queryFn: async (): Promise<PredictionCreationEligibility> => {
      if (!userId) {
        return defaultEligibility();
      }

      const { data, error } = await (supabase as any).rpc("prediction_get_creation_eligibility", {
        p_user_id: userId,
      });

      if (error) {
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;
      return normalizeEligibility(row);
    },
  });
};

export const useSquadPredictionQuota = (squadId?: string | null, enabled = true) => {
  return useQuery({
    queryKey: ["predictionSquadQuota", squadId],
    enabled: enabled && Boolean(squadId),
    queryFn: async (): Promise<PredictionSquadMonthlyQuota> => {
      if (!squadId) {
        return normalizeQuota(null);
      }

      const { data, error } = await (supabase as any).rpc("prediction_get_squad_monthly_quota", {
        p_squad_id: squadId,
      });

      if (error) {
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;
      return normalizeQuota(row);
    },
  });
};

export const usePredictionPolls = () => {
  return useQuery({
    queryKey: ["predictionPolls"],
    queryFn: async (): Promise<PredictionPoll[]> => {
      const { data, error } = await (supabase as any)
        .from("prediction_polls")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0) {
        return [];
      }

      const squadIds = [...new Set(rows.map((row) => toNullableString(row?.squad_id)).filter(Boolean))] as string[];
      const squadTitleMap = new Map<string, string>();

      if (squadIds.length > 0) {
        const { data: squads, error: squadsError } = await (supabase as any)
          .from("squads")
          .select("id,title")
          .in("id", squadIds);

        if (squadsError) {
          throw squadsError;
        }

        (Array.isArray(squads) ? squads : []).forEach((squad) => {
          const id = toNullableString(squad?.id);
          if (!id) return;
          squadTitleMap.set(id, toNullableString(squad?.title) || "Сквад");
        });
      }

      return rows.map((row) => normalizePoll(row, squadTitleMap));
    },
  });
};

export const useCreatePredictionPoll = () => {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentProfile();

  return useMutation({
    mutationFn: async (payload: CreatePredictionPayload): Promise<CreatePredictionResult> => {
      if (!profile?.id) {
        throw new Error("Профиль не найден");
      }

      const rpcArgs = {
        p_user_id: profile.id,
        p_title: payload.title,
        p_option_a_label: payload.option_a_label,
        p_option_b_label: payload.option_b_label,
        p_squad_id: payload.squad_id || null,
        p_cover_image_url: payload.cover_image_url || null,
        p_deadline_at: payload.deadline_at || null,
        p_stake_enabled: payload.stake_enabled ?? true,
        p_vote_enabled: payload.vote_enabled ?? true,
      };

      let { data, error } = await (supabase as any).rpc("prediction_create_poll", rpcArgs);

      if (error) {
        const message = String(error.message || "");
        const isLegacySignature =
          message.includes("p_squad_id") ||
          message.includes("function public.prediction_create_poll") ||
          message.includes("Could not find the function");

        if (isLegacySignature) {
          const legacyArgs = {
            p_user_id: profile.id,
            p_title: payload.title,
            p_option_a_label: payload.option_a_label,
            p_option_b_label: payload.option_b_label,
            p_cover_image_url: payload.cover_image_url || null,
            p_deadline_at: payload.deadline_at || null,
            p_stake_enabled: payload.stake_enabled ?? true,
            p_vote_enabled: payload.vote_enabled ?? true,
          };
          const legacyCall = await (supabase as any).rpc("prediction_create_poll", legacyArgs);
          data = legacyCall.data;
          error = legacyCall.error;
        }
      }

      if (error) {
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;
      const result = normalizeCreateResult(row);

      if (!result.success) {
        buildPredictionError(result.error_message || "Не удалось создать событие", result.error_code);
      }

      if (result.poll_id && !result.next_status) {
        const { data: createdPoll } = await (supabase as any)
          .from("prediction_polls")
          .select("status")
          .eq("id", result.poll_id)
          .maybeSingle();

        return {
          ...result,
          next_status: (toNullableString(createdPoll?.status) as PredictionStatus) || null,
        };
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["predictionPolls"] });
      queryClient.invalidateQueries({ queryKey: ["predictionCreationEligibility"] });
      queryClient.invalidateQueries({ queryKey: ["predictionSquadQuota"] });

      if (result.poll_id) {
        void trackEvent("prediction_create", {
          poll_id: result.poll_id,
          next_status: result.next_status,
        });
      }

      if (result.poll_id && result.next_status === "pending") {
        void notifyPredictionModerationEvent(result.poll_id, "pending");
      }
    },
  });
};

export const useModeratePredictionPoll = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ModeratePredictionPayload): Promise<ModeratePredictionResult> => {
      const { data, error } = await (supabase as any).rpc("prediction_admin_moderate_poll", {
        p_poll_id: payload.poll_id,
        p_action: payload.action,
        p_resolved_option: payload.resolved_option || null,
        p_proof_url: payload.proof_url || null,
        p_rejection_reason: payload.rejection_reason || null,
      });

      if (error) {
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;
      const result = normalizeModerationResult(row);

      if (!result.success) {
        buildPredictionError(result.error_message || "Не удалось выполнить действие модерации", result.error_code);
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["predictionPolls"] });

      if (result.poll_id && result.next_status === "under_review") {
        void notifyPredictionModerationEvent(result.poll_id, "under_review");
      }
    },
  });
};

export const useReportPredictionPoll = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pollId, reason }: { pollId: string; reason?: string }): Promise<ReportPredictionResult> => {
      // Report RPC relies on auth.uid(); ensure we have a session before calling it.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        const initialized = await initUser();
        if (!initialized) {
          buildPredictionError("Нужна авторизация", "auth_required");
        }

        const {
          data: { user: userAfterInit },
        } = await supabase.auth.getUser();
        if (!userAfterInit) {
          buildPredictionError("Нужна авторизация", "auth_required");
        }
      }

      const { data, error } = await (supabase as any).rpc("prediction_report_poll", {
        p_poll_id: pollId,
        p_reason: reason || null,
      });

      if (error) {
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;
      const result = normalizeReportResult(row);

      if (!result.success) {
        buildPredictionError(result.error_message || "Не удалось отправить репорт", result.error_code);
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["predictionPolls"] });

      if (result.poll_id) {
        void trackEvent("prediction_report", {
          poll_id: result.poll_id,
          transitioned_to_under_review: result.transitioned_to_under_review,
        });
      }

      if (result.poll_id && result.transitioned_to_under_review) {
        void notifyPredictionModerationEvent(result.poll_id, "under_review");
      }
    },
  });
};

export const useAdminUpdatePredictionPoll = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AdminUpdatePredictionPollPayload): Promise<AdminUpdatePredictionPollResult> => {
      const { data, error } = await (supabase as any).rpc("prediction_admin_update_poll", {
        p_poll_id: payload.poll_id,
        p_title: payload.title ?? null,
        p_option_a_label: payload.option_a_label ?? null,
        p_option_b_label: payload.option_b_label ?? null,
        p_cover_image_url: payload.cover_image_url ?? null,
        p_deadline_at: payload.deadline_at ?? null,
        p_stake_enabled: payload.stake_enabled ?? null,
        p_vote_enabled: payload.vote_enabled ?? null,
      });

      if (error) {
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;
      const result = normalizeAdminUpdateResult(row);

      if (!result.success) {
        buildPredictionError(result.error_message || "Не удалось обновить событие", result.error_code);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predictionPolls"] });
    },
  });
};

export const useAdminDeletePredictionPoll = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pollId: string): Promise<AdminDeletePredictionPollResult> => {
      const { data, error } = await (supabase as any).rpc("prediction_admin_delete_poll", {
        p_poll_id: pollId,
      });

      if (error) {
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;
      const result = normalizeAdminDeleteResult(row);

      if (!result.success) {
        buildPredictionError(result.error_message || "Не удалось удалить событие", result.error_code);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predictionPolls"] });
    },
  });
};
