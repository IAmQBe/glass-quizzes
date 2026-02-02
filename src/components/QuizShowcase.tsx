import { motion } from "framer-motion";
import { QuizCard } from "./QuizCard";
import { Quiz } from "@/hooks/useQuizzes";
import { Loader2 } from "lucide-react";

interface QuizShowcaseProps {
  quizzes: Quiz[];
  isLoading: boolean;
  onQuizSelect: (quizId: string) => void;
}

export const QuizShowcase = ({ quizzes, isLoading, onQuizSelect }: QuizShowcaseProps) => {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (quizzes.length === 0) {
    return (
      <div className="tg-section p-6 text-center">
        <p className="text-muted-foreground">No quizzes available yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {quizzes.map((quiz, index) => (
        <motion.div
          key={quiz.id}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: index * 0.05 }}
        >
          <QuizCard
            id={quiz.id}
            title={quiz.title}
            description={quiz.description || undefined}
            image_url={quiz.image_url || undefined}
            participant_count={quiz.participant_count}
            question_count={quiz.question_count}
            duration_seconds={quiz.duration_seconds}
            onClick={() => onQuizSelect(quiz.id)}
          />
        </motion.div>
      ))}
    </div>
  );
};