import { motion } from "framer-motion";
import { QuizCard } from "./QuizCard";
import { Quiz } from "@/hooks/useQuizzes";
import { Loader2 } from "lucide-react";

interface QuizShowcaseProps {
  quizzes: Quiz[];
  isLoading: boolean;
  onQuizSelect: (quizId: string) => void;
  likeIds?: Set<string>;
  saveIds?: Set<string>;
  completedIds?: Set<string>;
  onToggleLike?: (quizId: string) => void;
  onToggleSave?: (quizId: string) => void;
}

export const QuizShowcase = ({ 
  quizzes, 
  isLoading, 
  onQuizSelect,
  likeIds = new Set(),
  saveIds = new Set(),
  completedIds = new Set(),
  onToggleLike,
  onToggleSave,
}: QuizShowcaseProps) => {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (quizzes.length === 0) {
    return null;
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
            like_count={(quiz as any).like_count ?? 0}
            save_count={(quiz as any).save_count ?? 0}
            isLiked={likeIds.has(quiz.id)}
            isSaved={saveIds.has(quiz.id)}
            isCompleted={completedIds.has(quiz.id)}
            creator={(quiz as any).creator}
            onClick={() => onQuizSelect(quiz.id)}
            onToggleLike={onToggleLike ? () => onToggleLike(quiz.id) : undefined}
            onToggleSave={onToggleSave ? () => onToggleSave(quiz.id) : undefined}
          />
        </motion.div>
      ))}
    </div>
  );
};
