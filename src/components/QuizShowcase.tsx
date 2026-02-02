import { motion } from "framer-motion";
import { QuizCard } from "./QuizCard";
import { Quiz } from "@/hooks/useQuizzes";
import { Loader2 } from "lucide-react";

interface QuizShowcaseProps {
  quizzes: Quiz[];
  isLoading: boolean;
  onQuizSelect: (quizId: string) => void;
  favoriteIds?: Set<string>;
  onToggleFavorite?: (quizId: string) => void;
}

export const QuizShowcase = ({ 
  quizzes, 
  isLoading, 
  onQuizSelect,
  favoriteIds = new Set(),
  onToggleFavorite,
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
            rating={(quiz as any).rating}
            rating_count={(quiz as any).rating_count}
            isFavorite={favoriteIds.has(quiz.id)}
            showFavoriteButton={!!onToggleFavorite}
            onClick={() => onQuizSelect(quiz.id)}
            onToggleFavorite={() => onToggleFavorite?.(quiz.id)}
          />
        </motion.div>
      ))}
    </div>
  );
};