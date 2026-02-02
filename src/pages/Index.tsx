import { AnimatePresence } from "framer-motion";
import { useQuiz } from "@/hooks/useQuiz";
import { WelcomeScreen } from "@/screens/WelcomeScreen";
import { QuizScreen } from "@/screens/QuizScreen";
import { ResultScreen } from "@/screens/ResultScreen";
import { CompareScreen } from "@/screens/CompareScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { toast } from "@/hooks/use-toast";
import { UserStats } from "@/types/quiz";

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

  // Mock user stats
  const userStats: UserStats = {
    bestScore: result?.score ?? 0,
    testsCompleted: 1,
    globalRank: 12847,
    activeChallenges: 0,
  };

  const handleShare = () => {
    // In a real Telegram Mini App, this would use Telegram's share API
    toast({
      title: "Sharing...",
      description: "Opening Telegram share dialog",
    });
  };

  const handleChallenge = () => {
    goToScreen("compare");
  };

  const handleInvite = () => {
    toast({
      title: "Invite sent!",
      description: "Your friend will receive the challenge",
    });
  };

  const handlePostComparison = () => {
    toast({
      title: "Posted!",
      description: "Comparison shared to chat",
    });
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Ambient Background Glow */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, hsl(195 100% 50% / 0.08) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 100% 100%, hsl(250 60% 55% / 0.06) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 0% 100%, hsl(195 100% 50% / 0.04) 0%, transparent 50%)
          `,
        }}
      />
      
      <div className="relative z-10 max-w-md mx-auto">
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
