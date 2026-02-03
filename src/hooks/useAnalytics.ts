import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Types for analytics data
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

/**
 * Get Daily Active Users count
 */
export const useDAU = () => {
  return useQuery({
    queryKey: ["analytics", "dau"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('get_dau');
      if (error) {
        console.error("Error fetching DAU:", error);
        return 0;
      }
      return data || 0;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Get Weekly Active Users count
 */
export const useWAU = () => {
  return useQuery({
    queryKey: ["analytics", "wau"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('get_wau');
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
      const { data, error } = await supabase.rpc('get_mau');
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
      const { data, error } = await supabase.rpc('get_active_users_by_period', {
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
      
      const { data, error } = await supabase.rpc('get_quiz_funnel', params);
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
      const { data, error } = await supabase.rpc('get_total_shares');
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
      const { data, error } = await supabase.rpc('get_avg_completion_time');
      if (error) {
        console.error("Error fetching avg completion time:", error);
        return 60; // Default 60 seconds
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
      const { data, error } = await supabase.rpc('get_retention_cohorts', {
        weeks_back: weeksBack,
      });
      if (error) {
        console.error("Error fetching retention:", error);
        return [];
      }
      return data || [];
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
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
      
      const { data, error } = await supabase.rpc('get_event_stats', params);
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
      const { data, error } = await supabase.rpc('get_top_quizzes_by_completions', {
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
      const { data, error } = await supabase.rpc('get_user_sources', {
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
