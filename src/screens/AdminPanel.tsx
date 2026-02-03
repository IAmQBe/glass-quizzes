import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Trash2, Eye, EyeOff, Loader2, Trophy, Settings, Gift, ExternalLink, BarChart3, Sparkles, Pencil } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { haptic } from "@/lib/telegram";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAllTasks, useCreateTask, useUpdateTask, useDeleteTask } from "@/hooks/useTasks";
import { AdminAnalytics } from "@/components/AdminAnalytics";
import { usePendingPersonalityTests, useModeratePersonalityTest } from "@/hooks/usePersonalityTests";

interface AdminPanelProps {
  onBack: () => void;
}

type Tab = "analytics" | "quizzes" | "tests" | "banners" | "tasks" | "seasons";

interface LeaderboardConfig {
  season_duration_days: number;
  cup_thresholds: {
    gold: number;
    silver: number;
    bronze: number;
  };
}

const TASK_ICONS = ["🎯", "📢", "👥", "🎁", "⭐", "🔔", "💎", "🏆"];

export const AdminPanel = ({ onBack }: AdminPanelProps) => {
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
  const { data: pendingTests = [], isLoading: testsLoading } = usePendingPersonalityTests();
  const moderateTest = useModeratePersonalityTest();

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

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {(["analytics", "quizzes", "tests", "banners", "tasks", "seasons"] as Tab[]).map((tab) => (
          <button
            key={tab}
            className={`py-2 px-3 rounded-xl font-medium transition-colors whitespace-nowrap text-sm flex items-center gap-1 ${activeTab === tab
                ? tab === "tests" ? "bg-purple-500 text-white" : "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground"
              }`}
            onClick={() => {
              haptic.selection();
              setActiveTab(tab);
            }}
          >
            {tab === "analytics" && <><BarChart3 className="w-4 h-4" /> Stats</>}
            {tab === "quizzes" && `Quizzes (${quizzes.length})`}
            {tab === "tests" && <><Sparkles className="w-4 h-4" /> Tests</>}
            {tab === "banners" && `Banners (${banners.length})`}
            {tab === "tasks" && <><Gift className="w-4 h-4" /> Tasks ({tasks.length})</>}
            {tab === "seasons" && <><Trophy className="w-4 h-4" /> Seasons</>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {activeTab === "analytics" && (
          <AdminAnalytics />
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
                      <p className="text-sm text-muted-foreground">
                        {quiz.question_count} questions · {quiz.participant_count} participants
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${quiz.is_published
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                          : "bg-secondary text-muted-foreground"
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

        {activeTab === "tests" && (
          <>
            {testsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
              </div>
            ) : pendingTests.length === 0 ? (
              <div className="tg-section p-6 text-center">
                <Sparkles className="w-10 h-10 text-purple-500 mx-auto mb-3" />
                <p className="text-muted-foreground">Нет тестов на модерации</p>
              </div>
            ) : (
              pendingTests.map((test) => (
                <div key={test.id} className="tg-section p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        <h3 className="font-semibold text-foreground">{test.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {test.question_count} вопросов · {test.result_count} результатов · {test.participant_count} участий
                      </p>
                      {test.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{test.description}</p>
                      )}
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                      На модерации
                    </span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      className="flex-1 py-2 text-sm flex items-center justify-center gap-1 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 font-medium"
                      onClick={() => {
                        haptic.notification('success');
                        moderateTest.mutate({ testId: test.id, publish: true });
                        toast({ title: "Тест опубликован!" });
                      }}
                    >
                      <Eye className="w-4 h-4" />
                      Одобрить
                    </button>
                    <button
                      className="flex-1 py-2 text-sm flex items-center justify-center gap-1 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 font-medium"
                      onClick={() => {
                        haptic.notification('warning');
                        if (confirm("Отклонить этот тест?")) {
                          moderateTest.mutate({ testId: test.id, publish: false });
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
                  <label className="text-sm text-muted-foreground mb-2 block">Ссылка</label>
                  <Input
                    value={newTask.action_url}
                    onChange={(e) => setNewTask({ ...newTask, action_url: e.target.value })}
                    placeholder="https://t.me/channel"
                    className="bg-secondary border-0"
                  />
                </div>

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
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{task.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{task.title}</h3>
                      {task.description && (
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                      )}
                      {task.action_url && (
                        <p className="text-xs text-primary flex items-center gap-1 mt-1">
                          <ExternalLink className="w-3 h-3" />
                          {task.action_url}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-primary">+{task.reward_amount}</span>
                      <p className="text-xs text-muted-foreground">попкорнов</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Активно</span>
                      <Switch
                        checked={task.is_active}
                        onCheckedChange={() => {
                          updateTask.mutate({ id: task.id, is_active: !task.is_active });
                        }}
                      />
                    </div>
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
    </motion.div>
  );
};
