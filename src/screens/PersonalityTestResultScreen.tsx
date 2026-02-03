import { motion } from "framer-motion";
import { Share2, Users, Home, RotateCcw, Sparkles } from "lucide-react";
import { PersonalityTestResult } from "@/hooks/usePersonalityTests";
import { haptic, sharePersonalityTestResult } from "@/lib/telegram";

interface PersonalityTestResultScreenProps {
  result: PersonalityTestResult;
  testTitle: string;
  testId: string;
  onHome: () => void;
  onRetry: () => void;
  onChallenge: () => void;
}

export const PersonalityTestResultScreen = ({
  result,
  testTitle,
  testId,
  onHome,
  onRetry,
  onChallenge,
}: PersonalityTestResultScreenProps) => {
  const handleShare = () => {
    haptic.notification('success');
    sharePersonalityTestResult(result.title, result.share_text || result.description, testId, testTitle, result.image_url);
  };

  const handleChallenge = () => {
    haptic.impact('medium');
    onChallenge();
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col p-5 pb-24 safe-bottom"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Result Display */}
      <motion.div
        className="flex-1 flex flex-col items-center justify-center"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
      >
        {/* Badge */}
        <motion.div
          className="mb-4 px-3 py-1 rounded-full bg-purple-500/20 text-purple-500 text-sm font-medium flex items-center gap-1"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Sparkles className="w-4 h-4" />
          Результат теста
        </motion.div>

        {/* Character Image */}
        {result.image_url && (
          <motion.div
            className="w-48 h-48 rounded-2xl overflow-hidden mb-6 shadow-lg"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            <img
              src={result.image_url}
              alt={result.title}
              className="w-full h-full object-cover"
            />
          </motion.div>
        )}

        {/* No image fallback */}
        {!result.image_url && (
          <motion.div
            className="tg-avatar w-32 h-32 mb-6"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <span className="text-6xl">🎭</span>
          </motion.div>
        )}

        {/* Title */}
        <motion.h1
          className="text-2xl font-bold text-foreground text-center mb-2"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {result.title}
        </motion.h1>

        {/* Test name */}
        <motion.p
          className="text-sm text-muted-foreground text-center mb-4"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.45 }}
        >
          {testTitle}
        </motion.p>

        {/* Description */}
        <motion.p
          className="text-base text-foreground/80 text-center max-w-sm leading-relaxed"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {result.description}
        </motion.p>
      </motion.div>

      {/* Actions */}
      <motion.div
        className="w-full max-w-sm mx-auto space-y-3"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        {/* Main Home button */}
        <button
          className="tg-button flex items-center justify-center gap-2"
          onClick={() => {
            haptic.selection();
            onHome();
          }}
        >
          <Home className="w-5 h-5" />
          На главную
        </button>

        {/* Share and Challenge in row */}
        <div className="flex gap-3">
          <button
            type="button"
            className="tg-button-secondary flex-1 flex items-center justify-center gap-2"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleShare();
            }}
          >
            <Share2 className="w-4 h-4" />
            Поделиться
          </button>

          <button
            className="tg-button-secondary flex-1 flex items-center justify-center gap-2"
            onClick={handleChallenge}
          >
            <Users className="w-4 h-4" />
            Вызвать
          </button>
        </div>

        {/* Retry */}
        <button
          className="tg-button-secondary flex items-center justify-center gap-2 w-full"
          onClick={() => {
            haptic.selection();
            onRetry();
          }}
        >
          <RotateCcw className="w-4 h-4" />
          Пройти ещё раз
        </button>
      </motion.div>
    </motion.div>
  );
};
