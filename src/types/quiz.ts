export interface Question {
  id: number;
  text: string;
  options: string[];
}

export interface QuizResult {
  score: number;
  maxScore: number;
  percentile: number;
  verdict: string;
  verdictEmoji: string;
}

export interface UserStats {
  bestScore: number;
  testsCompleted: number;
  globalRank: number;
  activeChallenges: number;
}

export interface Friend {
  id: string;
  name: string;
  avatar?: string;
  score?: number;
  hasCompleted: boolean;
}
