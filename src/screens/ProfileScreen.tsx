import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { UserStats } from "@/types/quiz";
import { ArrowLeft, Trophy, Target, Globe, Bell, ChevronRight, Settings, Clock, Share2, Copy, Check, Users, Plus, Sun, Moon, Sparkles, History, Pencil, Lock, ExternalLink } from "lucide-react";
import { haptic, getTelegramUser, shareReferralLink, sharePersonalityTestResult, buildReferralUrl, resolveSquadTelegramUrl, openTelegramTarget } from "@/lib/telegram";
import { useIsAdmin } from "@/hooks/useAuth";
import { useRolePreview } from "@/hooks/useRolePreview";
import { useMyQuizzes, useMyQuizResults } from "@/hooks/useQuizzes";
import { useFavorites } from "@/hooks/useFavorites";
import { useProfile, useUpdateProfile, useReferralCount } from "@/hooks/useProfile";
import { useMyPersonalityTestCompletions, useMyPersonalityTests } from "@/hooks/usePersonalityTests";
import { useTotalPopcornsReceived } from "@/hooks/useLikes";
import { useMySquad, useSquadLeaderboard } from "@/hooks/useSquads";
import { PopcornIcon } from "@/components/icons/PopcornIcon";
import { BookmarkIcon } from "@/components/icons/BookmarkIcon";
import { GifImage } from "@/components/GifImage";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/useTheme";
import { Switch } from "@/components/ui/switch";
import { useGifAnimations } from "@/hooks/useGifAnimations";
import { formatQuestionCount } from "@/lib/utils";
import { isCurrentUserAdmin } from "@/lib/user";

// Fun avatar placeholders for users without photos
const FUNNY_AVATARS = [
  "🤓", "🧐", "🤪", "😎", "🥸", "🤠", "🦊", "🐸", "🐵", "🦄", "🎃", "👽", "🤖", "👻"
];

const getRandomAvatar = (seed: number) => {
  return FUNNY_AVATARS[seed % FUNNY_AVATARS.length];
};

const normalizeMediaUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.toLowerCase() === "null" || normalized.toLowerCase() === "undefined") return null;
  return normalized;
};

interface ProfileScreenProps {
  stats: UserStats;
  onBack: () => void;
  activeTab?: ProfileTabType;
  onTabChange?: (tab: ProfileTabType) => void;
  onOpenAdmin?: () => void;
  onQuizSelect?: (quizId: string) => void;
  onTestSelect?: (testId: string) => void;
  onEditQuiz?: (quizId: string) => void;
  onEditTest?: (testId: string) => void;
  onOpenSquadList?: () => void;
  onOpenCreateSquad?: () => void;
}

type FilterType = "date" | "popularity";
export type ProfileTabType = "my" | "saved" | "history";

export const ProfileScreen = ({
  stats,
  onBack,
  activeTab: controlledActiveTab,
  onTabChange,
  onOpenAdmin,
  onQuizSelect,
  onTestSelect,
  onEditQuiz,
  onEditTest,
  onOpenSquadList,
  onOpenCreateSquad,
}: ProfileScreenProps) => {
  const user = getTelegramUser();
  const { data: isAdmin } = useIsAdmin();
  const { data: isRealAdmin } = useIsAdmin({ respectRolePreview: false });
  const { rolePreviewMode } = useRolePreview();
  const { data: myQuizzes = [], isLoading: myQuizzesLoading } = useMyQuizzes();
  const { data: myTests = [], isLoading: myTestsLoading } = useMyPersonalityTests();
  const { data: quizResults = [], isLoading: quizResultsLoading } = useMyQuizResults();
  const { data: testCompletions = [], isLoading: completionsLoading } = useMyPersonalityTestCompletions();
  const { data: favorites = [], isLoading: favoritesLoading } = useFavorites();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: referralCount = 0 } = useReferralCount();
  const { data: totalPopcorns = 0 } = useTotalPopcornsReceived();
  const { data: mySquad } = useMySquad();
  const { data: squadLeaderboard = [] } = useSquadLeaderboard(100);
  const updateProfile = useUpdateProfile();
  const { isDark, toggleTheme } = useTheme();
  const { animationsEnabled, setAnimationsEnabled } = useGifAnimations();

  // Find my squad rank
  const mySquadRank = mySquad ? squadLeaderboard.findIndex(s => s.id === mySquad.id) + 1 : 0;
  const canOpenAdminPanel = Boolean(onOpenAdmin && (isRealAdmin || isCurrentUserAdmin()));

  const [localActiveTab, setLocalActiveTab] = useState<ProfileTabType>(controlledActiveTab ?? "my");
  const activeTab = controlledActiveTab ?? localActiveTab;
  const [sortBy, setSortBy] = useState<FilterType>("date");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (controlledActiveTab !== undefined) {
      setLocalActiveTab(controlledActiveTab);
    }
  }, [controlledActiveTab]);

  const handleActiveTabChange = (tab: ProfileTabType) => {
    if (controlledActiveTab === undefined) {
      setLocalActiveTab(tab);
    }
    onTabChange?.(tab);
  };

  const handleBack = () => {
    haptic.selection();
    onBack();
  };

  const handleCopyReferral = () => {
    if (profile?.referral_code) {
      const referralUrl = buildReferralUrl(profile.referral_code);
      navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      haptic.notification('success');
      toast({ title: "Ссылка скопирована!" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareReferral = () => {
    haptic.impact('medium');
    // Use referral_code if available, otherwise use telegram_id
    const code = profile?.referral_code || user?.id?.toString() || '';
    if (code) {
      shareReferralLink(code);
    } else {
      toast({ title: "Не удалось создать ссылку", variant: "destructive" });
    }
  };

  const handleToggleNotifications = (enabled: boolean) => {
    if (profile) {
      haptic.selection();
      updateProfile.mutate({
        challenge_notifications_enabled: enabled
      });
    }
  };

  // Calculate actual stats
  const safeQuizResults = Array.isArray(quizResults) ? quizResults : [];
  const safeTestCompletions = Array.isArray(testCompletions) ? testCompletions : [];
  const totalTestsCompleted = safeQuizResults.length + safeTestCompletions.length;
  const totalCreated = myQuizzes.length + myTests.length;
  const hasHistoryItems = safeQuizResults.length > 0 || safeTestCompletions.length > 0;
  const historyIsInitialLoading = (quizResultsLoading || completionsLoading) && !hasHistoryItems;

  const statItems = [
    { icon: Target, label: "Пройдено", value: totalTestsCompleted, color: "text-primary" },
    { icon: Sparkles, label: "Создано", value: totalCreated, color: "text-purple-500" },
    { icon: PopcornIcon, label: "Попкорн", value: totalPopcorns, color: "text-orange-500" },
  ];

  // Sort quizzes
  const sortedMyQuizzes = [...myQuizzes].sort((a, b) => {
    if (sortBy === "popularity") {
      return b.participant_count - a.participant_count;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const savedQuizzes = favorites
    .filter((f) => f.quizzes)
    .map((f) => ({ ...f.quizzes, type: 'quiz' as const }));

  const savedTests = favorites
    .filter((f) => f.personality_tests)
    .map((f) => ({ ...f.personality_tests, type: 'test' as const }));

  // Combine and sort by created_at
  const allSaved = [...savedQuizzes, ...savedTests].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <motion.div
      className="flex flex-col min-h-screen safe-bottom-nav"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="sticky top-0 bg-background/80 backdrop-blur-lg z-10 px-4 py-3 border-b border-border">
        <div className="flex items-center">
          <button className="p-2 -ml-2 text-primary" onClick={handleBack}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold text-foreground pr-8">
            Profile
          </h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Avatar & Name */}
        <motion.div
          className="flex flex-col items-center"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="w-20 h-20 mb-3 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-2 border-primary/20">
            {user?.photo_url ? (
              <img
                src={user.photo_url}
                alt={user.first_name || 'Avatar'}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-4xl">{getRandomAvatar(user?.id || 0)}</span>
            )}
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            {user?.first_name || 'Player'}
          </h2>
          {user?.username && (
            <p className="text-sm text-muted-foreground">@{user.username}</p>
          )}
          {isAdmin && (
            <span className="mt-2 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
              Admin
            </span>
          )}

          {/* Squad Badge */}
          {mySquad && (
            <button
              onClick={() => {
                haptic.impact('light');
                const url = resolveSquadTelegramUrl({
                  username: mySquad.username,
                  inviteLink: mySquad.invite_link,
                });

                if (!url) {
                  toast({
                    title: "Ссылка недоступна",
                    description: "У команды пока нет корректной ссылки.",
                  });
                  return;
                }

                if (!openTelegramTarget(url)) {
                  toast({
                    title: "Не удалось открыть ссылку",
                    description: "Попробуй еще раз чуть позже.",
                  });
                }
              }}
              className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-500 text-sm font-medium"
            >
              <PopcornIcon className="w-4 h-4" />
              {mySquad.title}
              {mySquadRank > 0 && (
                <span className="text-xs opacity-75">#{mySquadRank}</span>
              )}
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          className="grid grid-cols-3 gap-2"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {statItems.map((item, index) => (
            <motion.div
              key={item.label}
              className="tg-stat px-3 py-4"
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 + index * 0.05 }}
            >
              <item.icon className={`w-5 h-5 mx-auto mb-1.5 ${item.color}`} />
              <p className="text-lg font-bold text-foreground">{item.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Squad CTA */}
        <motion.div
          className="tg-section p-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.23 }}
        >
          <div className="flex items-center justify-between mb-3 gap-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <PopcornIcon className="w-5 h-5 text-orange-500" />
              Создай команду
            </h3>
            {mySquad && (
              <span className="text-xs text-muted-foreground truncate">
                Ты в: {mySquad.title}
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground mb-3">
            Объедини своё сообщество и соревнуйтесь с другими командами
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                haptic.impact('medium');
                onOpenCreateSquad?.();
              }}
              className="h-10 rounded-xl text-sm font-semibold bg-primary text-primary-foreground flex items-center justify-center gap-2 cta-join cta-join-btn"
            >
              <span className="cta-join-shine" aria-hidden />
              <span className="cta-join-content">
                <Plus className="w-4 h-4" />
                Создать
              </span>
            </button>

            <button
              onClick={() => {
                haptic.impact('medium');
                onOpenSquadList?.();
              }}
              className="h-10 rounded-xl text-sm font-semibold bg-secondary text-primary flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Users className="w-4 h-4" />
              {mySquad ? "Сменить" : "Вступить"}
            </button>
          </div>
        </motion.div>

        {/* Referral Section */}
        <motion.div
          className="tg-section p-4 space-y-3"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <span className="font-medium text-foreground">Пригласить друзей</span>
            <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {referralCount} приглашений
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Приглашай друзей и получай бонусы за каждого нового пользователя
          </p>

          <button
            onClick={handleShareReferral}
            className="tg-button w-full flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Пригласить друга
          </button>

          {profile?.referral_code && (
            <button
              onClick={handleCopyReferral}
              className="tg-button-secondary w-full flex items-center justify-center gap-2 text-sm"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  Скопировано!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Скопировать ссылку
                </>
              )}
            </button>
          )}
        </motion.div>

        {/* Settings Section */}
        <motion.div
          className="tg-section"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.28 }}
        >
          {/* Theme Toggle */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              {isDark ? (
                <Moon className="w-5 h-5 text-primary" />
              ) : (
                <Sun className="w-5 h-5 text-amber-500" />
              )}
              <div>
                <span className="text-foreground font-medium">Тема</span>
                <p className="text-xs text-muted-foreground">{isDark ? "Тёмная тема" : "Светлая тема"}</p>
              </div>
            </div>
            <button
              onClick={() => {
                haptic.selection();
                toggleTheme();
              }}
              className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-amber-500" />
              ) : (
                <Moon className="w-5 h-5 text-primary" />
              )}
            </button>
          </div>

          {/* Notifications Toggle (Telegram users only) */}
          {user?.id && (
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-primary" />
                <div>
                  <span className="text-foreground font-medium">Уведомления</span>
                  <p className="text-xs text-muted-foreground">
                    {profile?.challenge_notifications_enabled ? "Включены" : "Выключены"}
                  </p>
                </div>
              </div>
              <Switch
                checked={profile?.challenge_notifications_enabled ?? true}
                onCheckedChange={(value) => handleToggleNotifications(value)}
                disabled={!profile}
              />
            </div>
          )}

          {/* GIF Animations Toggle */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <div>
                <span className="text-foreground font-medium">Анимации GIF</span>
                <p className="text-xs text-muted-foreground">
                  {animationsEnabled ? "Включены" : "Выключены"}
                </p>
              </div>
            </div>
            <Switch
              checked={animationsEnabled}
              onCheckedChange={(value) => {
                haptic.selection();
                setAnimationsEnabled(value);
              }}
            />
          </div>

          {/* Admin Button */}
          {canOpenAdminPanel && (
            <button
              className="w-full flex items-center justify-between p-4"
              onClick={() => {
                haptic.impact('medium');
                onOpenAdmin?.();
              }}
            >
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-primary" />
                <div className="text-left">
                  <p className="text-foreground font-medium leading-tight">Admin Panel</p>
                  {rolePreviewMode !== "real" && (
                    <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                      Просмотр: {rolePreviewMode === "admin" ? "admin" : "user"}
                    </p>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
        </motion.div>

        {/* Tabs: My / Saved / Results */}
        <motion.div
          className="flex gap-2"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          <button
            className={`flex-1 py-2 rounded-xl font-medium transition-colors flex items-center justify-center gap-1 text-sm ${activeTab === "my"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground"
              }`}
            onClick={() => {
              haptic.selection();
              handleActiveTabChange("my");
            }}
          >
            <Target className="w-3.5 h-3.5" />
            Мои ({(myQuizzes?.length || 0) + (myTests?.length || 0)})
          </button>
          <button
            className={`flex-1 py-2 rounded-xl font-medium transition-colors flex items-center justify-center gap-1 text-sm ${activeTab === "history"
              ? "bg-purple-500 text-white"
              : "bg-secondary text-foreground"
              }`}
            onClick={() => {
              haptic.selection();
              handleActiveTabChange("history");
            }}
          >
            <History className="w-3.5 h-3.5" />
            История ({safeQuizResults.length + safeTestCompletions.length})
          </button>
          <button
            className={`flex-1 py-2 rounded-xl font-medium transition-colors flex items-center justify-center gap-1 text-sm ${activeTab === "saved"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground"
              }`}
            onClick={() => {
              haptic.selection();
              handleActiveTabChange("saved");
            }}
          >
            <BookmarkIcon className="w-3.5 h-3.5" />
            Избранное
          </button>
        </motion.div>

        {/* Sort Filters (for My Quizzes) */}
        {activeTab === "my" && myQuizzes.length > 0 && (
          <motion.div
            className="flex gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <button
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${sortBy === "date"
                ? "bg-primary/10 text-primary"
                : "bg-secondary text-muted-foreground"
                }`}
              onClick={() => {
                haptic.selection();
                setSortBy("date");
              }}
            >
              <Clock className="w-3.5 h-3.5" />
              Date
            </button>
            <button
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${sortBy === "popularity"
                ? "bg-primary/10 text-primary"
                : "bg-secondary text-muted-foreground"
                }`}
              onClick={() => {
                haptic.selection();
                setSortBy("popularity");
              }}
            >
              <PopcornIcon className="w-3.5 h-3.5" />
              Popularity
            </button>
          </motion.div>
        )}

        {/* Quizzes List */}
        <motion.div
          className="space-y-3"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {activeTab === "my" && (
            <>
              {(myQuizzesLoading || myTestsLoading) ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : (sortedMyQuizzes.length === 0 && myTests.length === 0) ? (
                <div className="tg-section p-6 text-center">
                  <p className="text-muted-foreground">Ты ещё ничего не создал</p>
                </div>
              ) : (
                <>
                  {/* My Quizzes */}
                  {sortedMyQuizzes.map((quiz) => (
                    <QuizListItem
                      key={quiz.id}
                      quiz={quiz}
                      onClick={() => onQuizSelect?.(quiz.id)}
                      onEdit={onEditQuiz ? () => onEditQuiz(quiz.id) : undefined}
                    />
                  ))}
                  {/* My Tests */}
                  {myTests.map((test: any) => {
                    const isDraft = !test.is_published;
                    const isPending = test.status === "pending" || test.status === "reviewing";
                    const canEdit = isDraft && !isPending && onEditTest;

                    return (
                      <div key={test.id} className="tg-section p-4">
                        <div className="flex items-center gap-3">
                          {test.image_url ? (
                            <GifImage src={test.image_url} alt={test.title} className="w-12 h-12 rounded-lg object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                              <Sparkles className="w-6 h-6 text-purple-500" />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-500">Тест</span>
                              <h3 className="font-medium text-foreground">{test.title}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {formatQuestionCount(test.question_count)} · {test.participant_count || 0} участий
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {canEdit && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  haptic.impact('light');
                                  onEditTest(test.id);
                                }}
                                className="p-2 rounded-lg bg-secondary hover:bg-secondary/80"
                              >
                                <Pencil className="w-4 h-4 text-purple-500" />
                              </button>
                            )}
                            <span className={`text-xs px-2 py-1 rounded-full ${test.is_published
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : isPending
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                : 'bg-secondary text-muted-foreground'
                              }`}>
                              {test.is_published ? "Опубликован" : isPending ? "На проверке" : "Черновик"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}

          {activeTab === "saved" && (
            <>
              {favoritesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : allSaved.length === 0 ? (
                <div className="tg-section p-6 text-center">
                  <BookmarkIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Нет сохранённого контента</p>
                  <p className="text-xs text-muted-foreground mt-1">Нажми закладку на квизе или тесте чтобы сохранить</p>
                </div>
              ) : (
                allSaved.map((item: any) => {
                  const canOpenCard = item.type === "quiz" ? Boolean(onQuizSelect) : Boolean(onTestSelect);
                  const openSavedCard = () => {
                    if (!canOpenCard) return;
                    haptic.impact('light');
                    if (item.type === "quiz") {
                      onQuizSelect?.(item.id);
                    } else {
                      onTestSelect?.(item.id);
                    }
                  };
                  const handleSavedCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openSavedCard();
                    }
                  };
                  const isAnonymous = item.is_anonymous === true;
                  const creatorName = isAnonymous
                    ? 'Анонимный автор'
                    : (item.creator?.first_name || item.creator?.username || null);
                  const squadTitle = !isAnonymous ? item.creator?.squad?.title || null : null;

                  return (
                    <div
                      key={item.id}
                      className={`tg-section p-4 ${canOpenCard ? "cursor-pointer active:scale-[0.995]" : ""}`}
                      onClick={openSavedCard}
                      onKeyDown={handleSavedCardKeyDown}
                      role={canOpenCard ? "button" : undefined}
                      tabIndex={canOpenCard ? 0 : undefined}
                    >
                      <div className="flex items-center gap-3">
                        {item.image_url ? (
                          <GifImage src={item.image_url} alt={item.title} className="w-14 h-14 rounded-xl object-cover" />
                        ) : (
                          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${item.type === 'test' ? 'bg-purple-500/20' : 'bg-primary/20'}`}>
                            {item.type === 'test' ? (
                              <Sparkles className="w-6 h-6 text-purple-500" />
                            ) : (
                              <Target className="w-6 h-6 text-primary" />
                            )}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${item.type === 'test' ? 'bg-purple-500/20 text-purple-500' : 'bg-primary/20 text-primary'}`}>
                              {item.type === 'test' ? 'Тест' : 'Квиз'}
                            </span>
                          </div>
                          <h3 className="font-medium text-foreground truncate">{item.title}</h3>
                          <CreatorMeta creatorName={creatorName} squadTitle={squadTitle} accentClass="text-primary" />
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {item.participant_count || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <PopcornIcon className="w-3 h-3 text-orange-500" />
                              {item.like_count || 0}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {activeTab === "history" && (
            <>
              {historyIsInitialLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                </div>
              ) : !hasHistoryItems ? (
                <div className="tg-section p-6 text-center">
                  <History className="w-10 h-10 text-purple-500 mx-auto mb-3" />
                  <p className="text-muted-foreground">Ты ещё ничего не прошёл</p>
                </div>
              ) : (
                <>
                  {(quizResultsLoading || completionsLoading) && (
                    <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Обновляем историю...
                    </div>
                  )}
                  {/* Quiz Results */}
                  {safeQuizResults.map((result: any) => (
                    <div key={result.id} className="tg-section p-4">
                      <div className="flex items-center gap-3">
                        {result.quiz?.image_url ? (
                          <GifImage src={result.quiz.image_url} alt={result.quiz.title} className="w-12 h-12 rounded-lg object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                            <Trophy className="w-6 h-6 text-primary" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">Квиз</span>
                            <h3 className="font-medium text-foreground">{result.quiz?.title || 'Квиз'}</h3>
                          </div>
                          {(() => {
                            const isAnonymous = result.quiz?.is_anonymous === true;
                            const creatorName = isAnonymous
                              ? 'Анонимный автор'
                              : (result.quiz?.creator?.first_name || result.quiz?.creator?.username || null);
                            const squadTitle = !isAnonymous ? result.quiz?.creator?.squad?.title || null : null;

                            return <CreatorMeta creatorName={creatorName} squadTitle={squadTitle} accentClass="text-primary" />;
                          })()}
                          <p className="text-sm text-muted-foreground">
                            {result.score}/{result.max_score} правильных · {result.percentile}%
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-primary">{Math.round((result.score / result.max_score) * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Personality Test Completions */}
                  {safeTestCompletions.map((completion: any) => (
                    <TestResultItem
                      key={completion.id}
                      completion={completion}
                      onShare={() => {
                        if (completion.result && completion.test) {
                          haptic.notification('success');
                          sharePersonalityTestResult(
                            completion.result.title,
                            completion.result.share_text || completion.result.description,
                            completion.test.id,
                            completion.test.title,
                            completion.result.image_url
                          );
                        }
                      }}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};

// Quiz List Item Component
const QuizListItem = ({ quiz, onClick, onEdit }: { quiz: any; onClick: () => void; onEdit?: () => void }) => {
  const isDraft = !quiz.is_published;
  const isPending = quiz.status === "pending" || quiz.status === "reviewing";
  const canEdit = isDraft && !isPending && onEdit;

  return (
    <div className="tg-section w-full p-4">
      <div className="flex items-center gap-3">
        <button
          className="flex-1 flex items-center gap-3 text-left"
          onClick={() => {
            haptic.impact('light');
            onClick();
          }}
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
            {quiz.image_url ? (
              <GifImage src={quiz.image_url} alt={quiz.title} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl">📝</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground line-clamp-1">{quiz.title}</h3>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              <span>{formatQuestionCount(quiz.question_count)}</span>
              <span>{quiz.participant_count} участий</span>
              {(quiz.like_count ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <PopcornIcon className="w-3 h-3 text-amber-500" />
                  {quiz.like_count}
                </span>
              )}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                haptic.impact('light');
                onEdit();
              }}
              className="p-2 rounded-lg bg-secondary hover:bg-secondary/80"
            >
              <Pencil className="w-4 h-4 text-primary" />
            </button>
          )}
          <span
            className={`text-xs px-2 py-1 rounded-full ${quiz.is_published
              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
              : isPending
                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                : "bg-secondary text-muted-foreground"
              }`}
          >
            {quiz.is_published ? "Опубликован" : isPending ? "На проверке" : "Черновик"}
          </span>
        </div>
      </div>
    </div>
  );
};

const CreatorMeta = ({
  creatorName,
  squadTitle,
  accentClass,
}: {
  creatorName: string | null;
  squadTitle?: string | null;
  accentClass: string;
}) => {
  if (!creatorName && !squadTitle) return null;

  return (
    <div className="mt-0.5 space-y-0.5 text-xs min-w-0">
      {creatorName && <p className="text-muted-foreground truncate">Автор: {creatorName}</p>}
      {squadTitle && (
        <p className={`flex items-center gap-1 min-w-0 ${accentClass}`}>
          <PopcornIcon className="w-3 h-3 shrink-0" />
          <span className="truncate">Команда: {squadTitle}</span>
        </p>
      )}
    </div>
  );
};

// Test Result Item Component
const TestResultItem = ({ completion, onShare }: { completion: any; onShare: () => void }) => {
  const result = completion.result;
  const test = completion.test;
  const canShare = Boolean(result && test);
  const resultTitle = result?.title || "Результат теста";
  const testTitle = test?.title || "Тест";
  const resultDescription = result?.description || "Детали результата временно недоступны.";
  const primaryImageUrl = normalizeMediaUrl(result?.image_url);
  const fallbackImageUrl = normalizeMediaUrl(test?.image_url);
  const [imageUrl, setImageUrl] = useState<string | null>(primaryImageUrl || fallbackImageUrl);

  useEffect(() => {
    setImageUrl(primaryImageUrl || fallbackImageUrl);
  }, [primaryImageUrl, fallbackImageUrl]);

  return (
    <div className="tg-section p-4">
      <div className="flex items-center gap-3">
        {/* Result Image */}
        <div className="w-14 h-14 rounded-xl bg-purple-500/10 flex items-center justify-center overflow-hidden">
          {imageUrl ? (
            <GifImage
              src={imageUrl}
              alt={resultTitle}
              className="w-full h-full object-cover"
              onError={() => {
                setImageUrl((currentUrl) => {
                  if (!currentUrl) return null;
                  if (currentUrl === primaryImageUrl && fallbackImageUrl && fallbackImageUrl !== primaryImageUrl) {
                    return fallbackImageUrl;
                  }
                  return null;
                });
              }}
            />
          ) : (
            <span className="text-2xl">🎭</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground line-clamp-1">{resultTitle}</h3>
          <p className="text-xs text-purple-500 font-medium mt-0.5">{testTitle}</p>
          {(() => {
            const isAnonymous = test?.is_anonymous === true;
            const creatorName = isAnonymous
              ? 'Анонимный автор'
              : (test?.creator?.first_name || test?.creator?.username || null);
            const squadTitle = !isAnonymous ? test?.creator?.squad?.title || null : null;

            return <CreatorMeta creatorName={creatorName} squadTitle={squadTitle} accentClass="text-purple-500" />;
          })()}
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
            {resultDescription}
          </p>
        </div>

        {/* Share Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare();
          }}
          disabled={!canShare}
          className={`p-2 rounded-lg transition-colors ${
            canShare
              ? "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20"
              : "bg-secondary text-muted-foreground cursor-not-allowed opacity-60"
          }`}
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
