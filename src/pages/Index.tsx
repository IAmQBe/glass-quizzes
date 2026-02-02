import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BannerCarousel } from "@/components/BannerCarousel";
import { QuizShowcase } from "@/components/QuizShowcase";
import { useBanners } from "@/hooks/useBanners";
import { usePublishedQuizzes, useQuizWithQuestions } from "@/hooks/useQuizzes";
import { QuizScreen } from "@/screens/QuizScreen";
import { ResultScreen } from "@/screens/ResultScreen";
import { CompareScreen } from "@/screens/CompareScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { AdminPanel } from "@/screens/AdminPanel";
import { toast } from "@/hooks/use-toast";
import { UserStats, QuizResult } from "@/types/quiz";
import { initTelegramApp, backButton, isTelegramWebApp, shareResult } from "@/lib/telegram";
import { calculateResult } from "@/data/quizData";
import { Plus, User } from "lucide-react";
import { haptic } from "@/lib/telegram";

type AppScreen = "home" | "quiz" | "result" | "compare" | "profile" | "admin";

const Index = () => {
  const navigate = useNavigate();
  const { data: banners = [], isLoading: bannersLoading } = useBanners();
  const { data: quizzes = [], isLoading: quizzesLoading } = usePublishedQuizzes();
  
  const [currentScreen, setCurrentScreen] = useState<AppScreen>("home");
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);

  const { data: quizData } = useQuizWithQuestions(selectedQuizId);

  // Initialize Telegram WebApp
  useEffect(() => {
    initTelegramApp();
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
        } else if (currentScreen === "compare" || currentScreen === "profile") {
          setCurrentScreen(result ? "result" : "home");
        } else if (currentScreen === "admin") {
          setCurrentScreen("profile");
        } else if (currentScreen === "result") {
          setCurrentScreen("home");
          setSelectedQuizId(null);
          setResult(null);
        }
      });
    } else {
      backButton.hide();
    }

    return () => {
      backButton.hide();
    };
  }, [currentScreen, result]);

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
      // Calculate result
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

  const userStats: UserStats = {
    bestScore: result?.score ?? 0,
    testsCompleted: 1,
    globalRank: 12847,
    activeChallenges: 0,
  };

  // Map quiz data questions to the format expected by QuizScreen
  const mappedQuestions = quizData?.questions?.map((q, i) => ({
    id: i + 1,
    text: q.question_text,
    options: q.options.map(opt => opt.text),
  })) || [];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <div className="max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {currentScreen === "home" && (
            <motion.div
              key="home"
              className="p-4 pb-20 safe-bottom space-y-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between py-2">
                <h1 className="text-xl font-bold text-foreground">Mind Test</h1>
                <button
                  className="tg-avatar w-10 h-10"
                  onClick={() => {
                    haptic.selection();
                    setCurrentScreen("profile");
                  }}
                >
                  <User className="w-5 h-5 text-primary" />
                </button>
              </div>

              {/* Banner Carousel */}
              {!bannersLoading && banners.length > 0 && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <BannerCarousel banners={banners} />
                </motion.div>
              )}

              {/* Section Title */}
              <motion.div
                className="flex items-center justify-between"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <h2 className="text-lg font-semibold text-foreground">Popular Quizzes</h2>
                <button
                  className="tg-button-text text-sm py-1"
                  onClick={() => {
                    haptic.selection();
                    toast({
                      title: "Coming soon",
                      description: "Quiz creation will be available soon!",
                    });
                  }}
                >
                  <Plus className="w-4 h-4 inline mr-1" />
                  Create
                </button>
              </motion.div>

              {/* Quiz Showcase */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <QuizShowcase
                  quizzes={quizzes}
                  isLoading={quizzesLoading}
                  onQuizSelect={handleQuizSelect}
                />
              </motion.div>

              {/* Empty State - Show sample quiz button */}
              {!quizzesLoading && quizzes.length === 0 && (
                <motion.div
                  className="tg-section p-6 text-center"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <p className="text-muted-foreground mb-4">
                    No quizzes available yet. Try the demo!
                  </p>
                  <button
                    className="tg-button"
                    onClick={() => {
                      haptic.impact('medium');
                      // Use built-in demo quiz
                      setSelectedQuizId(null);
                      setCurrentQuestion(0);
                      setAnswers([]);
                      setCurrentScreen("quiz");
                    }}
                  >
                    Start Demo Quiz
                  </button>
                </motion.div>
              )}
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
              onBack={() => setCurrentScreen(result ? "result" : "home")}
              onOpenAdmin={() => setCurrentScreen("admin")}
            />
          )}

          {currentScreen === "admin" && (
            <AdminPanel
              key="admin"
              onBack={() => setCurrentScreen("profile")}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Index;