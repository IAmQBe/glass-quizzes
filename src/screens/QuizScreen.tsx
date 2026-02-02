import { motion, AnimatePresence } from "framer-motion";
import { Question } from "@/types/quiz";
import { haptic } from "@/lib/telegram";

interface QuizScreenProps {
  questions: Question[];
  currentQuestion: number;
  onAnswer: (answerIndex: number) => void;
}

export const QuizScreen = ({ questions, currentQuestion, onAnswer }: QuizScreenProps) => {
  const question = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  const handleAnswer = (index: number) => {
    haptic.impact('light');
    onAnswer(index);
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col p-5 safe-bottom"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Progress */}
      <div className="mb-2">
        <div className="tg-progress">
          <motion.div
            className="tg-progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>
      <div className="text-center text-sm text-muted-foreground mb-6">
        {currentQuestion + 1} of {questions.length}
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          className="flex-1 flex flex-col"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -40, opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <motion.h2
            className="text-xl font-semibold text-center text-foreground mb-8 px-2"
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {question.text}
          </motion.h2>

          <div className="space-y-3 flex-1">
            {question.options.map((option, index) => (
              <motion.button
                key={index}
                className="tg-option w-full text-left"
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.12 + index * 0.04 }}
                onClick={() => handleAnswer(index)}
              >
                <span className="text-foreground font-medium">{option}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};