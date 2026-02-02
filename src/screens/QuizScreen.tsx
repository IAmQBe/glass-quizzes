import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { ProgressBar } from "@/components/ProgressBar";
import { Question } from "@/types/quiz";

interface QuizScreenProps {
  questions: Question[];
  currentQuestion: number;
  onAnswer: (answerIndex: number) => void;
}

export const QuizScreen = ({ questions, currentQuestion, onAnswer }: QuizScreenProps) => {
  const question = questions[currentQuestion];

  return (
    <motion.div
      className="min-h-screen flex flex-col p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Progress */}
      <div className="mb-2">
        <ProgressBar current={currentQuestion + 1} total={questions.length} />
      </div>
      <div className="text-center text-sm text-muted-foreground mb-8">
        {currentQuestion + 1} / {questions.length}
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -50, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="flex-1 flex flex-col justify-center"
        >
          <motion.h2
            className="text-xl font-semibold text-center text-foreground mb-8 px-2"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {question.text}
          </motion.h2>

          <div className="space-y-3">
            {question.options.map((option, index) => (
              <motion.div
                key={index}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 + index * 0.05 }}
              >
                <GlassCard
                  variant="option"
                  onClick={() => onAnswer(index)}
                  className="text-center"
                >
                  <span className="text-foreground font-medium">{option}</span>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};
