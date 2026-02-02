import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Trash2, Eye, EyeOff, Loader2, Trophy, Settings } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { haptic } from "@/lib/telegram";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

interface AdminPanelProps {
  onBack: () => void;
}

type Tab = "quizzes" | "banners" | "seasons";

interface LeaderboardConfig {
  season_duration_days: number;
  cup_thresholds: {
    gold: number;
    silver: number;
    bronze: number;
  };
}

export const AdminPanel = ({ onBack }: AdminPanelProps) => {
  const [activeTab, setActiveTab] = useState<Tab>("quizzes");
  const queryClient = useQueryClient();

  // Fetch all quizzes (admin view)
  const { data: quizzes = [], isLoading: quizzesLoading } = useQuery({
    queryKey: ["admin", "quizzes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all banners (admin view)
  const { data: banners = [], isLoading: bannersLoading } = useQuery({
    queryKey: ["admin", "banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch leaderboard config
  const { data: leaderboardConfig, isLoading: configLoading } = useQuery({
    queryKey: ["admin", "leaderboard_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("key", "leaderboard_config")
        .single();
      if (error) throw error;
      return data?.value as unknown as LeaderboardConfig;
    },
  });

  // Update leaderboard config
  const updateConfig = useMutation({
    mutationFn: async (config: LeaderboardConfig) => {
      const { error } = await supabase
        .from("app_settings")
        .update({ value: JSON.parse(JSON.stringify(config)) })
        .eq("key", "leaderboard_config");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "leaderboard_config"] });
      toast({ title: "Настройки сохранены" });
    },
  });

  // Toggle quiz publish status
  const toggleQuizPublish = useMutation({
    mutationFn: async ({ id, is_published }: { id: string; is_published: boolean }) => {
      const { error } = await supabase
        .from("quizzes")
        .update({ is_published: !is_published })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "quizzes"] });
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      toast({ title: "Quiz updated" });
    },
  });

  // Toggle banner active status
  const toggleBannerActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("banners")
        .update({ is_active: !is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "banners"] });
      queryClient.invalidateQueries({ queryKey: ["banners"] });
      toast({ title: "Banner updated" });
    },
  });

  // Delete quiz
  const deleteQuiz = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quizzes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "quizzes"] });
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      toast({ title: "Quiz deleted" });
    },
  });

  // Delete banner
  const deleteBanner = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "banners"] });
      queryClient.invalidateQueries({ queryKey: ["banners"] });
      toast({ title: "Banner deleted" });
    },
  });

  const handleBack = () => {
    haptic.selection();
    onBack();
  };

  const handleSaveConfig = (field: keyof LeaderboardConfig | string, value: number) => {
    if (!leaderboardConfig) return;
    
    let newConfig = { ...leaderboardConfig };
    
    if (field === "season_duration_days") {
      newConfig.season_duration_days = value;
    } else if (field.startsWith("cup_")) {
      const cupType = field.replace("cup_", "") as keyof typeof newConfig.cup_thresholds;
      newConfig.cup_thresholds = {
        ...newConfig.cup_thresholds,
        [cupType]: value,
      };
    }
    
    updateConfig.mutate(newConfig);
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col p-5 safe-bottom"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="flex items-center mb-6">
        <button className="p-2 -ml-2 text-primary" onClick={handleBack}>
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold text-foreground pr-8">
          Admin Panel
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        <button
          className={`flex-1 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap px-3 ${
            activeTab === "quizzes"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground"
          }`}
          onClick={() => {
            haptic.selection();
            setActiveTab("quizzes");
          }}
        >
          Quizzes ({quizzes.length})
        </button>
        <button
          className={`flex-1 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap px-3 ${
            activeTab === "banners"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground"
          }`}
          onClick={() => {
            haptic.selection();
            setActiveTab("banners");
          }}
        >
          Banners ({banners.length})
        </button>
        <button
          className={`flex-1 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap px-3 flex items-center justify-center gap-1 ${
            activeTab === "seasons"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground"
          }`}
          onClick={() => {
            haptic.selection();
            setActiveTab("seasons");
          }}
        >
          <Trophy className="w-4 h-4" />
          Seasons
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {activeTab === "quizzes" && (
          <>
            {quizzesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : quizzes.length === 0 ? (
              <div className="tg-section p-6 text-center">
                <p className="text-muted-foreground">No quizzes yet</p>
              </div>
            ) : (
              quizzes.map((quiz) => (
                <div key={quiz.id} className="tg-section p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{quiz.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {quiz.question_count} questions · {quiz.participant_count} participants
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        quiz.is_published
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {quiz.is_published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      className="flex-1 tg-button-secondary py-2 text-sm flex items-center justify-center gap-1"
                      onClick={() => {
                        haptic.selection();
                        toggleQuizPublish.mutate({ id: quiz.id, is_published: quiz.is_published });
                      }}
                    >
                      {quiz.is_published ? (
                        <>
                          <EyeOff className="w-4 h-4" />
                          Unpublish
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          Publish
                        </>
                      )}
                    </button>
                    <button
                      className="p-2 bg-destructive/10 rounded-lg text-destructive"
                      onClick={() => {
                        haptic.notification('warning');
                        if (confirm("Delete this quiz?")) {
                          deleteQuiz.mutate(quiz.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === "banners" && (
          <>
            {bannersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : banners.length === 0 ? (
              <div className="tg-section p-6 text-center">
                <p className="text-muted-foreground">No banners yet</p>
              </div>
            ) : (
              banners.map((banner) => (
                <div key={banner.id} className="tg-section overflow-hidden">
                  <div className="aspect-[3/1] bg-secondary">
                    <img
                      src={banner.image_url}
                      alt={banner.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{banner.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {banner.link_type === "external" ? "External link" : "Internal link"}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          banner.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {banner.is_active ? "Active" : "Hidden"}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        className="flex-1 tg-button-secondary py-2 text-sm flex items-center justify-center gap-1"
                        onClick={() => {
                          haptic.selection();
                          toggleBannerActive.mutate({ id: banner.id, is_active: banner.is_active });
                        }}
                      >
                        {banner.is_active ? (
                          <>
                            <EyeOff className="w-4 h-4" />
                            Hide
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4" />
                            Show
                          </>
                        )}
                      </button>
                      <button
                        className="p-2 bg-destructive/10 rounded-lg text-destructive"
                        onClick={() => {
                          haptic.notification('warning');
                          if (confirm("Delete this banner?")) {
                            deleteBanner.mutate(banner.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === "seasons" && (
          <>
            {configLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Season Duration */}
                <div className="tg-section p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Настройки сезона</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">
                        Длительность сезона (дней)
                      </label>
                      <Input
                        type="number"
                        value={leaderboardConfig?.season_duration_days ?? 30}
                        onChange={(e) => handleSaveConfig("season_duration_days", parseInt(e.target.value) || 30)}
                        className="bg-secondary border-0"
                        min={1}
                        max={365}
                      />
                    </div>
                  </div>
                </div>

                {/* Cup Thresholds */}
                <div className="tg-section p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    <h3 className="font-semibold text-foreground">Пороги для кубков</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                        <span className="text-lg">🥇</span> Золото (минимум очков)
                      </label>
                      <Input
                        type="number"
                        value={leaderboardConfig?.cup_thresholds?.gold ?? 1000}
                        onChange={(e) => handleSaveConfig("cup_gold", parseInt(e.target.value) || 1000)}
                        className="bg-secondary border-0"
                        min={0}
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                        <span className="text-lg">🥈</span> Серебро (минимум очков)
                      </label>
                      <Input
                        type="number"
                        value={leaderboardConfig?.cup_thresholds?.silver ?? 500}
                        onChange={(e) => handleSaveConfig("cup_silver", parseInt(e.target.value) || 500)}
                        className="bg-secondary border-0"
                        min={0}
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                        <span className="text-lg">🥉</span> Бронза (минимум очков)
                      </label>
                      <Input
                        type="number"
                        value={leaderboardConfig?.cup_thresholds?.bronze ?? 100}
                        onChange={(e) => handleSaveConfig("cup_bronze", parseInt(e.target.value) || 100)}
                        className="bg-secondary border-0"
                        min={0}
                      />
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="tg-section p-4 bg-primary/5">
                  <p className="text-sm text-muted-foreground">
                    💡 Пользователи получают кубки в конце сезона на основе набранных очков. Изменения применяются к следующему сезону.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Button */}
      {activeTab !== "seasons" && (
        <button
          className="tg-button mt-4 flex items-center justify-center gap-2"
          onClick={() => {
            haptic.impact('medium');
            toast({
              title: "Coming soon",
              description: `Create ${activeTab === "quizzes" ? "quiz" : "banner"} form will be added`,
            });
          }}
        >
          <Plus className="w-5 h-5" />
          Add {activeTab === "quizzes" ? "Quiz" : "Banner"}
        </button>
      )}
    </motion.div>
  );
};
