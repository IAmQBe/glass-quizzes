import { motion } from "framer-motion";
import { Friend, QuizResult } from "@/types/quiz";
import { UserPlus, Share2, ArrowLeft, Clock } from "lucide-react";
import { haptic, challengeFriend } from "@/lib/telegram";

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

  const handleInvite = () => {
    haptic.impact('medium');
    challengeFriend();
    onInvite();
  };

  const handleBack = () => {
    haptic.selection();
    onBack();
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col p-5 pb-24 safe-bottom"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <motion.div
        className="flex items-center mb-6"
        initial={{ y: -15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <button
          className="p-2 -ml-2 text-primary"
          onClick={handleBack}
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold text-foreground pr-8">
          Compare Results
        </h1>
      </motion.div>

      {/* Comparison Cards */}
      <div className="flex-1 flex flex-col justify-center">
        <motion.div
          className="flex gap-3 mb-6"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          {/* Your Card */}
          <div className={`tg-section flex-1 p-4 text-center ${userWins ? 'ring-2 ring-green-500' : ''}`}>
            <div className="tg-avatar w-14 h-14 mx-auto mb-3">
              <span className="text-2xl">👤</span>
            </div>
            <p className="text-sm text-muted-foreground mb-1">You</p>
            <p className="text-3xl font-bold text-foreground mb-1">{userResult.score}</p>
            <p className="text-xs text-muted-foreground">Top {userResult.percentile}%</p>
          </div>

          {/* VS */}
          <div className="flex items-center justify-center px-1">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <span className="text-xs font-bold text-muted-foreground">VS</span>
            </div>
          </div>

          {/* Friend Card */}
          <div className={`tg-section flex-1 p-4 text-center ${friendWins ? 'ring-2 ring-green-500' : ''} ${!hasCompleted ? 'opacity-60' : ''}`}>
            {hasCompleted && friend ? (
              <>
                <div className="tg-avatar w-14 h-14 mx-auto mb-3">
                  <span className="text-2xl">🎯</span>
                </div>
                <p className="text-sm text-muted-foreground mb-1">{friend.name}</p>
                <p className="text-3xl font-bold text-foreground mb-1">{friend.score}</p>
                <p className="text-xs text-muted-foreground">
                  {friend.score !== undefined && friend.score > userResult.score
                    ? `+${friend.score - userResult.score}`
                    : friend.score !== undefined && friend.score < userResult.score
                      ? `-${userResult.score - friend.score}`
                      : "Tied"
                  }
                </p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 mx-auto mb-3 rounded-full border-2 border-dashed border-muted flex items-center justify-center">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">Waiting...</p>
                <p className="text-3xl font-bold text-muted-foreground mb-1">—</p>
                <p className="text-xs text-muted-foreground">Not completed</p>
              </>
            )}
          </div>
        </motion.div>

        {/* Status */}
        {!hasCompleted && (
          <motion.div
            className="text-center mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <p className="text-sm text-muted-foreground px-4">
              Challenge isn't complete until your friend takes the test
            </p>
          </motion.div>
        )}

        {/* Action */}
        <motion.div
          className="max-w-sm mx-auto w-full"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {hasCompleted ? (
            <button
              className="tg-button flex items-center justify-center gap-2"
              onClick={() => {
                haptic.notification('success');
                onPostComparison();
              }}
            >
              <Share2 className="w-5 h-5" />
              Post comparison
            </button>
          ) : (
            <button
              className="tg-button flex items-center justify-center gap-2"
              onClick={handleInvite}
            >
              <UserPlus className="w-5 h-5" />
              Invite friend
            </button>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};