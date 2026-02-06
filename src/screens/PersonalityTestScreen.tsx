import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  usePersonalityTestWithDetails,
  useSubmitPersonalityTestCompletion,
  calculatePersonalityResult,
  PersonalityTestQuestion,
  PersonalityTestResult
} from "@/hooks/usePersonalityTests";
import { haptic } from "@/lib/telegram";
import { GifImage } from "@/components/GifImage";

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface PersonalityTestScreenProps {
  testId: string;
  onBack: () => void;
  onComplete: (result: PersonalityTestResult, testTitle: string, testId: string) => void;
}

export const PersonalityTestScreen = ({ testId, onBack, onComplete }: PersonalityTestScreenProps) => {
  const { data, isLoading, error } = usePersonalityTestWithDetails(testId);
  const submitCompletion = useSubmitPersonalityTestCompletion();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Shuffle questions once when data loads
  const shuffledQuestions = useMemo(() => {
    if (!data?.questions) return [];
    return shuffleArray(data.questions);
  }, [data?.questions]);

  const handleBack = () => {
    haptic.selection();
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setAnswers(prev => prev.slice(0, -1));
    } else {
      onBack();
    }
  };

  const handleAnswer = async (answerIndex: number) => {
    haptic.impact('light');

    const newAnswers = [...answers, answerIndex];
    setAnswers(newAnswers);

    // Check if this was the last question
    if (shuffledQuestions.length > 0 && currentQuestionIndex === shuffledQuestions.length - 1) {
      // Calculate result using shuffled questions
      setIsSubmitting(true);

      const resultKey = calculatePersonalityResult(newAnswers, shuffledQuestions);
      const result = data?.results.find(r => r.result_key === resultKey);

      if (!result) {
        console.error("Result not found for key:", resultKey);
        setIsSubmitting(false);
        return;
      }

      try {
        await submitCompletion.mutateAsync({
          testId,
          resultKey,
          answers: newAnswers,
        });

        haptic.notification('success');
        onComplete(result, data.test.title, testId);
      } catch (err) {
        console.error("Failed to submit completion:", err);
        // Still show result even if saving failed
        onComplete(result, data.test.title, testId);
      }
    } else {
      // Move to next question
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-red-500 mb-4">Ошибка загрузки теста</p>
        <button className="tg-button-secondary" onClick={onBack}>
          Назад
        </button>
      </div>
    );
  }

  const { test } = data;
  const currentQuestion = shuffledQuestions[currentQuestionIndex];

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground mb-4">В этом тесте пока нет вопросов</p>
        <button className="tg-button-secondary" onClick={onBack}>
          Назад
        </button>
      </div>
    );
  }

  const totalQuestions = Math.max(shuffledQuestions.length, 1);
  const progress = (currentQuestionIndex / totalQuestions) * 100;

  return (
    <motion.div
      className="min-h-screen flex flex-col pb-24"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="sticky top-0 bg-background/80 backdrop-blur-lg z-10 px-4 py-3 border-b border-border">
        <div className="flex items-center">
          <button className="p-2 -ml-2 text-primary" onClick={handleBack}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-sm font-medium text-foreground line-clamp-1">{test.title}</h1>
            <p className="text-xs text-muted-foreground">
              Вопрос {currentQuestionIndex + 1} из {shuffledQuestions.length}
            </p>
          </div>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{
              duration: 0.4,
              ease: [0.25, 0.46, 0.45, 0.94] // easeOutQuad
            }}
            className="space-y-6"
          >
            {/* Question image */}
            {currentQuestion.image_url && (
              <motion.div
                className="rounded-xl overflow-hidden"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <GifImage
                  src={currentQuestion.image_url}
                  alt=""
                  className="w-full h-48 object-cover"
                />
              </motion.div>
            )}

            {/* Question text */}
            <motion.h2
              className="text-xl font-semibold text-foreground text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              {currentQuestion.question_text}
            </motion.h2>

            {/* Answers */}
            <div className="space-y-3">
              {currentQuestion.answers?.map((answer, index) => (
                <motion.button
                  key={answer.id}
                  className="w-full p-4 rounded-xl bg-card border border-border text-left
                    active:border-purple-500 active:bg-purple-500/5 
                    active:scale-[0.98] transition-colors touch-manipulation"
                  onClick={() => handleAnswer(index)}
                  disabled={isSubmitting}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.35,
                    delay: 0.2 + index * 0.08,
                    ease: [0.25, 0.46, 0.45, 0.94]
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  <span className="text-foreground">{answer.answer_text}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Loading overlay */}
      {isSubmitting && (
        <motion.div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto mb-4" />
            <p className="text-foreground">Определяем результат...</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
