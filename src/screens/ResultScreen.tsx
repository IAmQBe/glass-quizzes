import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { GlassButton } from "@/components/GlassButton";
import { QuizResult } from "@/types/quiz";
import { Share2, Users, Trophy, RotateCcw, User } from "lucide-react";
import { QuizScreen as QuizScreenType } from "@/hooks/useQuiz";

interface ResultScreenProps {
  result: QuizResult;
  onShare: () => void;
  onChallenge: () => void;
  onRestart: () => void;
  onNavigate: (screen: QuizScreenType) => void;
}

export const ResultScreen = ({ result, onShare, onChallenge, onRestart, onNavigate }: ResultScreenProps) => {
  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Score Display */}
      <motion.div
        className="text-center mb-8"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
      >
        <motion.div
          className="text-7xl font-bold mb-2"
          style={{
            background: "linear-gradient(135deg, hsl(195 100% 60%) 0%, hsl(250 60% 65%) 50%, hsl(195 100% 60%) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {result.score}
        </motion.div>
        <p className="text-muted-foreground text-sm">out of {result.maxScore}</p>
      </motion.div>

      {/* Rank Card */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-sm mb-6"
      >
        <GlassCard className="p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-primary" />
            <span className="text-lg font-semibold text-foreground">
              Top {result.percentile}%
            </span>
          </div>
          
          <div className="text-2xl mb-2">
            {result.verdictEmoji}
          </div>
          
          <p className="text-foreground font-medium">
            {result.verdict}
          </p>
        </GlassCard>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="w-full max-w-sm space-y-3"
      >
        <GlassButton
          variant="primary"
          size="lg"
          className="w-full flex items-center justify-center gap-2"
          onClick={onShare}
        >
          <Share2 className="w-5 h-5" />
          Share result
        </GlassButton>

        <GlassButton
          variant="default"
          size="md"
          className="w-full flex items-center justify-center gap-2"
          onClick={onChallenge}
        >
          <Users className="w-5 h-5" />
          Challenge a friend
        </GlassButton>

        <div className="flex gap-3">
          <GlassButton
            variant="secondary"
            size="sm"
            className="flex-1 flex items-center justify-center gap-2"
            onClick={onRestart}
          >
            <RotateCcw className="w-4 h-4" />
            Retry
          </GlassButton>
          
          <GlassButton
            variant="secondary"
            size="sm"
            className="flex-1 flex items-center justify-center gap-2"
            onClick={() => onNavigate("profile")}
          >
            <User className="w-4 h-4" />
            Profile
          </GlassButton>
        </div>
      </motion.div>
    </motion.div>
  );
};
