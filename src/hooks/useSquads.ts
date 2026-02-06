import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramUser } from "@/lib/telegram";

export interface Squad {
  id: string;
  telegram_chat_id: number;
  title: string;
  username: string | null;
  type: string;
  member_count: number;
  total_popcorns: number;
  avatar_url: string | null;
  invite_link: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SquadLeaderboardEntry extends Squad {
  rank: number;
}

// Get squad leaderboard
export const useSquadLeaderboard = (limit: number = 10, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["squadLeaderboard", limit],
    queryFn: async (): Promise<SquadLeaderboardEntry[]> => {
      const { data, error } = await supabase
        .rpc("get_squad_leaderboard", { p_limit: limit });

      if (error) throw error;
      return data || [];
    },
    enabled,
  });
};

// Get current user's squad
export const useMySquad = () => {
  return useQuery({
    queryKey: ["mySquad"],
    queryFn: async (): Promise<Squad | null> => {
      const tgUser = getTelegramUser();
      if (!tgUser?.id) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("squad_id")
        .eq("telegram_id", tgUser.id)
        .maybeSingle();

      if (!profile?.squad_id) return null;

      const { data, error } = await supabase
        .from("squads")
        .select("*")
        .eq("id", profile.squad_id)
        .single();

      if (error) return null;
      return data as Squad;
    },
  });
};

// Check if user can change squad
export const useCanChangeSquad = () => {
  return useQuery({
    queryKey: ["canChangeSquad"],
    queryFn: async (): Promise<{ canChange: boolean; nextChangeAt?: Date }> => {
      const tgUser = getTelegramUser();
      if (!tgUser?.id) return { canChange: true };

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, squad_joined_at")
        .eq("telegram_id", tgUser.id)
        .maybeSingle();

      if (!profile) return { canChange: true };

      const { data } = await supabase
        .rpc("can_change_squad", { p_user_id: profile.id });

      if (data === true) return { canChange: true };

      // Calculate next change date
      const joinedAt = new Date(profile.squad_joined_at);
      const nextChangeAt = new Date(joinedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

      return { canChange: false, nextChangeAt };
    },
  });
};

// Join a squad
export const useJoinSquad = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (squadId: string) => {
      const tgUser = getTelegramUser();
      if (!tgUser?.id) throw new Error("Войдите через Telegram");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("telegram_id", tgUser.id)
        .maybeSingle();

      if (!profile) throw new Error("Профиль не найден");

      const { data, error } = await supabase
        .rpc("join_squad", { p_user_id: profile.id, p_squad_id: squadId });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mySquad"] });
      queryClient.invalidateQueries({ queryKey: ["canChangeSquad"] });
      queryClient.invalidateQueries({ queryKey: ["squadLeaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["currentProfile"] });
    },
  });
};

// Leave current squad
export const useLeaveSquad = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const tgUser = getTelegramUser();
      if (!tgUser?.id) throw new Error("Войдите через Telegram");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("telegram_id", tgUser.id)
        .maybeSingle();

      if (!profile) throw new Error("Профиль не найден");

      const { data, error } = await supabase
        .rpc("leave_squad", { p_user_id: profile.id });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mySquad"] });
      queryClient.invalidateQueries({ queryKey: ["canChangeSquad"] });
      queryClient.invalidateQueries({ queryKey: ["squadLeaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["currentProfile"] });
    },
  });
};

// Get all active squads
export const useSquads = () => {
  return useQuery({
    queryKey: ["squads"],
    queryFn: async (): Promise<Squad[]> => {
      const { data, error } = await supabase
        .from("squads")
        .select("*")
        .eq("is_active", true)
        .order("total_popcorns", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};
