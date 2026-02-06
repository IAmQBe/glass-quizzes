import { useState } from "react";
import { motion } from "framer-motion";
import { UserStats } from "@/types/quiz";
import { ArrowLeft, Trophy, Target, Globe, Swords, ChevronRight, Settings, Clock, Share2, Copy, Check, Users, Sun, Moon, Sparkles, History, Pencil, Lock, ExternalLink } from "lucide-react";
import { haptic, getTelegramUser, shareReferralLink, sharePersonalityTestResult, getTelegram } from "@/lib/telegram";
import { useIsAdmin } from "@/hooks/useAuth";
import { useMyQuizzes, useMyQuizResults } from "@/hooks/useQuizzes";
import { useFavorites } from "@/hooks/useFavorites";
import { useProfile, useUpdateProfile, useReferralCount } from "@/hooks/useProfile";
import { useMyPersonalityTestCompletions, useMyPersonalityTests } from "@/hooks/usePersonalityTests";
import { useTotalPopcornsReceived } from "@/hooks/useLikes";
import { useMySquad, useSquadLeaderboard } from "@/hooks/useSquads";
import { PopcornIcon } from "@/components/icons/PopcornIcon";
import { BookmarkIcon } from "@/components/icons/BookmarkIcon";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/useTheme";

// Fun avatar placeholders for users without photos
const FUNNY_AVATARS = [
  "🤓", "🧐", "🤪", "😎", "🥸", "🤠", "🦊", "🐸", "🐵", "🦄", "🎃", "👽", "🤖", "👻"
];

const getRandomAvatar = (seed: number) => {
  return FUNNY_AVATARS[seed % FUNNY_AVATARS.length];
};

interface ProfileScreenProps {
  stats: UserStats;
  onBack: () => void;
  onOpenAdmin?: () => void;
  onQuizSelect?: (quizId: string) => void;
  onEditQuiz?: (quizId: string) => void;
  onEditTest?: (testId: string) => void;
}

type FilterType = "date" | "popularity";
type TabType = "my" | "saved" | "history";

export const ProfileScreen = ({ stats, onBack, onOpenAdmin, onQuizSelect, onEditQuiz, onEditTest }: ProfileScreenProps) => {
  const user = getTelegramUser();
  const { data: isAdmin } = useIsAdmin();
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

  // Find my squad rank
  const mySquadRank = mySquad ? squadLeaderboard.findIndex(s => s.id === mySquad.id) + 1 : 0;

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
    haptic.impact('medium');
    // Use referral_code if available, otherwise use telegram_id
    const code = profile?.referral_code || user?.id?.toString() || '';
    if (code) {
      shareReferralLink(code);
    } else {
      toast({ title: "Не удалось создать ссылку", variant: "destructive" });
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

  // Calculate actual stats
  const totalTestsCompleted = quizResults.length + testCompletions.length;
  const totalCreated = myQuizzes.length + myTests.length;

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
                const tg = getTelegram();
                const url = mySquad.username
                  ? `https://t.me/${mySquad.username}`
                  : mySquad.invite_link;
                if (url && tg?.openTelegramLink) {
                  tg.openTelegramLink(url);
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
              setActiveTab("my");
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
              setActiveTab("history");
            }}
          >
            <History className="w-3.5 h-3.5" />
            История ({(quizResults?.length || 0) + (testCompletions?.length || 0)})
          </button>
          <button
            className={`flex-1 py-2 rounded-xl font-medium transition-colors flex items-center justify-center gap-1 text-sm ${activeTab === "saved"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground"
              }`}
            onClick={() => {
              haptic.selection();
              setActiveTab("saved");
            }}
          >
            <BookmarkIcon className="w-3.5 h-3.5" />
            Saved
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
                    const isPending = test.status === 'pending';
                    const canEdit = isDraft && !isPending && onEditTest;

                    return (
                      <div key={test.id} className="tg-section p-4">
                        <div className="flex items-center gap-3">
                          {test.image_url ? (
                            <img src={test.image_url} alt={test.title} className="w-12 h-12 rounded-lg object-cover" />
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
                              {test.question_count} вопросов · {test.participant_count || 0} участий
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
                              {test.is_published ? 'Live' : isPending ? 'На модерации' : 'Draft'}
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
                allSaved.map((item: any) => (
                  <div key={item.id} className="tg-section p-4">
                    <div className="flex items-center gap-3">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.title} className="w-14 h-14 rounded-xl object-cover" />
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
                        {item.creator && (item.creator.first_name || item.creator.username) && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>от {item.creator.first_name || item.creator.username}</span>
                            {item.creator.squad && (
                              <span className="flex items-center gap-1 text-primary">
                                <PopcornIcon className="w-3 h-3" />
                                {item.creator.squad.title}
                              </span>
                            )}
                          </div>
                        )}
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
                ))
              )}
            </>
          )}

          {activeTab === "history" && (
            <>
              {(quizResultsLoading || completionsLoading) ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                </div>
              ) : (quizResults.length === 0 && testCompletions.length === 0) ? (
                <div className="tg-section p-6 text-center">
                  <History className="w-10 h-10 text-purple-500 mx-auto mb-3" />
                  <p className="text-muted-foreground">Ты ещё ничего не прошёл</p>
                </div>
              ) : (
                <>
                  {/* Quiz Results */}
                  {quizResults.map((result: any) => (
                    <div key={result.id} className="tg-section p-4">
                      <div className="flex items-center gap-3">
                        {result.quiz?.image_url ? (
                          <img src={result.quiz.image_url} alt={result.quiz.title} className="w-12 h-12 rounded-lg object-cover" />
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
                          {result.quiz?.creator && (result.quiz.creator.first_name || result.quiz.creator.username) && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <span>от {result.quiz.creator.first_name || result.quiz.creator.username}</span>
                              {result.quiz.creator.squad && (
                                <span className="flex items-center gap-1 text-primary">
                                  <PopcornIcon className="w-3 h-3" />
                                  {result.quiz.creator.squad.title}
                                </span>
                              )}
                            </div>
                          )}
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
                  {testCompletions.map((completion: any) => (
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
  const isPending = quiz.status === 'pending';
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
            {quiz.is_published ? "Live" : isPending ? "На модерации" : "Draft"}
          </span>
        </div>
      </div>
    </div>
  );
};

// Test Result Item Component
const TestResultItem = ({ completion, onShare }: { completion: any; onShare: () => void }) => {
  const result = completion.result;
  const test = completion.test;

  if (!result || !test) return null;

  return (
    <div className="tg-section p-4">
      <div className="flex items-center gap-3">
        {/* Result Image */}
        <div className="w-14 h-14 rounded-xl bg-purple-500/10 flex items-center justify-center overflow-hidden">
          {result.image_url ? (
            <img src={result.image_url} alt={result.title} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl">🎭</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground line-clamp-1">{result.title}</h3>
          <p className="text-xs text-purple-500 font-medium mt-0.5">{test.title}</p>
          {test.creator && (test.creator.first_name || test.creator.username) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span>от {test.creator.first_name || test.creator.username}</span>
              {test.creator.squad && (
                <span className="flex items-center gap-1 text-purple-500">
                  <PopcornIcon className="w-3 h-3" />
                  {test.creator.squad.title}
                </span>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
            {result.description}
          </p>
        </div>

        {/* Share Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare();
          }}
          className="p-2 rounded-lg bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 transition-colors"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
