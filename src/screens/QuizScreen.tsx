import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock } from "lucide-react";
import { Question } from "@/types/quiz";
import { haptic } from "@/lib/telegram";
import { sampleQuestions } from "@/data/quizData";

interface QuizScreenProps {
  questions?: { id: number; text: string; options: string[] }[];
  currentQuestion: number;
  onAnswer: (answerIndex: number) => void;
  durationSeconds?: number;
  onTimeUp?: () => void;
}

export const QuizScreen = ({ 
  questions, 
  currentQuestion, 
  onAnswer,
  durationSeconds = 0,
  onTimeUp
}: QuizScreenProps) => {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  
  // Timer logic
  useEffect(() => {
    if (durationSeconds <= 0) return;
    setTimeLeft(durationSeconds);
  }, [durationSeconds]);
  
  useEffect(() => {
    if (timeLeft <= 0 || durationSeconds <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeUp?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft, durationSeconds, onTimeUp]);
  
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);
  
  const timerColor = timeLeft <= 10 ? 'text-red-500' : timeLeft <= 30 ? 'text-orange-500' : 'text-muted-foreground';

  // Use sample questions if none provided
  const quizQuestions = questions || sampleQuestions.map(q => ({
    id: q.id,
    text: q.text,
    options: q.options,
  }));

  const question = quizQuestions[currentQuestion];
  const progress = ((currentQuestion + 1) / quizQuestions.length) * 100;

  const handleAnswer = (index: number) => {
    haptic.impact('light');
    onAnswer(index);
  };

  if (!question) return null;

  return (
    <motion.div
      className="min-h-screen flex flex-col p-5 safe-bottom"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Progress & Timer */}
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
      <div className="flex items-center justify-between text-sm text-muted-foreground mb-6 px-1">
        <span>{currentQuestion + 1} из {quizQuestions.length}</span>
        {durationSeconds > 0 && (
          <motion.div 
            className={`flex items-center gap-1 font-medium ${timerColor}`}
            animate={timeLeft <= 10 ? { scale: [1, 1.1, 1] } : {}}
            transition={{ repeat: timeLeft <= 10 ? Infinity : 0, duration: 1 }}
          >
            <Clock className="w-4 h-4" />
            <span>{formatTime(timeLeft)}</span>
          </motion.div>
        )}
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          className="flex-1 flex flex-col"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{
            duration: 0.4,
            ease: [0.25, 0.46, 0.45, 0.94]
          }}
        >
          <motion.h2
            className="text-xl font-semibold text-center text-foreground mb-8 px-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {question.text}
          </motion.h2>

          <div className="space-y-3 flex-1">
            {question.options.map((option, index) => (
              <motion.button
                key={index}
                className="tg-option w-full text-left touch-manipulation"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.35,
                  delay: 0.15 + index * 0.08,
                  ease: [0.25, 0.46, 0.45, 0.94]
                }}
                whileTap={{ scale: 0.97 }}
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