import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BannerCarousel } from "@/components/BannerCarousel";
import { QuizShowcase } from "@/components/QuizShowcase";
import { BottomNav } from "@/components/BottomNav";
import { LeaderboardPreview } from "@/components/LeaderboardPreview";
import { OnboardingCarousel } from "@/components/OnboardingCarousel";
import { useBanners } from "@/hooks/useBanners";
import { usePublishedQuizzes, useQuizWithQuestions } from "@/hooks/useQuizzes";
import { useFavoriteIds, useToggleFavorite } from "@/hooks/useFavorites";
import { useLikeIds, useToggleLike } from "@/hooks/useLikes";
import { QuizScreen } from "@/screens/QuizScreen";
import { ResultScreen } from "@/screens/ResultScreen";
import { CompareScreen } from "@/screens/CompareScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { AdminPanel } from "@/screens/AdminPanel";
import { LeaderboardScreen } from "@/screens/LeaderboardScreen";
import { CreateQuizScreen } from "@/screens/CreateQuizScreen";
import { CreatorsScreen } from "@/screens/CreatorsScreen";
import { toast } from "@/hooks/use-toast";
import { UserStats, QuizResult } from "@/types/quiz";
import { initTelegramApp, backButton, isTelegramWebApp, shareResult, getTelegramUserData } from "@/lib/telegram";
import { calculateResult } from "@/data/quizData";
import { TrendingUp, Sparkles, Search, X } from "lucide-react";
import { PopcornIcon } from "@/components/icons/PopcornIcon";
import { BookmarkIcon } from "@/components/icons/BookmarkIcon";
import { Input } from "@/components/ui/input";
import { haptic } from "@/lib/telegram";

type AppScreen = "home" | "quiz" | "result" | "compare" | "profile" | "admin" | "leaderboard" | "create" | "gallery";
type TabId = "home" | "gallery" | "create" | "leaderboard" | "profile";
type QuizTab = "trending" | "all";
type SortType = "popular" | "saves" | "newest";

// Mock leaderboard data
const mockLeaderboard = [
  { rank: 1, username: "BrainMaster", score: 9847, hasPremium: true },
  { rank: 2, username: "QuizKing", score: 9234, hasPremium: true },
  { rank: 3, username: "MindPro", score: 8956, hasPremium: false },
  { rank: 4, username: "TestGenius", score: 8721, hasPremium: true },
  { rank: 5, username: "SmartPlayer", score: 8543, hasPremium: false },
];

const Index = () => {
  const { data: banners = [], isLoading: bannersLoading } = useBanners();
  const { data: quizzes = [], isLoading: quizzesLoading } = usePublishedQuizzes();
  const { data: saveIds = new Set() } = useFavoriteIds();
  const { data: likeIds = new Set() } = useLikeIds();
  const toggleSave = useToggleFavorite();
  const toggleLike = useToggleLike();
  
  const [currentScreen, setCurrentScreen] = useState<AppScreen>("home");
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  
  // New state
  const [quizTab, setQuizTab] = useState<QuizTab>("trending");
  const [sortBy, setSortBy] = useState<SortType>("popular");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { data: quizData } = useQuizWithQuestions(selectedQuizId);

  // Check onboarding status
  useEffect(() => {
    const onboardingCompleted = localStorage.getItem("onboarding_completed");
    if (!onboardingCompleted) {
      setShowOnboarding(true);
    }
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem("onboarding_completed", "true");
    setShowOnboarding(false);
    haptic.notification('success');
  };

  // Initialize Telegram WebApp and sync user data
  useEffect(() => {
    initTelegramApp();
    
    // Get Telegram user data for profile sync
    const userData = getTelegramUserData();
    if (userData) {
      console.log("Telegram user data:", userData);
    }
  }, []);

  // Handle Telegram back button
  useEffect(() => {
    if (!isTelegramWebApp()) return;

    if (currentScreen !== "home") {
      backButton.show(() => {
        if (currentScreen === "quiz") {
          setCurrentScreen("home");
          setSelectedQuizId(null);
          setCurrentQuestion(0);
          setAnswers([]);
        } else if (currentScreen === "compare") {
          setCurrentScreen("result");
        } else if (currentScreen === "admin") {
          setCurrentScreen("profile");
        } else if (currentScreen === "result") {
          setCurrentScreen("home");
          setSelectedQuizId(null);
          setResult(null);
        } else {
          setCurrentScreen("home");
          setActiveTab("home");
        }
      });
    } else {
      backButton.hide();
    }

    return () => {
      backButton.hide();
    };
  }, [currentScreen, result]);

  // Handle tab changes
  const handleTabChange = (tab: TabId) => {
    if (tab === "create") {
      setCurrentScreen("create");
    } else if (tab === "leaderboard") {
      setCurrentScreen("leaderboard");
    } else if (tab === "profile") {
      setCurrentScreen("profile");
    } else if (tab === "gallery") {
      setCurrentScreen("gallery");
    } else {
      setCurrentScreen("home");
    }
    setActiveTab(tab);
  };

  const handleQuizSelect = (quizId: string) => {
    haptic.impact('medium');
    setSelectedQuizId(quizId);
    setCurrentQuestion(0);
    setAnswers([]);
    setCurrentScreen("quiz");
  };

  const handleAnswer = (answerIndex: number) => {
    const questions = quizData?.questions || [];
    const totalQuestions = questions.length > 0 ? questions.length : 5;

    const newAnswers = [...answers, answerIndex];
    setAnswers(newAnswers);

    if (currentQuestion < totalQuestions - 1) {
      setTimeout(() => {
        setCurrentQuestion((prev) => prev + 1);
      }, 300);
    } else {
      setTimeout(() => {
        const quizResult = calculateResult(newAnswers);
        setResult(quizResult);
        setCurrentScreen("result");
      }, 500);
    }
  };

  const handleShare = () => {
    if (result) {
      shareResult(result.score, result.percentile, result.verdict);
    }
  };

  const handleChallenge = () => {
    setCurrentScreen("compare");
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setAnswers([]);
    setResult(null);
    setCurrentScreen("quiz");
  };

  const handleToggleSave = (quizId: string) => {
    const isSaved = saveIds.has(quizId);
    toggleSave.mutate({ quizId, isFavorite: isSaved });
  };

  const handleToggleLike = (quizId: string) => {
    const isLiked = likeIds.has(quizId);
    toggleLike.mutate({ quizId, isLiked });
  };

  const userStats: UserStats = {
    bestScore: result?.score ?? 0,
    testsCompleted: 1,
    globalRank: 12847,
    activeChallenges: 0,
  };

  // Filter and sort quizzes
  const filteredQuizzes = quizzes.filter(quiz => 
    quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    quiz.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedQuizzes = [...filteredQuizzes].sort((a, b) => {
    switch (sortBy) {
      case "popular":
        return ((b as any).like_count ?? 0) - ((a as any).like_count ?? 0);
      case "saves":
        return ((b as any).save_count ?? 0) - ((a as any).save_count ?? 0);
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      default:
        return 0;
    }
  });

  // Trending: top by likes
  const trendingQuizzes = [...quizzes]
    .sort((a, b) => ((b as any).like_count ?? 0) - ((a as any).like_count ?? 0))
    .slice(0, 10);

  // Map quiz data questions to the format expected by QuizScreen
  const mappedQuestions = quizData?.questions?.map((q, i) => ({
    id: i + 1,
    text: q.question_text,
    options: q.options.map(opt => opt.text),
  })) || [];

  const showBottomNav = ["home", "gallery", "leaderboard", "profile"].includes(currentScreen);
  const displayQuizzes = quizTab === "trending" ? trendingQuizzes : sortedQuizzes;

  // Show onboarding
  if (showOnboarding) {
    return <OnboardingCarousel onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <div className="max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {currentScreen === "home" && (
            <motion.div
              key="home"
              className="p-4 pb-24 safe-bottom space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between py-2">
                <h1 className="text-xl font-bold text-foreground">Mind Test</h1>
                <div className="flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-full">
                  <PopcornIcon className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">12.5K</span>
                </div>
              </div>

              {/* Banner Carousel - Compact */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                {!bannersLoading && banners.length > 0 ? (
                  <BannerCarousel banners={banners} />
                ) : (
                  <div className="tg-section p-4 text-center rounded-2xl" style={{ aspectRatio: "16/7" }}>
                    <div className="flex flex-col items-center justify-center h-full">
                      <Sparkles className="w-6 h-6 text-primary mb-2" />
                      <p className="text-sm text-muted-foreground">Start your first quiz!</p>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Leaderboard Preview */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.12 }}
              >
                <LeaderboardPreview
                  entries={mockLeaderboard}
                  onViewAll={() => {
                    haptic.selection();
                    setCurrentScreen("leaderboard");
                    setActiveTab("leaderboard");
                  }}
                />
              </motion.div>

              {/* Tabs: Trending / All */}
              <motion.div
                className="flex gap-2"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.14 }}
              >
                <button
                  className={`flex-1 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                    quizTab === "trending"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  }`}
                  onClick={() => {
                    haptic.selection();
                    setQuizTab("trending");
                  }}
                >
                  <TrendingUp className="w-4 h-4" />
                  Trending
                </button>
                <button
                  className={`flex-1 py-2.5 rounded-xl font-medium transition-colors ${
                    quizTab === "all"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  }`}
                  onClick={() => {
                    haptic.selection();
                    setQuizTab("all");
                  }}
                >
                  Все квизы
                </button>
              </motion.div>

              {/* Sort chips + Search button (only for All tab) */}
              {quizTab === "all" && (
                <motion.div
                  className="space-y-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {/* Search bar (expandable) */}
                  <AnimatePresence>
                    {searchOpen && (
                      <motion.div
                        className="flex gap-2"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                      >
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="Поиск квизов..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-secondary border-0"
                            autoFocus
                          />
                        </div>
                        <button
                          className="p-2.5 bg-secondary rounded-lg"
                          onClick={() => {
                            setSearchOpen(false);
                            setSearchQuery("");
                          }}
                        >
                          <X className="w-4 h-4 text-foreground" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Sort chips */}
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {(["popular", "saves", "newest"] as const).map((sort) => (
                      <button
                        key={sort}
                        onClick={() => {
                          haptic.selection();
                          setSortBy(sort);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                          sortBy === sort
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {sort === "popular" && <><PopcornIcon className="w-3 h-3" /> Лайки</>}
                        {sort === "saves" && <><BookmarkIcon className="w-3 h-3" /> Saves</>}
                        {sort === "newest" && "✨ Новые"}
                      </button>
                    ))}
                    
                    {/* Search button */}
                    {!searchOpen && (
                      <button
                        onClick={() => {
                          haptic.selection();
                          setSearchOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-secondary text-muted-foreground flex items-center gap-1"
                      >
                        <Search className="w-3 h-3" />
                        Поиск
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Quizzes List */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.16 }}
              >
                {!quizzesLoading && displayQuizzes.length === 0 ? (
                  <div className="tg-section p-6 text-center">
                    <Sparkles className="w-10 h-10 text-primary mx-auto mb-3" />
                    <h3 className="font-semibold text-foreground mb-2">
                      {searchQuery ? "Ничего не найдено" : "Нет квизов"}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {searchQuery 
                        ? "Попробуй изменить поисковый запрос" 
                        : "Стань первым создателем квиза!"}
                    </p>
                    {!searchQuery && (
                      <button
                        className="tg-button"
                        onClick={() => {
                          haptic.impact('medium');
                          setSelectedQuizId(null);
                          setCurrentQuestion(0);
                          setAnswers([]);
                          setCurrentScreen("quiz");
                        }}
                      >
                        Start Demo Quiz
                      </button>
                    )}
                  </div>
                ) : (
                  <QuizShowcase
                    quizzes={displayQuizzes}
                    isLoading={quizzesLoading}
                    onQuizSelect={handleQuizSelect}
                    likeIds={likeIds}
                    saveIds={saveIds}
                    onToggleLike={handleToggleLike}
                    onToggleSave={handleToggleSave}
                  />
                )}
              </motion.div>
            </motion.div>
          )}

          {currentScreen === "gallery" && (
            <CreatorsScreen
              key="gallery"
              onBack={() => {
                setCurrentScreen("home");
                setActiveTab("home");
              }}
            />
          )}

          {currentScreen === "quiz" && (
            <QuizScreen
              key="quiz"
              questions={mappedQuestions.length > 0 ? mappedQuestions : undefined}
              currentQuestion={currentQuestion}
              onAnswer={handleAnswer}
            />
          )}

          {currentScreen === "result" && result && (
            <ResultScreen
              key="result"
              result={result}
              onShare={handleShare}
              onChallenge={handleChallenge}
              onRestart={handleRestart}
              onNavigate={(screen) => setCurrentScreen(screen as AppScreen)}
            />
          )}

          {currentScreen === "compare" && result && (
            <CompareScreen
              key="compare"
              userResult={result}
              onInvite={() => toast({ title: "Invite sent!" })}
              onPostComparison={() => toast({ title: "Posted!" })}
              onBack={() => setCurrentScreen("result")}
            />
          )}

          {currentScreen === "profile" && (
            <ProfileScreen
              key="profile"
              stats={userStats}
              onBack={() => {
                setCurrentScreen("home");
                setActiveTab("home");
              }}
              onOpenAdmin={() => setCurrentScreen("admin")}
              onQuizSelect={handleQuizSelect}
            />
          )}

          {currentScreen === "admin" && (
            <AdminPanel
              key="admin"
              onBack={() => setCurrentScreen("profile")}
            />
          )}

          {currentScreen === "leaderboard" && (
            <LeaderboardScreen
              key="leaderboard"
              onBack={() => {
                setCurrentScreen("home");
                setActiveTab("home");
              }}
            />
          )}

          {currentScreen === "create" && (
            <CreateQuizScreen
              key="create"
              onBack={() => {
                setCurrentScreen("home");
                setActiveTab("home");
              }}
              onSuccess={() => {
                setCurrentScreen("profile");
                setActiveTab("profile");
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      {showBottomNav && (
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      )}
    </div>
  );
};

export default Index;
