import { useState } from "react";
import { motion } from "framer-motion";
import { UserStats } from "@/types/quiz";
import { ArrowLeft, Trophy, Target, Globe, Swords, ChevronRight, Settings, Clock, Share2, Copy, Check, Users, Bell, BellOff, Sun, Moon } from "lucide-react";
import { haptic, getTelegramUser, shareReferralLink } from "@/lib/telegram";
import { useIsAdmin } from "@/hooks/useAuth";
import { useMyQuizzes } from "@/hooks/useQuizzes";
import { useFavorites } from "@/hooks/useFavorites";
import { useProfile, useUpdateProfile, useReferralCount } from "@/hooks/useProfile";
import { PopcornIcon } from "@/components/icons/PopcornIcon";
import { BookmarkIcon } from "@/components/icons/BookmarkIcon";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/useTheme";

interface ProfileScreenProps {
  stats: UserStats;
  onBack: () => void;
  onOpenAdmin?: () => void;
  onQuizSelect?: (quizId: string) => void;
}

type FilterType = "date" | "popularity";
type TabType = "my" | "saved";

export const ProfileScreen = ({ stats, onBack, onOpenAdmin, onQuizSelect }: ProfileScreenProps) => {
  const user = getTelegramUser();
  const { data: isAdmin } = useIsAdmin();
  const { data: myQuizzes = [], isLoading: myQuizzesLoading } = useMyQuizzes();
  const { data: favorites = [], isLoading: favoritesLoading } = useFavorites();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: referralCount = 0 } = useReferralCount();
  const updateProfile = useUpdateProfile();
  const { isDark, toggleTheme } = useTheme();
  
  const [activeTab, setActiveTab] = useState<TabType>("my");
  const [sortBy, setSortBy] = useState<FilterType>("date");
  const [copied, setCopied] = useState(false);

  const handleBack = () => {
    haptic.selection();
    onBack();
  };

  const handleCopyReferral = () => {
    if (profile?.referral_code) {
      const referralUrl = `https://t.me/MindTestBot?start=${profile.referral_code}`;
      navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      haptic.notification('success');
      toast({ title: "Ссылка скопирована!" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareReferral = () => {
    if (profile?.referral_code) {
      haptic.impact('medium');
      shareReferralLink(profile.referral_code);
    }
  };

  const handleToggleNotifications = () => {
    if (profile) {
      haptic.selection();
      updateProfile.mutate({ 
        challenge_notifications_enabled: !profile.challenge_notifications_enabled 
      });
    }
  };

  const statItems = [
    { icon: Trophy, label: "Best", value: stats.bestScore, color: "text-yellow-500" },
    { icon: Target, label: "Tests", value: stats.testsCompleted, color: "text-primary" },
    { icon: Globe, label: "Rank", value: `#${stats.globalRank.toLocaleString()}`, color: "text-green-500" },
    { icon: Swords, label: "Challenges", value: stats.activeChallenges, color: "text-purple-500" },
  ];

  // Sort quizzes
  const sortedMyQuizzes = [...myQuizzes].sort((a, b) => {
    if (sortBy === "popularity") {
      return b.participant_count - a.participant_count;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const savedQuizzes = favorites
    .map((f) => f.quizzes)
    .filter((q): q is NonNullable<typeof q> => q !== null);

  return (
    <motion.div
      className="flex flex-col min-h-screen pb-24"
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
          <div className="tg-avatar w-20 h-20 mb-3">
            <span className="text-4xl">🧠</span>
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
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          className="grid grid-cols-4 gap-2"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {statItems.map((item, index) => (
            <motion.div
              key={item.label}
              className="tg-stat"
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 + index * 0.05 }}
            >
              <item.icon className={`w-5 h-5 mx-auto mb-2 ${item.color}`} />
              <p className="text-lg font-bold text-foreground">{item.value}</p>
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
            </motion.div>
          ))}
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
          
          {profile?.referral_code ? (
            <div className="flex gap-2">
              <div className="flex-1 bg-secondary rounded-lg px-3 py-2 font-mono text-sm text-foreground truncate">
                t.me/MindTestBot?start={profile.referral_code}
              </div>
              <button
                onClick={handleCopyReferral}
                className="p-2 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Copy className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
              <button
                onClick={handleShareReferral}
                className="p-2 bg-primary rounded-lg text-primary-foreground"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex justify-center py-2">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
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

          {/* Challenge Notifications Toggle */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              {profile?.challenge_notifications_enabled ? (
                <Bell className="w-5 h-5 text-primary" />
              ) : (
                <BellOff className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <span className="text-foreground font-medium">Уведомления о вызовах</span>
                <p className="text-xs text-muted-foreground">Получать приглашения на челленджи</p>
              </div>
            </div>
            <Switch
              checked={profile?.challenge_notifications_enabled ?? true}
              onCheckedChange={handleToggleNotifications}
              disabled={profileLoading || updateProfile.isPending}
            />
          </div>

          {/* Admin Button */}
          {isAdmin && onOpenAdmin && (
            <button
              className="w-full flex items-center justify-between p-4"
              onClick={() => {
                haptic.impact('medium');
                onOpenAdmin();
              }}
            >
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-primary" />
                <span className="text-foreground font-medium">Admin Panel</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
        </motion.div>

        {/* Tabs: My Quizzes / Saved */}
        <motion.div
          className="flex gap-2"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          <button
            className={`flex-1 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === "my"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground"
            }`}
            onClick={() => {
              haptic.selection();
              setActiveTab("my");
            }}
          >
            <Target className="w-4 h-4" />
            Мои ({myQuizzes.length})
          </button>
          <button
            className={`flex-1 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === "saved"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground"
            }`}
            onClick={() => {
              haptic.selection();
              setActiveTab("saved");
            }}
          >
            <BookmarkIcon className="w-4 h-4" />
            Saved ({favorites.length})
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
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                sortBy === "date"
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
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                sortBy === "popularity"
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
              {myQuizzesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : sortedMyQuizzes.length === 0 ? (
                <div className="tg-section p-6 text-center">
                  <p className="text-muted-foreground">Ты ещё не создал ни одного квиза</p>
                </div>
              ) : (
                sortedMyQuizzes.map((quiz) => (
                  <QuizListItem
                    key={quiz.id}
                    quiz={quiz}
                    onClick={() => onQuizSelect?.(quiz.id)}
                  />
                ))
              )}
            </>
          )}

          {activeTab === "saved" && (
            <>
              {favoritesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : savedQuizzes.length === 0 ? (
                <div className="tg-section p-6 text-center">
                  <p className="text-muted-foreground">Нет сохранённых квизов</p>
                </div>
              ) : (
                savedQuizzes.map((quiz: any) => (
                  <QuizListItem
                    key={quiz.id}
                    quiz={quiz}
                    onClick={() => onQuizSelect?.(quiz.id)}
                  />
                ))
              )}
            </>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};

// Quiz List Item Component
const QuizListItem = ({ quiz, onClick }: { quiz: any; onClick: () => void }) => (
  <button
    className="tg-section w-full p-4 text-left"
    onClick={() => {
      haptic.impact('light');
      onClick();
    }}
  >
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
        {quiz.image_url ? (
          <img src={quiz.image_url} alt={quiz.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xl">📝</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-foreground line-clamp-1">{quiz.title}</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
          <span>{quiz.question_count} вопросов</span>
          <span>{quiz.participant_count} участий</span>
          {(quiz.like_count ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <PopcornIcon className="w-3 h-3 text-amber-500" />
              {quiz.like_count}
            </span>
          )}
        </div>
      </div>
      <span
        className={`text-xs px-2 py-1 rounded-full ${
          quiz.is_published
            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
            : "bg-secondary text-muted-foreground"
        }`}
      >
        {quiz.is_published ? "Live" : "Draft"}
      </span>
    </div>
  </button>
);
