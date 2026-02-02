import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BannerCarousel } from "@/components/BannerCarousel";
import { QuizShowcase } from "@/components/QuizShowcase";
import { BottomNav } from "@/components/BottomNav";
import { LeaderboardPreview } from "@/components/LeaderboardPreview";
import { useBanners } from "@/hooks/useBanners";
import { usePublishedQuizzes, useQuizWithQuestions } from "@/hooks/useQuizzes";
import { useFavoriteIds, useToggleFavorite } from "@/hooks/useFavorites";
import { QuizScreen } from "@/screens/QuizScreen";
import { ResultScreen } from "@/screens/ResultScreen";
import { CompareScreen } from "@/screens/CompareScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { AdminPanel } from "@/screens/AdminPanel";
import { LeaderboardScreen } from "@/screens/LeaderboardScreen";
import { CreateQuizScreen } from "@/screens/CreateQuizScreen";
import { toast } from "@/hooks/use-toast";
import { UserStats, QuizResult } from "@/types/quiz";
import { initTelegramApp, backButton, isTelegramWebApp, shareResult, getTelegramUserData } from "@/lib/telegram";
import { calculateResult } from "@/data/quizData";
import { Flame, TrendingUp, Sparkles } from "lucide-react";
import { haptic } from "@/lib/telegram";

type AppScreen = "home" | "quiz" | "result" | "compare" | "profile" | "admin" | "leaderboard" | "create";
type TabId = "home" | "leaderboard" | "create" | "profile";

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
  const { data: favoriteIds = new Set() } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  
  const [currentScreen, setCurrentScreen] = useState<AppScreen>("home");
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);

  const { data: quizData } = useQuizWithQuestions(selectedQuizId);

  // Initialize Telegram WebApp and sync user data
  useEffect(() => {
    initTelegramApp();
    
    // Get Telegram user data for profile sync
    const userData = getTelegramUserData();
    if (userData) {
      console.log("Telegram user data:", userData);
      // TODO: Sync with database when authenticated
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

  const handleToggleFavorite = (quizId: string) => {
    const isFavorite = favoriteIds.has(quizId);
    toggleFavorite.mutate({ quizId, isFavorite });
  };

  const userStats: UserStats = {
    bestScore: result?.score ?? 0,
    testsCompleted: 1,
    globalRank: 12847,
    activeChallenges: 0,
  };

  // Sort quizzes by rating for "trending" section
  const trendingQuizzes = [...quizzes]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 5);

  // Map quiz data questions to the format expected by QuizScreen
  const mappedQuestions = quizData?.questions?.map((q, i) => ({
    id: i + 1,
    text: q.question_text,
    options: q.options.map(opt => opt.text),
  })) || [];

  const showBottomNav = ["home", "leaderboard", "profile"].includes(currentScreen);

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <div className="max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {currentScreen === "home" && (
            <motion.div
              key="home"
              className="p-4 pb-24 safe-bottom space-y-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between py-2">
                <h1 className="text-xl font-bold text-foreground">Mind Test</h1>
                <div className="flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-full">
                  <Flame className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">12.5K</span>
                </div>
              </div>

              {/* Banner Carousel - Fixed size */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                {!bannersLoading && banners.length > 0 ? (
                  <BannerCarousel banners={banners} />
                ) : (
                  <div className="tg-section p-6 text-center" style={{ aspectRatio: "2/1" }}>
                    <div className="flex flex-col items-center justify-center h-full">
                      <Sparkles className="w-8 h-8 text-primary mb-2" />
                      <p className="text-muted-foreground">Start your first quiz!</p>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Leaderboard Preview - Clickbait */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
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

              {/* Trending Section */}
              {trendingQuizzes.length > 0 && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Trending</h2>
                  </div>
                  <QuizShowcase
                    quizzes={trendingQuizzes}
                    isLoading={quizzesLoading}
                    onQuizSelect={handleQuizSelect}
                    favoriteIds={favoriteIds}
                    onToggleFavorite={handleToggleFavorite}
                  />
                </motion.div>
              )}

              {/* All Quizzes or Demo */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.25 }}
              >
                {!quizzesLoading && quizzes.length === 0 ? (
                  <div className="tg-section p-6 text-center">
                    <Sparkles className="w-10 h-10 text-primary mx-auto mb-3" />
                    <h3 className="font-semibold text-foreground mb-2">No quizzes yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Be the first to create a quiz or try the demo!
                    </p>
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
                  </div>
                ) : quizzes.length > trendingQuizzes.length && (
                  <>
                    <h2 className="text-lg font-semibold text-foreground mb-3">All Quizzes</h2>
                    <QuizShowcase
                      quizzes={quizzes.slice(trendingQuizzes.length)}
                      isLoading={quizzesLoading}
                      onQuizSelect={handleQuizSelect}
                      favoriteIds={favoriteIds}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  </>
                )}
              </motion.div>
            </motion.div>
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