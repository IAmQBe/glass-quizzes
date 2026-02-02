import { useState, useCallback } from "react";
import { Question, QuizResult } from "@/types/quiz";
import { sampleQuestions, calculateResult } from "@/data/quizData";

export type QuizScreen = "welcome" | "quiz" | "result" | "compare" | "profile";

export const useQuiz = () => {
  const [currentScreen, setCurrentScreen] = useState<QuizScreen>("welcome");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [questions] = useState<Question[]>(sampleQuestions);

  const startQuiz = useCallback(() => {
    setCurrentQuestion(0);
    setAnswers([]);
    setResult(null);
    setCurrentScreen("quiz");
  }, []);

  const answerQuestion = useCallback((answerIndex: number) => {
    const newAnswers = [...answers, answerIndex];
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setTimeout(() => {
        setCurrentQuestion((prev) => prev + 1);
      }, 300);
    } else {
      // Quiz complete
      setTimeout(() => {
        const quizResult = calculateResult(newAnswers);
        setResult(quizResult);
        setCurrentScreen("result");
      }, 500);
    }
  }, [answers, currentQuestion, questions.length]);

  const goToScreen = useCallback((screen: QuizScreen) => {
    setCurrentScreen(screen);
  }, []);

  const restartQuiz = useCallback(() => {
    startQuiz();
  }, [startQuiz]);

  return {
    currentScreen,
    currentQuestion,
    questions,
    result,
    startQuiz,
    answerQuestion,
    goToScreen,
    restartQuiz,
  };
};
