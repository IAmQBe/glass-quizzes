import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface Challenge {
  id: string;
  challenger_id: string;
  opponent_id: string;
  quiz_id: string | null;
  category: string | null;
  status: string;
  challenger_score: number | null;
  opponent_score: number | null;
  winner_id: string | null;
  created_at: string;
  expires_at: string;
}

interface PvpRoom {
  id: string;
  code: string;
  host_id: string;
  guest_id: string | null;
  category: string | null;
  quiz_id: string | null;
  status: string;
  host_score: number;
  guest_score: number;
  current_question: number;
  winner_id: string | null;
  created_at: string;
}

// Check if can challenge user (1 hour cooldown)
export const useCanChallenge = (opponentId: string | undefined) => {
  return useQuery({
    queryKey: ["canChallenge", opponentId],
    queryFn: async () => {
      if (!opponentId) return false;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .rpc("can_challenge_user", {
          challenger: user.id,
          opponent: opponentId
        });

      if (error) {
        console.error("Error checking challenge cooldown:", error);
        return false;
      }
      
      return data as boolean;
    },
    enabled: !!opponentId,
  });
};

// Get user's pending challenges
export const usePendingChallenges = () => {
  return useQuery({
    queryKey: ["pendingChallenges"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .eq("opponent_id", user.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Challenge[];
    },
  });
};

// Create a challenge
export const useCreateChallenge = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ opponentId, category }: { opponentId: string; category?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("challenges")
        .insert({
          challenger_id: user.id,
          opponent_id: opponentId,
          category: category || null,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingChallenges"] });
      queryClient.invalidateQueries({ queryKey: ["canChallenge"] });
      toast({ title: "Вызов отправлен! ⚔️" });
    },
    onError: (error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });
};

// Respond to a challenge
export const useRespondToChallenge = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ challengeId, accept }: { challengeId: string; accept: boolean }) => {
      const { data, error } = await supabase
        .from("challenges")
        .update({
          status: accept ? "accepted" : "declined",
          started_at: accept ? new Date().toISOString() : null,
        })
        .eq("id", challengeId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pendingChallenges"] });
      toast({ 
        title: data.status === "accepted" ? "Вызов принят! 🎮" : "Вызов отклонен" 
      });
    },
  });
};

// Create PvP room
export const useCreatePvpRoom = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ category }: { category?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Generate a random room code
      const { data: codeData } = await supabase.rpc("generate_room_code");
      const code = codeData as string;

      const { data, error } = await supabase
        .from("pvp_rooms")
        .insert({
          host_id: user.id,
          code,
          category: category || null,
          status: "waiting",
        })
        .select()
        .single();

      if (error) throw error;
      return data as PvpRoom;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pvpRoom"] });
    },
  });
};

// Join PvP room by code
export const useJoinPvpRoom = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (code: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Find room by code
      const { data: room, error: findError } = await supabase
        .from("pvp_rooms")
        .select("*")
        .eq("code", code.toUpperCase())
        .eq("status", "waiting")
        .is("guest_id", null)
        .single();

      if (findError || !room) {
        throw new Error("Комната не найдена или уже занята");
      }

      // Join the room
      const { data, error } = await supabase
        .from("pvp_rooms")
        .update({
          guest_id: user.id,
          status: "selecting",
        })
        .eq("id", room.id)
        .select()
        .single();

      if (error) throw error;
      return data as PvpRoom;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pvpRoom"] });
      toast({ title: "Вы присоединились к комнате! 🎮" });
    },
    onError: (error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });
};

// Get current PvP room
export const usePvpRoom = (roomId: string | null) => {
  return useQuery({
    queryKey: ["pvpRoom", roomId],
    queryFn: async () => {
      if (!roomId) return null;

      const { data, error } = await supabase
        .from("pvp_rooms")
        .select("*")
        .eq("id", roomId)
        .single();

      if (error) throw error;
      return data as PvpRoom;
    },
    enabled: !!roomId,
  });
};

// Subscribe to PvP room updates
export const usePvpRoomSubscription = (roomId: string | null, onUpdate: (room: PvpRoom) => void) => {
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`pvp-room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pvp_rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) {
            onUpdate(payload.new as PvpRoom);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, onUpdate]);
};

// Update PvP room (select quiz, update scores, etc.)
export const useUpdatePvpRoom = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roomId, updates }: { roomId: string; updates: Partial<PvpRoom> }) => {
      const { data, error } = await supabase
        .from("pvp_rooms")
        .update(updates)
        .eq("id", roomId)
        .select()
        .single();

      if (error) throw error;
      return data as PvpRoom;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pvpRoom"] });
    },
  });
};
