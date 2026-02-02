import { Question, QuizResult } from "@/types/quiz";

export const sampleQuestions: Question[] = [
  {
    id: 1,
    text: "How do you handle pressure in a crisis?",
    options: ["Stay calm and analyze", "Take immediate action", "Seek advice from others", "Trust my instincts"],
  },
  {
    id: 2,
    text: "What drives your decisions most?",
    options: ["Logic and facts", "Emotions and intuition", "What others think", "Past experiences"],
  },
  {
    id: 3,
    text: "When facing failure, you typically...",
    options: ["Learn and adapt quickly", "Need time to process", "Seek support", "Move on immediately"],
  },
  {
    id: 4,
    text: "Your ideal weekend involves...",
    options: ["Solo adventures", "Social gatherings", "Learning something new", "Complete relaxation"],
  },
  {
    id: 5,
    text: "How do you approach new challenges?",
    options: ["Head-on with confidence", "Careful planning first", "Ask for guidance", "Avoid if possible"],
  },
];

export const verdicts = [
  { min: 0, max: 30, text: "Still finding your path", emoji: "🌱" },
  { min: 31, max: 50, text: "Growing stronger each day", emoji: "🔥" },
  { min: 51, max: 70, text: "A force to be reckoned with", emoji: "⚡" },
  { min: 71, max: 85, text: "Rare level of clarity", emoji: "💎" },
  { min: 86, max: 100, text: "Top 1% mental fortitude", emoji: "🏆" },
];

export const getVerdict = (score: number): { text: string; emoji: string } => {
  const verdict = verdicts.find((v) => score >= v.min && score <= v.max);
  return verdict ? { text: verdict.text, emoji: verdict.emoji } : { text: "Unique result", emoji: "✨" };
};

export const calculateResult = (answers: number[]): QuizResult => {
  // Simulate scoring based on answers
  const baseScore = answers.reduce((sum, answer) => sum + (answer === 0 ? 20 : answer === 1 ? 18 : answer === 2 ? 15 : 12), 0);
  const score = Math.min(100, Math.max(0, baseScore));
  const percentile = Math.round(100 - (score * 0.8 + Math.random() * 15));
  const verdict = getVerdict(score);
  
  return {
    score,
    maxScore: 100,
    percentile: Math.max(1, Math.min(99, percentile)),
    verdict: verdict.text,
    verdictEmoji: verdict.emoji,
  };
};
