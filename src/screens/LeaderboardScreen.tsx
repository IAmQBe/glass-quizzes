import { motion } from "framer-motion";
import { Trophy, Star, Crown, Medal, ArrowLeft, Filter } from "lucide-react";
import { haptic } from "@/lib/telegram";

interface LeaderEntry {
  rank: number;
  username: string;
  score: number;
  hasPremium: boolean;
  quizzesTaken: number;
}

interface LeaderboardScreenProps {
  onBack: () => void;
}

// Mock data - will be replaced with real data from backend
const mockLeaderboard: LeaderEntry[] = [
  { rank: 1, username: "BrainMaster", score: 9847, hasPremium: true, quizzesTaken: 156 },
  { rank: 2, username: "QuizKing", score: 9234, hasPremium: true, quizzesTaken: 142 },
  { rank: 3, username: "MindPro", score: 8956, hasPremium: false, quizzesTaken: 138 },
  { rank: 4, username: "TestGenius", score: 8721, hasPremium: true, quizzesTaken: 129 },
  { rank: 5, username: "SmartPlayer", score: 8543, hasPremium: false, quizzesTaken: 124 },
  { rank: 6, username: "QuizWizard", score: 8234, hasPremium: false, quizzesTaken: 118 },
  { rank: 7, username: "BrainStorm", score: 7965, hasPremium: true, quizzesTaken: 112 },
  { rank: 8, username: "MindMaster", score: 7654, hasPremium: false, quizzesTaken: 105 },
  { rank: 9, username: "TestPro", score: 7432, hasPremium: false, quizzesTaken: 98 },
  { rank: 10, username: "QuizChamp", score: 7123, hasPremium: true, quizzesTaken: 94 },
];

export const LeaderboardScreen = ({ onBack }: LeaderboardScreenProps) => {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />;
      default:
        return (
          <span className="text-base font-bold text-muted-foreground w-6 text-center">
            {rank}
          </span>
        );
    }
  };

  return (
    <motion.div
      className="flex flex-col min-h-screen pb-24"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="sticky top-0 bg-background/80 backdrop-blur-lg z-10 px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <button
            className="p-2 -ml-2 text-primary"
            onClick={() => {
              haptic.selection();
              onBack();
            }}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Leaderboard</h1>
          <button className="p-2 -mr-2 text-muted-foreground">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Top 3 Podium */}
      <div className="px-4 py-6 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="flex items-end justify-center gap-2">
          {/* 2nd Place */}
          <motion.div
            className="flex flex-col items-center"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mb-2">
              <span className="text-2xl">🥈</span>
            </div>
            <div className="bg-gray-200 rounded-t-lg w-20 h-16 flex flex-col items-center justify-center">
              <span className="font-bold text-foreground text-sm">
                {mockLeaderboard[1]?.username.slice(0, 8)}
              </span>
              <span className="text-xs text-muted-foreground">
                {mockLeaderboard[1]?.score}
              </span>
            </div>
          </motion.div>

          {/* 1st Place */}
          <motion.div
            className="flex flex-col items-center"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
          >
            <Crown className="w-6 h-6 text-yellow-500 mb-1" />
            <div className="w-20 h-20 rounded-full bg-yellow-100 border-4 border-yellow-400 flex items-center justify-center mb-2">
              <span className="text-3xl">🏆</span>
            </div>
            <div className="bg-yellow-100 rounded-t-lg w-24 h-20 flex flex-col items-center justify-center">
              <span className="font-bold text-foreground">
                {mockLeaderboard[0]?.username.slice(0, 10)}
              </span>
              <span className="text-sm text-muted-foreground">
                {mockLeaderboard[0]?.score}
              </span>
            </div>
          </motion.div>

          {/* 3rd Place */}
          <motion.div
            className="flex flex-col items-center"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-2">
              <span className="text-2xl">🥉</span>
            </div>
            <div className="bg-amber-100 rounded-t-lg w-20 h-14 flex flex-col items-center justify-center">
              <span className="font-bold text-foreground text-sm">
                {mockLeaderboard[2]?.username.slice(0, 8)}
              </span>
              <span className="text-xs text-muted-foreground">
                {mockLeaderboard[2]?.score}
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Rest of Leaderboard */}
      <div className="px-4 flex-1">
        <div className="tg-section divide-y divide-border">
          {mockLeaderboard.slice(3).map((entry, index) => (
            <motion.div
              key={entry.rank}
              className="flex items-center gap-3 px-4 py-3"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 + index * 0.03 }}
            >
              {getRankIcon(entry.rank)}

              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-lg">🧠</span>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <span className="font-medium text-foreground">
                    {entry.username}
                  </span>
                  {entry.hasPremium && (
                    <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {entry.quizzesTaken} quizzes
                </span>
              </div>

              <div className="text-right">
                <span className="font-bold text-foreground">{entry.score}</span>
                <span className="text-xs text-muted-foreground ml-1">pts</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};