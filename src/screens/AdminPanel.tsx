import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Trash2, Eye, EyeOff, Loader2, Trophy, Settings, Gift, ExternalLink, BarChart3, Sparkles, Pencil, CheckCircle2, XCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { haptic } from "@/lib/telegram";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAllTasks, useCreateTask, useUpdateTask, useDeleteTask } from "@/hooks/useTasks";
import { AdminAnalytics } from "@/components/AdminAnalytics";
import { useAdminPersonalityTests, useModeratePersonalityTest, usePersonalityTestWithDetails } from "@/hooks/usePersonalityTests";
import { useQuizWithQuestions } from "@/hooks/useQuizzes";
import { formatQuestionCount } from "@/lib/utils";
import { PredictionModerationTab } from "@/components/admin/PredictionModerationTab";
import { RolePreviewMode } from "@/hooks/useRolePreview";
import {
  MODERATION_SETTINGS_KEY,
  buildModerationSettingsValue,
  parseManualModerationEnabled,
} from "@/lib/moderationSettings";

interface AdminPanelProps {
  onBack: () => void;
  onOpenPrediction?: (predictionId: string) => void;
  onCreateTest?: () => void;
  onCreatePrediction?: () => void;
  rolePreviewMode: RolePreviewMode;
  onRolePreviewChange: (mode: RolePreviewMode) => void;
}

type Tab = "analytics" | "predictions" | "quizzes" | "tests" | "banners" | "tasks" | "seasons";

interface LeaderboardConfig {
  season_duration_days: number;
  cup_thresholds: {
    gold: number;
    silver: number;
    bronze: number;
  };
}

type ModerationPreviewItem = {
  type: "quiz" | "test";
  id: string;
};

type CreatorRecord = {
  id: string;
  first_name: string | null;
  username: string | null;
};

const TASK_ICONS = ["🎯", "📢", "👥", "🎁", "⭐", "🔔", "💎", "🏆"];
const TASK_TYPE_OPTIONS = [
  { value: "link", label: "Открыть ссылку" },
  { value: "subscribe_channel", label: "Подписка на канал" },
  { value: "channel_boost", label: "Буст канала" },
  { value: "telegram_premium", label: "Telegram Premium" },
];

const TASK_TYPE_LABELS: Record<string, string> = {
  link: "Ссылка",
  subscribe_channel: "Подписка",
  channel_boost: "Буст",
  telegram_premium: "Premium",
};
const ROLE_PREVIEW_OPTIONS: Array<{ mode: RolePreviewMode; label: string }> = [
  { mode: "real", label: "Реально" },
  { mode: "admin", label: "Как admin" },
  { mode: "user", label: "Как user" },
];

export const AdminPanel = ({ onBack, onOpenPrediction, onCreateTest, onCreatePrediction, rolePreviewMode, onRolePreviewChange }: AdminPanelProps) => {
  const [activeTab, setActiveTab] = useState<Tab>("analytics");
  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewQuiz, setShowNewQuiz] = useState(false);
  const [showNewBanner, setShowNewBanner] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    reward_amount: 10,
    task_type: "link",
    action_url: "",
    icon: "🎯",
  });
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTask, setEditTask] = useState({
    title: "",
    description: "",
    reward_amount: 10,
    task_type: "link",
    action_url: "",
    icon: "🎯",
    is_active: true,
  });
  const [newQuiz, setNewQuiz] = useState({
    title: "",
    description: "",
    duration_seconds: 60,
    is_published: false,
  });
  const [newBanner, setNewBanner] = useState({
    title: "",
    description: "",
    image_url: "",
    link_url: "",
    link_type: "external" as "external" | "internal",
    is_active: true,
  });
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [editBanner, setEditBanner] = useState({
    title: "",
    description: "",
    image_url: "",
    link_url: "",
    link_type: "external" as "external" | "internal",
    is_active: true,
  });
  const [previewItem, setPreviewItem] = useState<ModerationPreviewItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
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

  // Tasks
  const { data: tasks = [], isLoading: tasksLoading } = useAllTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  // Personality Tests
  const { data: allTests = [], isLoading: testsLoading } = useAdminPersonalityTests();
  const moderateTest = useModeratePersonalityTest();

  const { data: previewQuizData, isLoading: previewQuizLoading } = useQuizWithQuestions(
    previewItem?.type === "quiz" ? previewItem.id : null
  );
  const { data: previewTestData, isLoading: previewTestLoading } = usePersonalityTestWithDetails(
    previewItem?.type === "test" ? previewItem.id : null
  );

  const creatorIds = useMemo(() => {
    const source = [
      ...quizzes.map((quiz: any) => quiz.created_by).filter(Boolean),
      ...allTests.map((test: any) => test.created_by).filter(Boolean),
    ] as string[];
    return Array.from(new Set(source));
  }, [quizzes, allTests]);

  const { data: creatorsMap = {} } = useQuery({
    queryKey: ["admin", "creators", creatorIds.join(",")],
    enabled: creatorIds.length > 0,
    queryFn: async (): Promise<Record<string, CreatorRecord>> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, username")
        .in("id", creatorIds);

      if (error) throw error;
      const rows = (data || []) as CreatorRecord[];
      return rows.reduce<Record<string, CreatorRecord>>((acc, row) => {
        acc[row.id] = row;
        return acc;
      }, {});
    },
  });

  const { data: moderationSettingsRow, isLoading: moderationSettingsLoading } = useQuery({
    queryKey: ["admin", MODERATION_SETTINGS_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .eq("key", MODERATION_SETTINGS_KEY)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const manualModerationEnabled = parseManualModerationEnabled(moderationSettingsRow?.value);

  const updateModerationSettings = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert(
          {
            key: MODERATION_SETTINGS_KEY,
            value: buildModerationSettingsValue(enabled),
          },
          { onConflict: "key" }
        );

      if (error) throw error;
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["admin", MODERATION_SETTINGS_KEY] });
      toast({
        title: enabled ? "Фильтрация включена" : "Фильтрация отключена",
        description: enabled
          ? "Новый контент снова идет на ручную модерацию."
          : "Новый контент публикуется автоматически.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Не удалось обновить фильтрацию",
        description: error?.message || "Попробуйте еще раз",
        variant: "destructive",
      });
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

  // Moderate quiz with status + rejection reason
  const moderateQuiz = useMutation({
    mutationFn: async ({
      quizId,
      action,
      rejectionReason,
    }: {
      quizId: string;
      action: "approve" | "reject";
      rejectionReason?: string;
    }) => {
      const now = new Date().toISOString();
      const normalizedReason = rejectionReason?.trim() || null;
      const primaryPayload = action === "approve"
        ? {
            is_published: true,
            status: "published",
            rejection_reason: null,
            moderated_at: now,
          }
        : {
            is_published: false,
            status: "rejected",
            rejection_reason: normalizedReason || "Причина не указана",
            moderated_at: now,
          };

      const { data, error } = await (supabase as any)
        .from("quizzes")
        .update(primaryPayload)
        .eq("id", quizId)
        .select()
        .single();

      if (error) {
        // Legacy fallback if moderation columns are missing
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("quizzes")
          .update({ is_published: action === "approve" })
          .eq("id", quizId)
          .select()
          .single();

        if (fallbackError) throw error;
        return fallbackData;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "quizzes"] });
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      queryClient.invalidateQueries({ queryKey: ["quiz"] });
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

  // Create quiz
  const createQuiz = useMutation({
    mutationFn: async (quiz: typeof newQuiz) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("quizzes")
        .insert({
          title: quiz.title,
          description: quiz.description || null,
          duration_seconds: quiz.duration_seconds,
          is_published: quiz.is_published,
          created_by: user?.id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "quizzes"] });
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      toast({ title: "Quiz created! 🎉" });
      setShowNewQuiz(false);
      setNewQuiz({ title: "", description: "", duration_seconds: 60, is_published: false });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Create banner
  const createBanner = useMutation({
    mutationFn: async (banner: typeof newBanner) => {
      const { data, error } = await supabase
        .from("banners")
        .insert({
          title: banner.title,
          description: banner.description || null,
          image_url: banner.image_url,
          link_url: banner.link_url || null,
          link_type: banner.link_type,
          is_active: banner.is_active,
          display_order: banners.length,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "banners"] });
      queryClient.invalidateQueries({ queryKey: ["banners"] });
      toast({ title: "Banner created! 🎨" });
      setShowNewBanner(false);
      setNewBanner({ title: "", description: "", image_url: "", link_url: "", link_type: "external", is_active: true });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update banner
  const updateBanner = useMutation({
    mutationFn: async ({ id, banner }: { id: string; banner: typeof editBanner }) => {
      const { data, error } = await supabase
        .from("banners")
        .update({
          title: banner.title,
          description: banner.description || null,
          image_url: banner.image_url,
          link_url: banner.link_url || null,
          link_type: banner.link_type,
          is_active: banner.is_active,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "banners"] });
      queryClient.invalidateQueries({ queryKey: ["banners"] });
      toast({ title: "Banner updated! ✅" });
      setEditingBannerId(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const startEditBanner = (banner: any) => {
    setEditingBannerId(banner.id);
    setEditBanner({
      title: banner.title,
      description: banner.description || "",
      image_url: banner.image_url,
      link_url: banner.link_url || "",
      link_type: banner.link_type,
      is_active: banner.is_active,
    });
  };

  const handleBack = () => {
    if (previewItem) {
      haptic.selection();
      closePreview();
      return;
    }
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

  const handleCreateTask = () => {
    if (!newTask.title.trim()) {
      toast({ title: "Введите название задания", variant: "destructive" });
      return;
    }
    const requiresActionUrl = newTask.task_type === "link" || newTask.task_type === "subscribe_channel" || newTask.task_type === "channel_boost";
    if (requiresActionUrl && !newTask.action_url.trim()) {
      toast({ title: "Укажите ссылку или канал для задания", variant: "destructive" });
      return;
    }
    createTask.mutate({
      title: newTask.title,
      description: newTask.description || null,
      reward_type: "popcorns",
      reward_amount: newTask.reward_amount,
      task_type: newTask.task_type,
      action_url: newTask.action_url || null,
      icon: newTask.icon,
      is_active: true,
      display_order: tasks.length,
    });
    setNewTask({ title: "", description: "", reward_amount: 10, task_type: "link", action_url: "", icon: "🎯" });
    setShowNewTask(false);
  };

  const startEditTask = (task: any) => {
    setEditingTaskId(task.id);
    setEditTask({
      title: task.title || "",
      description: task.description || "",
      reward_amount: Number(task.reward_amount || 0),
      task_type: task.task_type || "link",
      action_url: task.action_url || "",
      icon: task.icon || "🎯",
      is_active: Boolean(task.is_active),
    });
  };

  const getCreatorDisplay = (createdBy: string | null, isAnonymous?: boolean) => {
    if (isAnonymous) return "UNNAMED";
    if (!createdBy) return "Автор неизвестен";
    const creator = creatorsMap[createdBy];
    if (!creator) return `Автор ${createdBy.slice(0, 6)}`;
    return creator.first_name || creator.username || `Автор ${createdBy.slice(0, 6)}`;
  };

  const openPreview = (item: ModerationPreviewItem, initialRejectReason?: string | null) => {
    setRejectReason(initialRejectReason || "");
    setPreviewItem(item);
  };

  const closePreview = () => {
    setPreviewItem(null);
    setRejectReason("");
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col p-5 safe-bottom pb-32"
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

      <div className="tg-section p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-foreground">Режим просмотра приложения</p>
          {rolePreviewMode !== "real" && (
            <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              DEBUG
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {ROLE_PREVIEW_OPTIONS.map((option) => (
            <button
              key={option.mode}
              className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors ${rolePreviewMode === option.mode
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground"
                }`}
              onClick={() => {
                haptic.selection();
                onRolePreviewChange(option.mode);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Меняется только отображение интерфейса. Роль в базе не изменяется.
        </p>
      </div>

      <div className="tg-section p-4 mb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Фильтрация контента</p>
            <p className="text-xs text-muted-foreground mt-1">
              {manualModerationEnabled
                ? "Вкл: тесты/квизы/события проходят ручную модерацию."
                : "Выкл: тесты/квизы/события публикуются сразу в прод."}
            </p>
          </div>
          <Switch
            checked={manualModerationEnabled}
            disabled={moderationSettingsLoading || updateModerationSettings.isPending}
            onCheckedChange={(checked) => {
              haptic.selection();
              updateModerationSettings.mutate(checked);
            }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {(["analytics", "predictions", "quizzes", "tests", "banners", "tasks", "seasons"] as Tab[]).map((tab) => (
          <button
            key={tab}
            className={`py-2 px-3 rounded-xl font-medium transition-colors whitespace-nowrap text-sm flex items-center gap-1 ${activeTab === tab
              ? tab === "tests" ? "bg-purple-500 text-white" : "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground"
              }`}
            onClick={() => {
              haptic.selection();
              setPreviewItem(null);
              setActiveTab(tab);
            }}
          >
            {tab === "analytics" && <><BarChart3 className="w-4 h-4" /> Stats</>}
            {tab === "predictions" && <>Predictions</>}
            {tab === "quizzes" && `Quizzes (${quizzes.length})`}
            {tab === "tests" && <><Sparkles className="w-4 h-4" /> Tests ({allTests.length})</>}
            {tab === "banners" && `Banners (${banners.length})`}
            {tab === "tasks" && <><Gift className="w-4 h-4" /> Tasks ({tasks.length})</>}
            {tab === "seasons" && <><Trophy className="w-4 h-4" /> Seasons</>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {previewItem ? (
          <div className="space-y-3">
            <button
              className="w-full tg-section p-3 text-left text-sm text-primary"
              onClick={() => {
                haptic.selection();
                closePreview();
              }}
            >
              ← Назад к списку
            </button>

            {(previewQuizLoading || previewTestLoading) ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : previewItem.type === "quiz" ? (
              <div className="tg-section p-4 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Квиз</p>
                  <h3 className="text-lg font-semibold text-foreground">{previewQuizData?.quiz?.title || "Без названия"}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Автор: {getCreatorDisplay((previewQuizData?.quiz as any)?.created_by || null, (previewQuizData?.quiz as any)?.is_anonymous)}
                  </p>
                  {previewQuizData?.quiz?.description && (
                    <p className="text-sm text-muted-foreground mt-2">{previewQuizData.quiz.description}</p>
                  )}
                </div>

                {(previewQuizData?.quiz as any)?.image_url && (
                  <img
                    src={(previewQuizData?.quiz as any).image_url}
                    alt={previewQuizData?.quiz?.title || "Quiz cover"}
                    className="w-full rounded-xl object-cover max-h-56"
                  />
                )}

                <div className="text-xs text-muted-foreground">
                  {formatQuestionCount((previewQuizData?.questions || []).length)} · {(previewQuizData?.quiz as any)?.participant_count || 0} участий
                </div>

                <div className="space-y-3">
                  {(previewQuizData?.questions || []).map((question: any, index: number) => (
                    <div key={question.id} className="bg-secondary rounded-xl p-3 space-y-2">
                      <p className="text-sm font-medium text-foreground">Q{index + 1}. {question.question_text}</p>
                      {question.image_url && (
                        <img
                          src={question.image_url}
                          alt={`Question ${index + 1}`}
                          className="w-full rounded-lg object-cover max-h-44"
                        />
                      )}
                      <div className="space-y-1">
                        {(question.options || []).map((option: any, optionIndex: number) => (
                          <p
                            key={`${question.id}_${optionIndex}`}
                            className={`text-xs px-2 py-1 rounded ${optionIndex === question.correct_answer
                              ? "bg-green-500/15 text-green-600 dark:text-green-400"
                              : "bg-background text-muted-foreground"
                              }`}
                          >
                            {optionIndex + 1}. {option?.text || "Без текста"}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Причина отклонения</label>
                  <Input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Что исправить перед повторной отправкой"
                    className="bg-secondary border-0"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    className="flex-1 py-2.5 rounded-xl bg-green-500/15 text-green-600 dark:text-green-400 font-medium flex items-center justify-center gap-2"
                    onClick={() => {
                      const quizId = previewQuizData?.quiz?.id;
                      if (!quizId) return;
                      moderateQuiz.mutate(
                        { quizId, action: "approve" },
                        {
                          onSuccess: () => {
                            toast({ title: "Квиз опубликован" });
                            closePreview();
                          },
                        }
                      );
                    }}
                    disabled={moderateQuiz.isPending}
                  >
                    {moderateQuiz.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Опубликовать
                  </button>
                  <button
                    className="flex-1 py-2.5 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 font-medium flex items-center justify-center gap-2"
                    onClick={() => {
                      const quizId = previewQuizData?.quiz?.id;
                      if (!quizId) return;
                      if (!rejectReason.trim()) {
                        toast({ title: "Укажи причину отклонения", variant: "destructive" });
                        return;
                      }
                      moderateQuiz.mutate(
                        { quizId, action: "reject", rejectionReason: rejectReason },
                        {
                          onSuccess: () => {
                            toast({ title: "Квиз отклонён" });
                            closePreview();
                          },
                        }
                      );
                    }}
                    disabled={moderateQuiz.isPending}
                  >
                    {moderateQuiz.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    Отклонить
                  </button>
                </div>
              </div>
            ) : (
              <div className="tg-section p-4 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Тест личности</p>
                  <h3 className="text-lg font-semibold text-foreground">{previewTestData?.test?.title || "Без названия"}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Автор: {getCreatorDisplay((previewTestData?.test as any)?.created_by || null, (previewTestData?.test as any)?.is_anonymous)}
                  </p>
                  {previewTestData?.test?.description && (
                    <p className="text-sm text-muted-foreground mt-2">{previewTestData.test.description}</p>
                  )}
                </div>

                {(previewTestData?.test as any)?.image_url && (
                  <img
                    src={(previewTestData?.test as any).image_url}
                    alt={previewTestData?.test?.title || "Test cover"}
                    className="w-full rounded-xl object-cover max-h-56"
                  />
                )}

                <div className="text-xs text-muted-foreground">
                  {formatQuestionCount((previewTestData?.questions || []).length)} · {(previewTestData?.results || []).length} результатов
                </div>

                <div className="space-y-3">
                  {(previewTestData?.questions || []).map((question: any, index: number) => (
                    <div key={question.id} className="bg-secondary rounded-xl p-3 space-y-2">
                      <p className="text-sm font-medium text-foreground">Q{index + 1}. {question.question_text}</p>
                      {question.image_url && (
                        <img
                          src={question.image_url}
                          alt={`Question ${index + 1}`}
                          className="w-full rounded-lg object-cover max-h-44"
                        />
                      )}
                      <div className="space-y-1">
                        {(question.answers || []).map((answer: any, answerIndex: number) => (
                          <p key={`${question.id}_${answer.id || answerIndex}`} className="text-xs px-2 py-1 rounded bg-background text-muted-foreground">
                            {answerIndex + 1}. {answer.answer_text}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Причина отклонения</label>
                  <Input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Что исправить перед повторной отправкой"
                    className="bg-secondary border-0"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    className="flex-1 py-2.5 rounded-xl bg-green-500/15 text-green-600 dark:text-green-400 font-medium flex items-center justify-center gap-2"
                    onClick={() => {
                      const testId = previewTestData?.test?.id;
                      if (!testId) return;
                      moderateTest.mutate(
                        { testId, action: "approve" },
                        {
                          onSuccess: () => {
                            toast({ title: "Тест опубликован" });
                            closePreview();
                          },
                        }
                      );
                    }}
                    disabled={moderateTest.isPending}
                  >
                    {moderateTest.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Опубликовать
                  </button>
                  <button
                    className="flex-1 py-2.5 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 font-medium flex items-center justify-center gap-2"
                    onClick={() => {
                      const testId = previewTestData?.test?.id;
                      if (!testId) return;
                      if (!rejectReason.trim()) {
                        toast({ title: "Укажи причину отклонения", variant: "destructive" });
                        return;
                      }
                      moderateTest.mutate(
                        { testId, action: "reject", rejectionReason: rejectReason },
                        {
                          onSuccess: () => {
                            toast({ title: "Тест отклонён" });
                            closePreview();
                          },
                        }
                      );
                    }}
                    disabled={moderateTest.isPending}
                  >
                    {moderateTest.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    Отклонить
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
        {activeTab === "analytics" && (
          <AdminAnalytics />
        )}

        {activeTab === "predictions" && (
          <>
            <button
              className="w-full tg-section p-4 flex items-center justify-center gap-2 text-primary font-medium"
              onClick={() => {
                haptic.selection();
                if (onCreatePrediction) {
                  onCreatePrediction();
                  return;
                }
                toast({ title: "Создание события пока недоступно", variant: "destructive" });
              }}
            >
              <Plus className="w-5 h-5" />
              Создать событие
            </button>
            <PredictionModerationTab onOpenPrediction={onOpenPrediction} />
          </>
        )}

        {activeTab === "quizzes" && (
          <>
            {/* Add Quiz Button */}
            <button
              className="w-full tg-section p-4 flex items-center justify-center gap-2 text-primary font-medium"
              onClick={() => {
                haptic.selection();
                setShowNewQuiz(!showNewQuiz);
              }}
            >
              <Plus className="w-5 h-5" />
              Создать квиз
            </button>

            {/* New Quiz Form */}
            {showNewQuiz && (
              <motion.div
                className="tg-section p-4 space-y-4"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
              >
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Название *</label>
                  <Input
                    value={newQuiz.title}
                    onChange={(e) => setNewQuiz({ ...newQuiz, title: e.target.value })}
                    placeholder="Как хорошо ты знаешь React?"
                    className="bg-secondary border-0"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Описание</label>
                  <Input
                    value={newQuiz.description}
                    onChange={(e) => setNewQuiz({ ...newQuiz, description: e.target.value })}
                    placeholder="Проверь свои знания"
                    className="bg-secondary border-0"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Время на вопрос (сек)</label>
                  <div className="flex gap-2">
                    {[10, 15, 20, 30, 60].map((d) => (
                      <button
                        key={d}
                        onClick={() => setNewQuiz({ ...newQuiz, duration_seconds: d })}
                        className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${newQuiz.duration_seconds === d
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground"
                          }`}
                      >
                        {d}s
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Опубликовать сразу</span>
                  <Switch
                    checked={newQuiz.is_published}
                    onCheckedChange={(checked) => setNewQuiz({ ...newQuiz, is_published: checked })}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    className="flex-1 tg-button py-3"
                    onClick={() => {
                      if (!newQuiz.title.trim()) {
                        toast({ title: "Введите название", variant: "destructive" });
                        return;
                      }
                      createQuiz.mutate(newQuiz);
                    }}
                    disabled={createQuiz.isPending}
                  >
                    {createQuiz.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : (
                      "Создать"
                    )}
                  </button>
                  <button
                    className="tg-button-secondary py-3 px-4"
                    onClick={() => setShowNewQuiz(false)}
                  >
                    Отмена
                  </button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  💡 После создания добавьте вопросы через редактирование
                </p>
              </motion.div>
            )}

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
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Автор: {getCreatorDisplay((quiz as any).created_by || null, (quiz as any).is_anonymous)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {quiz.question_count} questions · {quiz.participant_count} participants
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${(quiz as any).status === "pending"
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                        : quiz.is_published
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                          : (quiz as any).status === "rejected"
                            ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                            : "bg-secondary text-muted-foreground"
                        }`}
                    >
                      {(quiz as any).status === "pending"
                        ? "На модерации"
                        : (quiz as any).status === "rejected"
                          ? "Отклонён"
                          : quiz.is_published
                            ? "Published"
                            : "Draft"}
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
                      className="px-3 py-2 rounded-lg bg-secondary text-foreground text-sm flex items-center gap-1"
                      onClick={() => {
                        haptic.selection();
                        openPreview({ type: "quiz", id: quiz.id }, (quiz as any).rejection_reason || "");
                      }}
                    >
                      <Eye className="w-4 h-4" />
                      Preview
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

        {activeTab === "tests" && (
          <>
            <button
              className="w-full tg-section p-4 flex items-center justify-center gap-2 text-primary font-medium"
              onClick={() => {
                haptic.selection();
                if (onCreateTest) {
                  onCreateTest();
                  return;
                }
                toast({ title: "Создание теста пока недоступно", variant: "destructive" });
              }}
            >
              <Plus className="w-5 h-5" />
              Создать тест
            </button>
            {testsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
              </div>
            ) : allTests.length === 0 ? (
              <div className="tg-section p-6 text-center">
                <Sparkles className="w-10 h-10 text-purple-500 mx-auto mb-3" />
                <p className="text-muted-foreground">Нет тестов</p>
              </div>
            ) : (
              allTests.map((test: any) => (
                <div key={test.id} className="tg-section p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        <h3 className="font-semibold text-foreground">{test.title}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Автор: {getCreatorDisplay(test.created_by || null, test.is_anonymous)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatQuestionCount(test.question_count)} · {test.result_count} результатов · {test.participant_count} участий
                      </p>
                      {test.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{test.description}</p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${test.is_published
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : test.status === "rejected"
                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                        : test.status === "pending"
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                          : "bg-secondary text-muted-foreground"
                      }`}>
                      {test.is_published ? "Published" : test.status === "rejected" ? "Отклонён" : test.status === "pending" ? "На модерации" : "Draft"}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      className="flex-1 py-2 text-sm flex items-center justify-center gap-1 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 font-medium"
                      onClick={() => {
                        haptic.notification('success');
                        moderateTest.mutate({ testId: test.id, action: "approve" });
                        toast({ title: "Тест опубликован!" });
                      }}
                    >
                      <Eye className="w-4 h-4" />
                      Одобрить
                    </button>
                    <button
                      className="px-3 py-2 text-sm flex items-center justify-center gap-1 rounded-xl bg-secondary text-foreground font-medium"
                      onClick={() => {
                        haptic.selection();
                        openPreview({ type: "test", id: test.id }, test.rejection_reason || "");
                      }}
                    >
                      <Eye className="w-4 h-4" />
                      Preview
                    </button>
                    <button
                      className="py-2 px-3 text-sm flex items-center justify-center gap-1 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 font-medium"
                      onClick={() => {
                        haptic.notification('warning');
                        if (confirm("Отклонить этот тест? Это скроет его из публикации.")) {
                          moderateTest.mutate({ testId: test.id, action: "reject", rejectionReason: "Отклонено админом" });
                          toast({ title: "Тест отклонён" });
                        }
                      }}
                    >
                      <EyeOff className="w-4 h-4" />
                      Отклонить
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === "banners" && (
          <>
            {/* Add Banner Button */}
            <button
              className="w-full tg-section p-4 flex items-center justify-center gap-2 text-primary font-medium"
              onClick={() => {
                haptic.selection();
                setShowNewBanner(!showNewBanner);
              }}
            >
              <Plus className="w-5 h-5" />
              Добавить баннер
            </button>

            {/* New Banner Form */}
            {showNewBanner && (
              <motion.div
                className="tg-section p-4 space-y-4"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
              >
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Заголовок *</label>
                  <Input
                    value={newBanner.title}
                    onChange={(e) => setNewBanner({ ...newBanner, title: e.target.value })}
                    placeholder="Новый квиз недели!"
                    className="bg-secondary border-0"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Описание</label>
                  <Input
                    value={newBanner.description}
                    onChange={(e) => setNewBanner({ ...newBanner, description: e.target.value })}
                    placeholder="Проверь себя"
                    className="bg-secondary border-0"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">URL изображения *</label>
                  <Input
                    value={newBanner.image_url}
                    onChange={(e) => setNewBanner({ ...newBanner, image_url: e.target.value })}
                    placeholder="https://..."
                    className="bg-secondary border-0"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Ссылка</label>
                  <Input
                    value={newBanner.link_url}
                    onChange={(e) => setNewBanner({ ...newBanner, link_url: e.target.value })}
                    placeholder="https://..."
                    className="bg-secondary border-0"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Тип ссылки</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewBanner({ ...newBanner, link_type: "internal" })}
                      className={`px-3 py-1 rounded-lg text-sm ${newBanner.link_type === "internal"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground"
                        }`}
                    >
                      Внутренняя
                    </button>
                    <button
                      onClick={() => setNewBanner({ ...newBanner, link_type: "external" })}
                      className={`px-3 py-1 rounded-lg text-sm ${newBanner.link_type === "external"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground"
                        }`}
                    >
                      Внешняя
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Активен</span>
                  <Switch
                    checked={newBanner.is_active}
                    onCheckedChange={(checked) => setNewBanner({ ...newBanner, is_active: checked })}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    className="flex-1 tg-button py-3"
                    onClick={() => {
                      if (!newBanner.title.trim() || !newBanner.image_url.trim()) {
                        toast({ title: "Заполните обязательные поля", variant: "destructive" });
                        return;
                      }
                      createBanner.mutate(newBanner);
                    }}
                    disabled={createBanner.isPending}
                  >
                    {createBanner.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : (
                      "Создать"
                    )}
                  </button>
                  <button
                    className="tg-button-secondary py-3 px-4"
                    onClick={() => setShowNewBanner(false)}
                  >
                    Отмена
                  </button>
                </div>
              </motion.div>
            )}

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
                  {editingBannerId === banner.id ? (
                    /* Edit Form */
                    <motion.div
                      className="p-4 space-y-4"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Заголовок</label>
                        <Input
                          value={editBanner.title}
                          onChange={(e) => setEditBanner({ ...editBanner, title: e.target.value })}
                          className="bg-secondary border-0"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Описание</label>
                        <Input
                          value={editBanner.description}
                          onChange={(e) => setEditBanner({ ...editBanner, description: e.target.value })}
                          className="bg-secondary border-0"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">URL изображения</label>
                        <Input
                          value={editBanner.image_url}
                          onChange={(e) => setEditBanner({ ...editBanner, image_url: e.target.value })}
                          className="bg-secondary border-0"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Ссылка</label>
                        <Input
                          value={editBanner.link_url}
                          onChange={(e) => setEditBanner({ ...editBanner, link_url: e.target.value })}
                          className="bg-secondary border-0"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Тип ссылки</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditBanner({ ...editBanner, link_type: "internal" })}
                            className={`px-3 py-1 rounded-lg text-sm ${editBanner.link_type === "internal" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
                          >
                            Внутренняя
                          </button>
                          <button
                            onClick={() => setEditBanner({ ...editBanner, link_type: "external" })}
                            className={`px-3 py-1 rounded-lg text-sm ${editBanner.link_type === "external" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
                          >
                            Внешняя
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Показывать на главной</span>
                        <Switch
                          checked={editBanner.is_active}
                          onCheckedChange={(checked) => setEditBanner({ ...editBanner, is_active: checked })}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 tg-button py-2"
                          onClick={() => updateBanner.mutate({ id: banner.id, banner: editBanner })}
                          disabled={updateBanner.isPending}
                        >
                          {updateBanner.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Сохранить"}
                        </button>
                        <button
                          className="tg-button-secondary py-2 px-4"
                          onClick={() => setEditingBannerId(null)}
                        >
                          Отмена
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    /* View Mode */
                    <>
                      <div className="aspect-[3/1] bg-secondary relative">
                        <img
                          src={banner.image_url}
                          alt={banner.title}
                          className="w-full h-full object-cover"
                        />
                        {!banner.is_active && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-white text-sm font-medium">Скрыт</span>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground">{banner.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              {banner.description || (banner.link_type === "external" ? "External link" : "Internal link")}
                            </p>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${banner.is_active
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                              : "bg-secondary text-muted-foreground"
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
                              startEditBanner(banner);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                            Edit
                          </button>
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
                    </>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {activeTab === "tasks" && (
          <>
            {/* Add Task Button */}
            <button
              className="w-full tg-section p-4 flex items-center justify-center gap-2 text-primary font-medium"
              onClick={() => {
                haptic.selection();
                setShowNewTask(!showNewTask);
              }}
            >
              <Plus className="w-5 h-5" />
              Добавить задание
            </button>

            {/* New Task Form */}
            {showNewTask && (
              <motion.div
                className="tg-section p-4 space-y-4"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
              >
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Название</label>
                  <Input
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="Подпишись на канал"
                    className="bg-secondary border-0"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Описание (опционально)</label>
                  <Input
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Получи бонус за подписку"
                    className="bg-secondary border-0"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Тип задания</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TASK_TYPE_OPTIONS.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setNewTask({ ...newTask, task_type: type.value })}
                        className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${newTask.task_type === type.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground"
                          }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {newTask.task_type !== "telegram_premium" && (
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">
                      {newTask.task_type === "channel_boost" ? "Канал для буста" : "Ссылка / канал"}
                    </label>
                    <Input
                      value={newTask.action_url}
                      onChange={(e) => setNewTask({ ...newTask, action_url: e.target.value })}
                      placeholder={newTask.task_type === "link" ? "https://..." : "https://t.me/channel или @channel"}
                      className="bg-secondary border-0"
                    />
                  </div>
                )}

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-sm text-muted-foreground mb-2 block">Награда (попкорны)</label>
                    <Input
                      type="number"
                      value={newTask.reward_amount}
                      onChange={(e) => setNewTask({ ...newTask, reward_amount: parseInt(e.target.value) || 0 })}
                      className="bg-secondary border-0"
                      min={1}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Иконка</label>
                    <div className="flex gap-1 flex-wrap">
                      {TASK_ICONS.map((icon) => (
                        <button
                          key={icon}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${newTask.icon === icon ? "bg-primary/20" : "bg-secondary"
                            }`}
                          onClick={() => setNewTask({ ...newTask, icon })}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    className="flex-1 tg-button py-3"
                    onClick={handleCreateTask}
                    disabled={createTask.isPending}
                  >
                    {createTask.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : (
                      "Создать"
                    )}
                  </button>
                  <button
                    className="tg-button-secondary py-3 px-4"
                    onClick={() => setShowNewTask(false)}
                  >
                    Отмена
                  </button>
                </div>
              </motion.div>
            )}

            {/* Tasks List */}
            {tasksLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="tg-section p-6 text-center">
                <p className="text-muted-foreground">Нет заданий</p>
              </div>
            ) : (
              tasks.map((task: any) => (
                <div key={task.id} className="tg-section p-4">
                  {editingTaskId === task.id ? (
                    <motion.div
                      className="space-y-4"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Название</label>
                        <Input
                          value={editTask.title}
                          onChange={(e) => setEditTask({ ...editTask, title: e.target.value })}
                          className="bg-secondary border-0"
                        />
                      </div>

                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Описание</label>
                        <Input
                          value={editTask.description}
                          onChange={(e) => setEditTask({ ...editTask, description: e.target.value })}
                          className="bg-secondary border-0"
                        />
                      </div>

                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Тип задания</label>
                        <div className="grid grid-cols-2 gap-2">
                          {TASK_TYPE_OPTIONS.map((type) => (
                            <button
                              key={type.value}
                              type="button"
                              onClick={() => setEditTask({ ...editTask, task_type: type.value })}
                              className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${editTask.task_type === type.value
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-foreground"
                                }`}
                            >
                              {type.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {editTask.task_type !== "telegram_premium" && (
                        <div>
                          <label className="text-sm text-muted-foreground mb-2 block">Ссылка / канал</label>
                          <Input
                            value={editTask.action_url}
                            onChange={(e) => setEditTask({ ...editTask, action_url: e.target.value })}
                            className="bg-secondary border-0"
                          />
                        </div>
                      )}

                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="text-sm text-muted-foreground mb-2 block">Награда</label>
                          <Input
                            type="number"
                            value={editTask.reward_amount}
                            onChange={(e) => setEditTask({ ...editTask, reward_amount: parseInt(e.target.value) || 0 })}
                            className="bg-secondary border-0"
                            min={1}
                          />
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground mb-2 block">Иконка</label>
                          <div className="flex gap-1 flex-wrap">
                            {TASK_ICONS.map((icon) => (
                              <button
                                key={icon}
                                type="button"
                                className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${editTask.icon === icon ? "bg-primary/20" : "bg-secondary"
                                  }`}
                                onClick={() => setEditTask({ ...editTask, icon })}
                              >
                                {icon}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Активно</span>
                        <Switch
                          checked={editTask.is_active}
                          onCheckedChange={(checked) => setEditTask({ ...editTask, is_active: checked })}
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          className="flex-1 tg-button py-2"
                          onClick={() => {
                            const requiresActionUrl = editTask.task_type === "link" || editTask.task_type === "subscribe_channel" || editTask.task_type === "channel_boost";
                            if (!editTask.title.trim()) {
                              toast({ title: "Введите название задания", variant: "destructive" });
                              return;
                            }
                            if (requiresActionUrl && !editTask.action_url.trim()) {
                              toast({ title: "Укажите ссылку или канал", variant: "destructive" });
                              return;
                            }

                            updateTask.mutate(
                              {
                                id: task.id,
                                title: editTask.title,
                                description: editTask.description || null,
                                reward_amount: editTask.reward_amount,
                                task_type: editTask.task_type,
                                action_url: editTask.task_type === "telegram_premium" ? null : (editTask.action_url || null),
                                icon: editTask.icon,
                                is_active: editTask.is_active,
                              },
                              {
                                onSuccess: () => {
                                  setEditingTaskId(null);
                                  toast({ title: "Задание обновлено" });
                                },
                              }
                            );
                          }}
                          disabled={updateTask.isPending}
                        >
                          {updateTask.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Сохранить"}
                        </button>
                        <button
                          className="tg-button-secondary py-2 px-4"
                          onClick={() => setEditingTaskId(null)}
                        >
                          Отмена
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{task.icon}</span>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground">{task.title}</h3>
                          {task.description && (
                            <p className="text-sm text-muted-foreground">{task.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                              {TASK_TYPE_LABELS[task.task_type] || task.task_type}
                            </span>
                            {task.action_url && (
                              <p className="text-xs text-primary flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" />
                                {task.action_url}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-primary">+{task.reward_amount}</span>
                          <p className="text-xs text-muted-foreground">попкорнов</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Активно</span>
                          <Switch
                            checked={task.is_active}
                            onCheckedChange={() => {
                              updateTask.mutate({ id: task.id, is_active: !task.is_active });
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="px-3 py-2 rounded-lg bg-secondary text-foreground text-sm flex items-center gap-1"
                            onClick={() => {
                              haptic.selection();
                              startEditTask(task);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            className="p-2 bg-destructive/10 rounded-lg text-destructive"
                            onClick={() => {
                              haptic.notification('warning');
                              if (confirm("Удалить задание?")) {
                                deleteTask.mutate(task.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
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
          </>
        )}
      </div>
    </motion.div>
  );
};
