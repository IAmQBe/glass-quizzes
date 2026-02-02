import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { GlassButton } from "@/components/GlassButton";
import { Friend, QuizResult } from "@/types/quiz";
import { UserPlus, Share2, ArrowLeft, Clock } from "lucide-react";
import { QuizScreen } from "@/hooks/useQuiz";

interface CompareScreenProps {
  userResult: QuizResult;
  friend?: Friend;
  onInvite: () => void;
  onPostComparison: () => void;
  onBack: () => void;
}

export const CompareScreen = ({ 
  userResult, 
  friend, 
  onInvite, 
  onPostComparison, 
  onBack 
}: CompareScreenProps) => {
  const hasCompleted = friend?.hasCompleted ?? false;
  const userWins = hasCompleted && friend?.score !== undefined && userResult.score > friend.score;
  const friendWins = hasCompleted && friend?.score !== undefined && friend.score > userResult.score;

  return (
    <motion.div
      className="min-h-screen flex flex-col p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <motion.div
        className="flex items-center mb-8"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <GlassButton
          variant="secondary"
          size="sm"
          className="p-2"
          onClick={onBack}
        >
          <ArrowLeft className="w-5 h-5" />
        </GlassButton>
        <h1 className="flex-1 text-center text-lg font-semibold text-foreground pr-10">
          Compare Results
        </h1>
      </motion.div>

      {/* Comparison Cards */}
      <div className="flex-1 flex flex-col justify-center">
        <motion.div
          className="flex gap-4 mb-8"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {/* Your Card */}
          <GlassCard 
            variant="compare" 
            winner={hasCompleted ? userWins : undefined}
            className="text-center"
          >
            <div className="w-16 h-16 mx-auto mb-3 rounded-full glass-card flex items-center justify-center">
              <span className="text-2xl">👤</span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">You</p>
            <p className="text-3xl font-bold text-foreground mb-1">{userResult.score}</p>
            <p className="text-xs text-muted-foreground">Top {userResult.percentile}%</p>
          </GlassCard>

          {/* VS Indicator */}
          <div className="flex items-center justify-center">
            <div className="w-10 h-10 rounded-full glass-card flex items-center justify-center">
              <span className="text-xs font-bold text-muted-foreground">VS</span>
            </div>
          </div>

          {/* Friend Card */}
          <GlassCard 
            variant="compare" 
            winner={hasCompleted ? friendWins : undefined}
            className="text-center"
          >
            {hasCompleted && friend ? (
              <>
                <div className="w-16 h-16 mx-auto mb-3 rounded-full glass-card flex items-center justify-center">
                  <span className="text-2xl">🎯</span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{friend.name}</p>
                <p className="text-3xl font-bold text-foreground mb-1">{friend.score}</p>
                <p className="text-xs text-muted-foreground">
                  {friend.score !== undefined && friend.score > userResult.score 
                    ? `+${friend.score - userResult.score} ahead` 
                    : friend.score !== undefined && friend.score < userResult.score
                    ? `-${userResult.score - friend.score} behind`
                    : "Tied!"
                  }
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto mb-3 rounded-full glass-card flex items-center justify-center border-2 border-dashed border-muted">
                  <Clock className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-2">Waiting...</p>
                <p className="text-lg font-medium text-muted-foreground mb-1">—</p>
                <p className="text-xs text-muted-foreground">Not completed</p>
              </>
            )}
          </GlassCard>
        </motion.div>

        {/* Status Message */}
        {!hasCompleted && (
          <motion.div
            className="text-center mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <GlassCard className="p-4 inline-block">
              <p className="text-sm text-muted-foreground">
                Challenge isn't complete until your friend takes the test
              </p>
            </GlassCard>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          className="space-y-3 max-w-sm mx-auto w-full"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {hasCompleted ? (
            <GlassButton
              variant="primary"
              size="lg"
              className="w-full flex items-center justify-center gap-2"
              onClick={onPostComparison}
            >
              <Share2 className="w-5 h-5" />
              Post comparison
            </GlassButton>
          ) : (
            <GlassButton
              variant="primary"
              size="lg"
              className="w-full flex items-center justify-center gap-2"
              onClick={onInvite}
            >
              <UserPlus className="w-5 h-5" />
              Invite friend
            </GlassButton>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};
