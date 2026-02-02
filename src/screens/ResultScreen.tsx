import { motion } from "framer-motion";
import { QuizResult } from "@/types/quiz";
import { Share2, Users, RotateCcw, User, Trophy } from "lucide-react";
import { QuizScreen as QuizScreenType } from "@/hooks/useQuiz";
import { haptic, shareResult } from "@/lib/telegram";

interface ResultScreenProps {
  result: QuizResult;
  onShare: () => void;
  onChallenge: () => void;
  onRestart: () => void;
  onNavigate: (screen: QuizScreenType) => void;
}

export const ResultScreen = ({ result, onShare, onChallenge, onRestart, onNavigate }: ResultScreenProps) => {
  const handleShare = () => {
    haptic.notification('success');
    shareResult(result.score, result.percentile, result.verdict);
    onShare();
  };

  const handleChallenge = () => {
    haptic.impact('medium');
    onChallenge();
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center p-5 safe-bottom"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Score Display */}
      <motion.div
        className="flex-1 flex flex-col items-center justify-center"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
      >
        <div className="tg-avatar w-20 h-20 mb-6">
          <span className="text-4xl">{result.verdictEmoji}</span>
        </div>
        
        <div className="text-center mb-2">
          <span className="tg-score">{result.score}</span>
          <span className="text-2xl text-muted-foreground ml-1">/ {result.maxScore}</span>
        </div>
        
        <motion.div
          className="flex items-center gap-2 mb-4"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Trophy className="w-4 h-4 text-primary" />
          <span className="text-primary font-semibold">Top {result.percentile}%</span>
        </motion.div>
        
        <motion.p
          className="text-lg font-medium text-foreground text-center"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {result.verdict}
        </motion.p>
      </motion.div>

      {/* Actions */}
      <motion.div
        className="w-full max-w-sm space-y-3"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <button
          className="tg-button flex items-center justify-center gap-2"
          onClick={handleShare}
        >
          <Share2 className="w-5 h-5" />
          Share result
        </button>

        <button
          className="tg-button-secondary flex items-center justify-center gap-2"
          onClick={handleChallenge}
        >
          <Users className="w-5 h-5" />
          Challenge a friend
        </button>

        <div className="flex gap-3">
          <button
            className="tg-button-secondary flex-1 flex items-center justify-center gap-2"
            onClick={() => {
              haptic.selection();
              onRestart();
            }}
          >
            <RotateCcw className="w-4 h-4" />
            Retry
          </button>
          
          <button
            className="tg-button-secondary flex-1 flex items-center justify-center gap-2"
            onClick={() => {
              haptic.selection();
              onNavigate("profile");
            }}
          >
            <User className="w-4 h-4" />
            Profile
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};