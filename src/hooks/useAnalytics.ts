import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Legacy analytics types
export interface FunnelData {
  viewed: number;
  started: number;
  completed: number;
  shared: number;
}

export interface RetentionCohort {
  cohort_week: string;
  week_number: number;
  retained_users: number;
  cohort_size: number;
  retention_rate: number;
}

export interface EventStats {
  event_type: string;
  event_count: number;
  unique_users: number;
}

export interface TopQuiz {
  quiz_id: string;
  title: string;
  completions: number;
  shares: number;
}

export interface UserSource {
  source: string;
  user_count: number;
  percentage: number;
}

export interface DailyActiveUsers {
  event_date: string;
  unique_users: number;
}

export type DatePreset = "7d" | "30d" | "90d" | "custom";

export interface DateRange {
  from: string;
  to: string;
  preset: DatePreset;
}

export interface AdminOverview {
  dau: number;
  wau: number;
  mau: number;
  stickiness_pct: number;
  total_users: number;
  new_users: number;
  referrals: number;
  quiz_views: number;
  quiz_starts: number;
  quiz_completes: number;
  quiz_shares: number;
  test_views: number;
  test_starts: number;
  test_completes: number;
  test_shares: number;
  avg_quiz_time_seconds: number;
  avg_quiz_score_pct: number;
  prediction_created: number;
  prediction_pending: number;
  prediction_under_review: number;
  prediction_resolved: number;
  prediction_reports: number;
  task_completions: number;
  unique_task_completers: number;
  error_events: number;
}

export interface AdminTimeseriesPoint {
  metric_date: string;
  dau: number;
  quiz_completes: number;
  test_completes: number;
  shares: number;
  prediction_reports: number;
  task_completions: number;
  error_events: number;
}

export interface AdminFunnelStage {
  stage: string;
  users: number;
  conversion_from_prev: number;
  conversion_from_first: number;
}

export interface AdminTopQuiz {
  quiz_id: string;
  title: string;
  views: number;
  starts: number;
  completes: number;
  shares: number;
  avg_score_pct: number;
  avg_time_seconds: number;
  completion_rate: number;
  share_rate: number;
}

export interface AdminTopTest {
  test_id: string;
  title: string;
  views: number;
  starts: number;
  completes: number;
  shares: number;
  completion_rate: number;
  share_rate: number;
}

export interface AdminSource {
  source: string;
  user_count: number;
  percentage: number;
  referred_users: number;
}

export interface AdminScreenTransition {
  from_screen: string;
  to_screen: string;
  transitions: number;
  unique_users: number;
}

export interface AdminPredictions {
  created_total: number;
  pending_total: number;
  under_review_total: number;
  resolved_total: number;
  rejected_total: number;
  cancelled_total: number;
  total_reports_current: number;
  reports_created_in_range: number;
  avg_time_to_moderation_hours: number;
  avg_time_to_resolution_hours: number;
}

export interface AdminTask {
  task_id: string;
  title: string;
  completions: number;
  unique_users: number;
  completion_rate: number;
  last_completed_at: string | null;
}

export interface AdminEventHealth {
  event_type: string;
  event_count: number;
  unique_users: number;
  with_user_id_pct: number;
  last_seen_at: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

const addUtcDays = (date: string, days: number) => {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed;
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toString = (value: unknown, fallback = "") => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const toNullableString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
};

const getNormalizedRange = (range: DateRange) => {
  const from = toDateInput(new Date(`${range.from}T00:00:00.000Z`));
  const to = toDateInput(new Date(`${range.to}T00:00:00.000Z`));
  if (from <= to) return { from, to };
  return { from: to, to: from };
};

const getOverviewTimestamps = (range: DateRange) => {
  const normalized = getNormalizedRange(range);
  return {
    p_from: `${normalized.from}T00:00:00.000Z`,
    p_to: addUtcDays(normalized.to, 1).toISOString(),
  };
};

const getDateArgs = (range: DateRange) => {
  const normalized = getNormalizedRange(range);
  return {
    p_from: normalized.from,
    p_to: normalized.to,
  };
};

const runAdminRpc = async <T>(fnName: string, params: Record<string, unknown>): Promise<T> => {
  const { data, error } = await (supabase as any).rpc(fnName, params);
  if (error) throw error;
  return data as T;
};

const normalizeOverview = (row: unknown): AdminOverview => {
  const record = asRecord(row);
  return {
    dau: toNumber(record.dau),
    wau: toNumber(record.wau),
    mau: toNumber(record.mau),
    stickiness_pct: toNumber(record.stickiness_pct),
    total_users: toNumber(record.total_users),
    new_users: toNumber(record.new_users),
    referrals: toNumber(record.referrals),
    quiz_views: toNumber(record.quiz_views),
    quiz_starts: toNumber(record.quiz_starts),
    quiz_completes: toNumber(record.quiz_completes),
    quiz_shares: toNumber(record.quiz_shares),
    test_views: toNumber(record.test_views),
    test_starts: toNumber(record.test_starts),
    test_completes: toNumber(record.test_completes),
    test_shares: toNumber(record.test_shares),
    avg_quiz_time_seconds: toNumber(record.avg_quiz_time_seconds),
    avg_quiz_score_pct: toNumber(record.avg_quiz_score_pct),
    prediction_created: toNumber(record.prediction_created),
    prediction_pending: toNumber(record.prediction_pending),
    prediction_under_review: toNumber(record.prediction_under_review),
    prediction_resolved: toNumber(record.prediction_resolved),
    prediction_reports: toNumber(record.prediction_reports),
    task_completions: toNumber(record.task_completions),
    unique_task_completers: toNumber(record.unique_task_completers),
    error_events: toNumber(record.error_events),
  };
};

const normalizeTimeseries = (rows: unknown): AdminTimeseriesPoint[] => {
  return asArray(rows).map((row) => {
    const record = asRecord(row);
    return {
      metric_date: toString(record.metric_date),
      dau: toNumber(record.dau),
      quiz_completes: toNumber(record.quiz_completes),
      test_completes: toNumber(record.test_completes),
      shares: toNumber(record.shares),
      prediction_reports: toNumber(record.prediction_reports),
      task_completions: toNumber(record.task_completions),
      error_events: toNumber(record.error_events),
    };
  });
};

const normalizeFunnel = (rows: unknown): AdminFunnelStage[] => {
  return asArray(rows).map((row) => {
    const record = asRecord(row);
    return {
      stage: toString(record.stage),
      users: toNumber(record.users),
      conversion_from_prev: toNumber(record.conversion_from_prev),
      conversion_from_first: toNumber(record.conversion_from_first),
    };
  });
};

const normalizeTopQuizzes = (rows: unknown): AdminTopQuiz[] => {
  return asArray(rows).map((row) => {
    const record = asRecord(row);
    return {
      quiz_id: toString(record.quiz_id),
      title: toString(record.title, "Без названия"),
      views: toNumber(record.views),
      starts: toNumber(record.starts),
      completes: toNumber(record.completes),
      shares: toNumber(record.shares),
      avg_score_pct: toNumber(record.avg_score_pct),
      avg_time_seconds: toNumber(record.avg_time_seconds),
      completion_rate: toNumber(record.completion_rate),
      share_rate: toNumber(record.share_rate),
    };
  });
};

const normalizeTopTests = (rows: unknown): AdminTopTest[] => {
  return asArray(rows).map((row) => {
    const record = asRecord(row);
    return {
      test_id: toString(record.test_id),
      title: toString(record.title, "Без названия"),
      views: toNumber(record.views),
      starts: toNumber(record.starts),
      completes: toNumber(record.completes),
      shares: toNumber(record.shares),
      completion_rate: toNumber(record.completion_rate),
      share_rate: toNumber(record.share_rate),
    };
  });
};

const normalizeSources = (rows: unknown): AdminSource[] => {
  return asArray(rows).map((row) => {
    const record = asRecord(row);
    return {
      source: toString(record.source, "unknown"),
      user_count: toNumber(record.user_count),
      percentage: toNumber(record.percentage),
      referred_users: toNumber(record.referred_users),
    };
  });
};

const normalizeScreenTransitions = (rows: unknown): AdminScreenTransition[] => {
  return asArray(rows).map((row) => {
    const record = asRecord(row);
    return {
      from_screen: toString(record.from_screen, "unknown"),
      to_screen: toString(record.to_screen, "unknown"),
      transitions: toNumber(record.transitions),
      unique_users: toNumber(record.unique_users),
    };
  });
};

const normalizePredictions = (row: unknown): AdminPredictions => {
  const record = asRecord(row);
  return {
    created_total: toNumber(record.created_total),
    pending_total: toNumber(record.pending_total),
    under_review_total: toNumber(record.under_review_total),
    resolved_total: toNumber(record.resolved_total),
    rejected_total: toNumber(record.rejected_total),
    cancelled_total: toNumber(record.cancelled_total),
    total_reports_current: toNumber(record.total_reports_current),
    reports_created_in_range: toNumber(record.reports_created_in_range),
    avg_time_to_moderation_hours: toNumber(record.avg_time_to_moderation_hours),
    avg_time_to_resolution_hours: toNumber(record.avg_time_to_resolution_hours),
  };
};

const normalizeTasks = (rows: unknown): AdminTask[] => {
  return asArray(rows).map((row) => {
    const record = asRecord(row);
    return {
      task_id: toString(record.task_id),
      title: toString(record.title, "Без названия"),
      completions: toNumber(record.completions),
      unique_users: toNumber(record.unique_users),
      completion_rate: toNumber(record.completion_rate),
      last_completed_at: toNullableString(record.last_completed_at),
    };
  });
};

const normalizeEventHealth = (rows: unknown): AdminEventHealth[] => {
  return asArray(rows).map((row) => {
    const record = asRecord(row);
    return {
      event_type: toString(record.event_type),
      event_count: toNumber(record.event_count),
      unique_users: toNumber(record.unique_users),
      with_user_id_pct: toNumber(record.with_user_id_pct),
      last_seen_at: toNullableString(record.last_seen_at),
    };
  });
};

export const buildDateRangeFromPreset = (preset: Exclude<DatePreset, "custom"> = "30d"): DateRange => {
  const now = Date.now();
  const days = preset === "7d" ? 6 : preset === "90d" ? 89 : 29;
  const from = toDateInput(new Date(now - days * DAY_MS));
  const to = toDateInput(new Date(now));
  return { from, to, preset };
};

/**
 * Get Daily Active Users count
 */
export const useDAU = () => {
  return useQuery({
    queryKey: ["analytics", "dau"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("get_dau");
      if (error) {
        console.error("Error fetching DAU:", error);
        return 0;
      }
      return data || 0;
    },
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Get Weekly Active Users count
 */
export const useWAU = () => {
  return useQuery({
    queryKey: ["analytics", "wau"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("get_wau");
      if (error) {
        console.error("Error fetching WAU:", error);
        return 0;
      }
      return data || 0;
    },
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Get Monthly Active Users count
 */
export const useMAU = () => {
  return useQuery({
    queryKey: ["analytics", "mau"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("get_mau");
      if (error) {
        console.error("Error fetching MAU:", error);
        return 0;
      }
      return data || 0;
    },
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Get active users by day for chart
 */
export const useActiveUsersByPeriod = (daysBack: number = 30) => {
  return useQuery({
    queryKey: ["analytics", "activeUsers", daysBack],
    queryFn: async (): Promise<DailyActiveUsers[]> => {
      const { data, error } = await supabase.rpc("get_active_users_by_period", {
        days_back: daysBack,
      });
      if (error) {
        console.error("Error fetching active users:", error);
        return [];
      }
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Get quiz funnel data
 */
export const useQuizFunnel = (fromDate?: string, toDate?: string) => {
  return useQuery({
    queryKey: ["analytics", "funnel", fromDate, toDate],
    queryFn: async (): Promise<FunnelData> => {
      const params: Record<string, string> = {};
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const { data, error } = await supabase.rpc("get_quiz_funnel", params);
      if (error) {
        console.error("Error fetching funnel:", error);
        return { viewed: 0, started: 0, completed: 0, shared: 0 };
      }
      return data || { viewed: 0, started: 0, completed: 0, shared: 0 };
    },
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Get total shares count
 */
export const useTotalShares = () => {
  return useQuery({
    queryKey: ["analytics", "totalShares"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("get_total_shares");
      if (error) {
        console.error("Error fetching total shares:", error);
        return 0;
      }
      return data || 0;
    },
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Get average quiz completion time
 */
export const useAvgCompletionTime = () => {
  return useQuery({
    queryKey: ["analytics", "avgCompletionTime"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("get_avg_completion_time");
      if (error) {
        console.error("Error fetching avg completion time:", error);
        return 60;
      }
      return Math.round(data) || 60;
    },
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Get retention cohorts
 */
export const useRetentionCohorts = (weeksBack: number = 8) => {
  return useQuery({
    queryKey: ["analytics", "retention", weeksBack],
    queryFn: async (): Promise<RetentionCohort[]> => {
      const { data, error } = await supabase.rpc("get_retention_cohorts", {
        weeks_back: weeksBack,
      });
      if (error) {
        console.error("Error fetching retention:", error);
        return [];
      }
      return data || [];
    },
    staleTime: 1000 * 60 * 15,
  });
};

/**
 * Get event statistics
 */
export const useEventStats = (fromDate?: string, toDate?: string) => {
  return useQuery({
    queryKey: ["analytics", "eventStats", fromDate, toDate],
    queryFn: async (): Promise<EventStats[]> => {
      const params: Record<string, string> = {};
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const { data, error } = await supabase.rpc("get_event_stats", params);
      if (error) {
        console.error("Error fetching event stats:", error);
        return [];
      }
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Get top quizzes by completions
 */
export const useTopQuizzesByCompletions = (limit: number = 10) => {
  return useQuery({
    queryKey: ["analytics", "topQuizzes", limit],
    queryFn: async (): Promise<TopQuiz[]> => {
      const { data, error } = await supabase.rpc("get_top_quizzes_by_completions", {
        limit_count: limit,
      });
      if (error) {
        console.error("Error fetching top quizzes:", error);
        return [];
      }
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Get user acquisition sources
 */
export const useUserSources = (daysBack: number = 30) => {
  return useQuery({
    queryKey: ["analytics", "sources", daysBack],
    queryFn: async (): Promise<UserSource[]> => {
      const { data, error } = await supabase.rpc("get_user_sources", {
        days_back: daysBack,
      });
      if (error) {
        console.error("Error fetching user sources:", error);
        return [];
      }
      return data || [];
    },
    staleTime: 1000 * 60 * 15,
  });
};

/**
 * Combined analytics overview
 */
export const useAnalyticsOverview = () => {
  const { data: dau, isLoading: dauLoading } = useDAU();
  const { data: wau, isLoading: wauLoading } = useWAU();
  const { data: mau, isLoading: mauLoading } = useMAU();
  const { data: totalShares, isLoading: sharesLoading } = useTotalShares();
  const { data: avgTime, isLoading: timeLoading } = useAvgCompletionTime();
  const { data: funnel, isLoading: funnelLoading } = useQuizFunnel();

  return {
    data: {
      dau: dau || 0,
      wau: wau || 0,
      mau: mau || 0,
      totalShares: totalShares || 0,
      avgCompletionTime: avgTime || 60,
      funnel: funnel || { viewed: 0, started: 0, completed: 0, shared: 0 },
    },
    isLoading: dauLoading || wauLoading || mauLoading || sharesLoading || timeLoading || funnelLoading,
  };
};

export const useAdminOverview = (range: DateRange, enabled = true) => {
  return useQuery({
    queryKey: ["admin", "analytics", "overview", range.from, range.to],
    enabled,
    queryFn: async (): Promise<AdminOverview> => {
      const params = getOverviewTimestamps(range);
      const rows = await runAdminRpc<unknown>("admin_analytics_overview", params);
      const first = Array.isArray(rows) ? rows[0] : rows;
      return normalizeOverview(first);
    },
    staleTime: 1000 * 60,
  });
};

export const useAdminTimeseries = (range: DateRange, enabled = true) => {
  return useQuery({
    queryKey: ["admin", "analytics", "timeseries", range.from, range.to],
    enabled,
    queryFn: async (): Promise<AdminTimeseriesPoint[]> => {
      const params = getDateArgs(range);
      const rows = await runAdminRpc<unknown>("admin_analytics_timeseries", params);
      return normalizeTimeseries(rows);
    },
    staleTime: 1000 * 60,
  });
};

export const useAdminQuizFunnel = (range: DateRange, enabled = true) => {
  return useQuery({
    queryKey: ["admin", "analytics", "funnel", "quiz", range.from, range.to],
    enabled,
    queryFn: async (): Promise<AdminFunnelStage[]> => {
      const params = getDateArgs(range);
      const rows = await runAdminRpc<unknown>("admin_analytics_funnel_quiz", params);
      return normalizeFunnel(rows);
    },
    staleTime: 1000 * 60,
  });
};

export const useAdminTestsFunnel = (range: DateRange, enabled = true) => {
  return useQuery({
    queryKey: ["admin", "analytics", "funnel", "tests", range.from, range.to],
    enabled,
    queryFn: async (): Promise<AdminFunnelStage[]> => {
      const params = getDateArgs(range);
      const rows = await runAdminRpc<unknown>("admin_analytics_funnel_tests", params);
      return normalizeFunnel(rows);
    },
    staleTime: 1000 * 60,
  });
};

export const useAdminTopQuizzes = (range: DateRange, limit = 10, enabled = true) => {
  return useQuery({
    queryKey: ["admin", "analytics", "top", "quizzes", range.from, range.to, limit],
    enabled,
    queryFn: async (): Promise<AdminTopQuiz[]> => {
      const params = {
        ...getDateArgs(range),
        p_limit: limit,
      };
      const rows = await runAdminRpc<unknown>("admin_analytics_top_quizzes", params);
      return normalizeTopQuizzes(rows);
    },
    staleTime: 1000 * 60,
  });
};

export const useAdminTopTests = (range: DateRange, limit = 10, enabled = true) => {
  return useQuery({
    queryKey: ["admin", "analytics", "top", "tests", range.from, range.to, limit],
    enabled,
    queryFn: async (): Promise<AdminTopTest[]> => {
      const params = {
        ...getDateArgs(range),
        p_limit: limit,
      };
      const rows = await runAdminRpc<unknown>("admin_analytics_top_tests", params);
      return normalizeTopTests(rows);
    },
    staleTime: 1000 * 60,
  });
};

export const useAdminSources = (range: DateRange, enabled = true) => {
  return useQuery({
    queryKey: ["admin", "analytics", "sources", range.from, range.to],
    enabled,
    queryFn: async (): Promise<AdminSource[]> => {
      const params = getDateArgs(range);
      const rows = await runAdminRpc<unknown>("admin_analytics_sources", params);
      return normalizeSources(rows);
    },
    staleTime: 1000 * 60,
  });
};

export const useAdminScreenTransitions = (range: DateRange, limit = 20, enabled = true) => {
  return useQuery({
    queryKey: ["admin", "analytics", "screenTransitions", range.from, range.to, limit],
    enabled,
    queryFn: async (): Promise<AdminScreenTransition[]> => {
      const params = {
        ...getDateArgs(range),
        p_limit: limit,
      };
      const rows = await runAdminRpc<unknown>("admin_analytics_screen_transitions", params);
      return normalizeScreenTransitions(rows);
    },
    staleTime: 1000 * 60,
  });
};

export const useAdminPredictions = (range: DateRange, enabled = true) => {
  return useQuery({
    queryKey: ["admin", "analytics", "predictions", range.from, range.to],
    enabled,
    queryFn: async (): Promise<AdminPredictions> => {
      const params = getDateArgs(range);
      const rows = await runAdminRpc<unknown>("admin_analytics_predictions", params);
      const first = Array.isArray(rows) ? rows[0] : rows;
      return normalizePredictions(first);
    },
    staleTime: 1000 * 60,
  });
};

export const useAdminTasks = (range: DateRange, limit = 20, enabled = true) => {
  return useQuery({
    queryKey: ["admin", "analytics", "tasks", range.from, range.to, limit],
    enabled,
    queryFn: async (): Promise<AdminTask[]> => {
      const params = {
        ...getDateArgs(range),
        p_limit: limit,
      };
      const rows = await runAdminRpc<unknown>("admin_analytics_tasks", params);
      return normalizeTasks(rows);
    },
    staleTime: 1000 * 60,
  });
};

export const useAdminEventHealth = (range: DateRange, enabled = true) => {
  return useQuery({
    queryKey: ["admin", "analytics", "eventHealth", range.from, range.to],
    enabled,
    queryFn: async (): Promise<AdminEventHealth[]> => {
      const params = getDateArgs(range);
      const rows = await runAdminRpc<unknown>("admin_analytics_event_health", params);
      return normalizeEventHealth(rows);
    },
    staleTime: 1000 * 60,
  });
};
