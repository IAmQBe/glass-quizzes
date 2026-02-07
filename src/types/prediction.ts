export type PredictionOption = "A" | "B";

export type PredictionStatus =
  | "draft"
  | "pending"
  | "rejected"
  | "open"
  | "locked"
  | "pending_resolution"
  | "resolved"
  | "cancelled"
  | "invalid"
  | "under_review";

export type PredictionMode = "stake" | "vote";

export type PredictionBlockingReasonCode =
  | "need_progress"
  | "need_squad"
  | "need_captain"
  | "month_limit"
  | "cooldown";

export interface PredictionCreationEligibility {
  eligible: boolean;
  required_completed_count: number;
  completed_count: number;
  has_squad: boolean;
  squad_id: string | null;
  squad_title: string | null;
  is_squad_captain: boolean;
  is_admin: boolean;
  monthly_limit: number;
  used_this_month: number;
  remaining_this_month: number;
  cooldown_hours_left: number;
  next_available_at: string | null;
  blocking_reason_code: PredictionBlockingReasonCode | null;
}

export interface PredictionSquadMonthlyQuota {
  monthly_limit: number;
  used_this_month: number;
  remaining_this_month: number;
  resets_at: string;
}

export interface CreatePredictionPayload {
  title: string;
  option_a_label: string;
  option_b_label: string;
  squad_id?: string;
  cover_image_url?: string;
  deadline_at?: string;
  stake_enabled?: boolean;
  vote_enabled?: boolean;
}

export interface CreatePredictionResult {
  success: boolean;
  poll_id: string | null;
  next_status: PredictionStatus | null;
  error_code: string | null;
  error_message: string | null;
}

export interface PredictionPoll {
  id: string;
  squad_id: string;
  squad_title: string;
  title: string;
  option_a_label: string;
  option_b_label: string;
  cover_image_url: string;
  deadline_at: string;
  status: PredictionStatus;
  created_by: string;
  submitted_at?: string;
  moderated_by?: string;
  moderated_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  pool_a: number;
  pool_b: number;
  participant_count: number;
  resolved_option?: PredictionOption;
  proof_url?: string;
  resolved_by?: string;
  resolved_at?: string;
  report_count: number;
  is_hidden?: boolean;
  stake_enabled?: boolean;
  vote_enabled?: boolean;
}

export const getPredictionPoolTotal = (prediction: PredictionPoll) => {
  return prediction.pool_a + prediction.pool_b;
};

export const predictionStatusLabel: Record<PredictionStatus, string> = {
  draft: "Черновик",
  pending: "На модерации",
  rejected: "Отклонен",
  open: "Открыт",
  locked: "Закрыт",
  pending_resolution: "Ожидает резолва",
  resolved: "Рассчитан",
  cancelled: "Отменен",
  invalid: "Недействителен",
  under_review: "На проверке",
};

export type PredictionModerationAction =
  | "approve"
  | "reject"
  | "close_stakes"
  | "set_pending_resolution"
  | "set_under_review"
  | "resolve"
  | "cancel"
  | "toggle_hidden";

export interface ModeratePredictionPayload {
  poll_id: string;
  action: PredictionModerationAction;
  resolved_option?: PredictionOption;
  proof_url?: string;
  rejection_reason?: string;
}

export interface ModeratePredictionResult {
  success: boolean;
  poll_id: string | null;
  next_status: PredictionStatus | null;
  error_code: string | null;
  error_message: string | null;
  updated_poll_patch: Partial<PredictionPoll>;
}

export interface ReportPredictionResult {
  success: boolean;
  poll_id: string | null;
  report_count: number;
  transitioned_to_under_review: boolean;
  next_status: PredictionStatus | null;
  error_code: string | null;
  error_message: string | null;
  updated_poll_patch: Partial<PredictionPoll>;
}

export interface AdminUpdatePredictionPollPayload {
  poll_id: string;
  title?: string | null;
  option_a_label?: string | null;
  option_b_label?: string | null;
  cover_image_url?: string | null;
  deadline_at?: string | null;
  stake_enabled?: boolean | null;
  vote_enabled?: boolean | null;
}

export interface AdminUpdatePredictionPollResult {
  success: boolean;
  poll_id: string | null;
  error_code: string | null;
  error_message: string | null;
  updated_poll_patch: Partial<PredictionPoll>;
}

export interface AdminDeletePredictionPollResult {
  success: boolean;
  poll_id: string | null;
  operation: string | null;
  error_code: string | null;
  error_message: string | null;
}
