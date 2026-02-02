import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useQuiz } from "@/hooks/useQuiz";
import { WelcomeScreen } from "@/screens/WelcomeScreen";
import { QuizScreen } from "@/screens/QuizScreen";
import { ResultScreen } from "@/screens/ResultScreen";
import { CompareScreen } from "@/screens/CompareScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { toast } from "@/hooks/use-toast";
import { UserStats } from "@/types/quiz";
import { initTelegramApp, backButton, isTelegramWebApp } from "@/lib/telegram";

const Index = () => {
  const {
    currentScreen,
    currentQuestion,
    questions,
    result,
    startQuiz,
    answerQuestion,
    goToScreen,
    restartQuiz,
  } = useQuiz();

  // Initialize Telegram WebApp
  useEffect(() => {
    initTelegramApp();
  }, []);

  // Handle Telegram back button
  useEffect(() => {
    if (!isTelegramWebApp()) return;

    if (currentScreen === "result" || currentScreen === "compare" || currentScreen === "profile") {
      backButton.show(() => {
        if (currentScreen === "compare" || currentScreen === "profile") {
          goToScreen("result");
        } else if (currentScreen === "result") {
          goToScreen("welcome");
        }
      });
    } else {
      backButton.hide();
    }

    return () => {
      backButton.hide();
    };
  }, [currentScreen, goToScreen]);

  // Mock user stats
  const userStats: UserStats = {
    bestScore: result?.score ?? 0,
    testsCompleted: 1,
    globalRank: 12847,
    activeChallenges: 0,
  };

  const handleShare = () => {
    if (!isTelegramWebApp()) {
      toast({
        title: "Share",
        description: "Opens Telegram share dialog in the app",
      });
    }
  };

  const handleChallenge = () => {
    goToScreen("compare");
  };

  const handleInvite = () => {
    if (!isTelegramWebApp()) {
      toast({
        title: "Invite sent!",
        description: "Your friend will receive the challenge",
      });
    }
  };

  const handlePostComparison = () => {
    toast({
      title: "Posted!",
      description: "Comparison shared to chat",
    });
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <div className="max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {currentScreen === "welcome" && (
            <WelcomeScreen key="welcome" onStart={startQuiz} />
          )}
          
          {currentScreen === "quiz" && (
            <QuizScreen
              key="quiz"
              questions={questions}
              currentQuestion={currentQuestion}
              onAnswer={answerQuestion}
            />
          )}
          
          {currentScreen === "result" && result && (
            <ResultScreen
              key="result"
              result={result}
              onShare={handleShare}
              onChallenge={handleChallenge}
              onRestart={restartQuiz}
              onNavigate={goToScreen}
            />
          )}
          
          {currentScreen === "compare" && result && (
            <CompareScreen
              key="compare"
              userResult={result}
              onInvite={handleInvite}
              onPostComparison={handlePostComparison}
              onBack={() => goToScreen("result")}
            />
          )}
          
          {currentScreen === "profile" && (
            <ProfileScreen
              key="profile"
              stats={userStats}
              onBack={() => goToScreen("result")}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Index;