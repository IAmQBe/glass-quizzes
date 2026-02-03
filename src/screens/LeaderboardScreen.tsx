import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Star, Crown, Medal, ArrowLeft, Swords, BookOpen, Award } from "lucide-react";
import { haptic } from "@/lib/telegram";
import { PopcornIcon } from "@/components/icons/PopcornIcon";

type SortCategory = "trophies" | "challenges" | "quizzes" | "popcorns";

interface LeaderEntry {
  rank: number;
  username: string;
  score: number;
  hasPremium: boolean;
  quizzesTaken: number;
  challengeWins: number;
  popcorns: number;
  isCreator: boolean;
}

interface LeaderboardScreenProps {
  onBack: () => void;
}

// Mock data - will be replaced with real data from backend
const mockLeaderboard: LeaderEntry[] = [
  { rank: 1, username: "BrainMaster", score: 9847, hasPremium: true, quizzesTaken: 156, challengeWins: 89, popcorns: 0, isCreator: false },
  { rank: 2, username: "QuizKing", score: 9234, hasPremium: true, quizzesTaken: 142, challengeWins: 76, popcorns: 0, isCreator: false },
  { rank: 3, username: "MindPro", score: 8956, hasPremium: false, quizzesTaken: 138, challengeWins: 72, popcorns: 0, isCreator: false },
  { rank: 4, username: "TestGenius", score: 8721, hasPremium: true, quizzesTaken: 129, challengeWins: 65, popcorns: 0, isCreator: false },
  { rank: 5, username: "SmartPlayer", score: 8543, hasPremium: false, quizzesTaken: 124, challengeWins: 58, popcorns: 0, isCreator: false },
  { rank: 6, username: "QuizWizard", score: 8234, hasPremium: false, quizzesTaken: 118, challengeWins: 52, popcorns: 3240, isCreator: true },
  { rank: 7, username: "BrainStorm", score: 7965, hasPremium: true, quizzesTaken: 112, challengeWins: 48, popcorns: 2890, isCreator: true },
  { rank: 8, username: "MindMaster", score: 7654, hasPremium: false, quizzesTaken: 105, challengeWins: 41, popcorns: 0, isCreator: false },
  { rank: 9, username: "TestPro", score: 7432, hasPremium: false, quizzesTaken: 98, challengeWins: 35, popcorns: 1560, isCreator: true },
  { rank: 10, username: "QuizChamp", score: 7123, hasPremium: true, quizzesTaken: 94, challengeWins: 29, popcorns: 0, isCreator: false },
];

// Creator leaderboard mock data
const mockCreatorLeaderboard: LeaderEntry[] = [
  { rank: 1, username: "QuizMaster", score: 0, hasPremium: true, quizzesTaken: 45, challengeWins: 0, popcorns: 15420, isCreator: true },
  { rank: 2, username: "BrainGenius", score: 0, hasPremium: true, quizzesTaken: 32, challengeWins: 0, popcorns: 12890, isCreator: true },
  { rank: 3, username: "TestPro", score: 0, hasPremium: false, quizzesTaken: 28, challengeWins: 0, popcorns: 9540, isCreator: true },
  { rank: 4, username: "MindExplorer", score: 0, hasPremium: true, quizzesTaken: 21, challengeWins: 0, popcorns: 8720, isCreator: true },
  { rank: 5, username: "QuizNinja", score: 0, hasPremium: false, quizzesTaken: 19, challengeWins: 0, popcorns: 7650, isCreator: true },
  { rank: 6, username: "BrainStorm", score: 0, hasPremium: false, quizzesTaken: 15, challengeWins: 0, popcorns: 6340, isCreator: true },
  { rank: 7, username: "QuizWizard", score: 0, hasPremium: true, quizzesTaken: 12, challengeWins: 0, popcorns: 5890, isCreator: true },
  { rank: 8, username: "TestKing", score: 0, hasPremium: false, quizzesTaken: 9, challengeWins: 0, popcorns: 4520, isCreator: true },
  { rank: 9, username: "MindMaker", score: 0, hasPremium: false, quizzesTaken: 7, challengeWins: 0, popcorns: 3210, isCreator: true },
  { rank: 10, username: "QuizPro", score: 0, hasPremium: true, quizzesTaken: 5, challengeWins: 0, popcorns: 2150, isCreator: true },
];

const categories: { id: SortCategory; label: string; icon: React.ReactNode }[] = [
  { id: "trophies", label: "Кубки", icon: <Trophy className="w-4 h-4" /> },
  { id: "challenges", label: "Челленджи", icon: <Swords className="w-4 h-4" /> },
  { id: "quizzes", label: "Тесты", icon: <BookOpen className="w-4 h-4" /> },
  { id: "popcorns", label: "Попкорны", icon: <PopcornIcon className="w-4 h-4" /> },
];

export const LeaderboardScreen = ({ onBack }: LeaderboardScreenProps) => {
  const [sortBy, setSortBy] = useState<SortCategory>("trophies");

  const getSortedData = () => {
    if (sortBy === "popcorns") {
      return mockCreatorLeaderboard;
    }
    
    const data = [...mockLeaderboard];
    switch (sortBy) {
      case "challenges":
        return data.sort((a, b) => b.challengeWins - a.challengeWins);
      case "quizzes":
        return data.sort((a, b) => b.quizzesTaken - a.quizzesTaken);
      case "trophies":
      default:
        return data.sort((a, b) => b.score - a.score);
    }
  };

  const getDisplayValue = (entry: LeaderEntry) => {
    switch (sortBy) {
      case "challenges":
        return { value: entry.challengeWins, suffix: "wins" };
      case "quizzes":
        return { value: entry.quizzesTaken, suffix: "тестов" };
      case "popcorns":
        return { value: entry.popcorns, suffix: "" };
      case "trophies":
      default:
        return { value: entry.score, suffix: "pts" };
    }
  };

  const getDisplayIcon = () => {
    switch (sortBy) {
      case "challenges":
        return <Swords className="w-4 h-4 text-primary" />;
      case "quizzes":
        return <BookOpen className="w-4 h-4 text-primary" />;
      case "popcorns":
        return <PopcornIcon className="w-4 h-4 text-primary" />;
      case "trophies":
      default:
        return <Trophy className="w-4 h-4 text-primary" />;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  const sortedData = getSortedData();
  const top3 = sortedData.slice(0, 3);
  const rest = sortedData.slice(3);

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

  const getCategoryTitle = () => {
    switch (sortBy) {
      case "challenges":
        return "Победители челленджей";
      case "quizzes":
        return "Больше всего тестов";
      case "popcorns":
        return "Топ создателей";
      case "trophies":
      default:
        return "Лучшие по очкам";
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
          <div className="w-10" />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-4 py-3 overflow-x-auto">
        <div className="flex gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                haptic.selection();
                setSortBy(cat.id);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                sortBy === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {cat.icon}
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category subtitle */}
      <div className="px-4 pb-2">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          {getDisplayIcon()}
          {getCategoryTitle()}
        </p>
      </div>

      {/* Top 3 Podium */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={sortBy}
          className="px-4 py-6 bg-gradient-to-b from-primary/5 to-transparent"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
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
                <span className="font-bold text-foreground text-sm truncate max-w-[72px]">
                  {top3[1]?.username.slice(0, 8)}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {sortBy === "popcorns" && <PopcornIcon className="w-3 h-3" />}
                  {formatNumber(getDisplayValue(top3[1]).value)}
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
                <span className="font-bold text-foreground truncate max-w-[88px]">
                  {top3[0]?.username.slice(0, 10)}
                </span>
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  {sortBy === "popcorns" && <PopcornIcon className="w-3.5 h-3.5" />}
                  {formatNumber(getDisplayValue(top3[0]).value)}
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
                <span className="font-bold text-foreground text-sm truncate max-w-[72px]">
                  {top3[2]?.username.slice(0, 8)}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {sortBy === "popcorns" && <PopcornIcon className="w-3 h-3" />}
                  {formatNumber(getDisplayValue(top3[2]).value)}
                </span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Rest of Leaderboard */}
      <div className="px-4 flex-1">
        <div className="tg-section divide-y divide-border">
          <AnimatePresence mode="wait">
            <motion.div
              key={sortBy}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {rest.map((entry, index) => {
                const display = getDisplayValue(entry);
                return (
                  <motion.div
                    key={`${sortBy}-${entry.username}`}
                    className="flex items-center gap-3 px-4 py-3"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.05 + index * 0.03 }}
                  >
                    {getRankIcon(index + 4)}

                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-lg">
                        {sortBy === "popcorns" ? "👨‍🍳" : "🧠"}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-foreground truncate">
                          {entry.username}
                        </span>
                        {entry.hasPremium && (
                          <Star className="w-3.5 h-3.5 text-primary fill-primary flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {sortBy === "popcorns" 
                          ? `${entry.quizzesTaken} квизов`
                          : `${entry.quizzesTaken} тестов`
                        }
                      </span>
                    </div>

                    <div className="text-right flex items-center gap-1">
                      {sortBy === "popcorns" && <PopcornIcon className="w-4 h-4 text-primary" />}
                      <span className="font-bold text-foreground">{formatNumber(display.value)}</span>
                      {display.suffix && (
                        <span className="text-xs text-muted-foreground">{display.suffix}</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
