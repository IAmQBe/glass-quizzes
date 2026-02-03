import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Star, Crown, Medal, ArrowLeft, Swords, BookOpen, Loader2 } from "lucide-react";
import { haptic } from "@/lib/telegram";
import { PopcornIcon } from "@/components/icons/PopcornIcon";
import { toast } from "@/hooks/use-toast";
import { useLeaderboard, LeaderboardCategory, LeaderboardEntry, getLeaderboardValue, formatNumber } from "@/hooks/useLeaderboard";

interface LeaderboardScreenProps {
  onBack: () => void;
}

const categories: { id: LeaderboardCategory; label: string; icon: React.ReactNode }[] = [
  { id: "score", label: "Кубки", icon: <Trophy className="w-4 h-4" /> },
  { id: "challenges", label: "Челленджи", icon: <Swords className="w-4 h-4" /> },
  { id: "quizzes", label: "Тесты", icon: <BookOpen className="w-4 h-4" /> },
  { id: "popcorns", label: "Попкорны", icon: <PopcornIcon className="w-4 h-4" /> },
];

export const LeaderboardScreen = ({ onBack }: LeaderboardScreenProps) => {
  const [sortBy, setSortBy] = useState<LeaderboardCategory>("score");
  const [challengedUsers, setChallengedUsers] = useState<Set<string>>(new Set());
  
  const { data: leaderboard = [], isLoading, error } = useLeaderboard(sortBy);

  const getDisplayValue = (entry: LeaderboardEntry) => {
    return getLeaderboardValue(entry, sortBy);
  };

  const getDisplayIcon = () => {
    switch (sortBy) {
      case "challenges":
        return <Swords className="w-4 h-4 text-primary" />;
      case "quizzes":
        return <BookOpen className="w-4 h-4 text-primary" />;
      case "popcorns":
        return <PopcornIcon className="w-4 h-4 text-primary" />;
      case "score":
      default:
        return <Trophy className="w-4 h-4 text-primary" />;
    }
  };

  const handleChallenge = (entry: LeaderboardEntry) => {
    if (challengedUsers.has(entry.user_id)) {
      toast({ title: "Кулдаун ⏳", description: "Подожди 1 час перед новым вызовом этому игроку" });
      return;
    }

    haptic.notification('success');
    setChallengedUsers(prev => new Set(prev).add(entry.user_id));
    toast({ title: `Вызов отправлен! ⚔️`, description: `${entry.username || entry.first_name} получил ваш вызов` });

    // Reset cooldown after demo time
    setTimeout(() => {
      setChallengedUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(entry.user_id);
        return newSet;
      });
    }, 10000);
  };

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

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
      case "score":
      default:
        return "Лучшие по очкам";
    }
  };

  const getDisplayName = (entry: LeaderboardEntry) => {
    return entry.username || entry.first_name || 'Player';
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
      <div className="px-4 py-3 overflow-x-auto scrollbar-hide">
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

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && leaderboard.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Trophy className="w-16 h-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Пока пусто</h3>
          <p className="text-muted-foreground text-center text-sm">
            Будь первым в рейтинге! Проходи тесты и бросай вызовы друзьям.
          </p>
        </div>
      )}

      {/* Top 3 Podium */}
      {!isLoading && top3.length >= 3 && (
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
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-2">
                  {top3[1]?.avatar_url ? (
                    <img src={top3[1].avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-2xl">🧠</span>
                  )}
                </div>
                <Medal className="w-5 h-5 text-gray-400 mb-1" />
                <p className="text-sm font-medium text-foreground truncate max-w-[80px]">
                  {getDisplayName(top3[1])}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(getDisplayValue(top3[1]).value)}
                </p>
              </motion.div>

              {/* 1st Place */}
              <motion.div
                className="flex flex-col items-center -mt-4"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                <Crown className="w-6 h-6 text-yellow-500 mb-1" />
                <div className="w-20 h-20 rounded-full bg-primary/20 border-4 border-yellow-500 flex items-center justify-center mb-2">
                  {top3[0]?.avatar_url ? (
                    <img src={top3[0].avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-3xl">🏆</span>
                  )}
                </div>
                <p className="text-base font-bold text-foreground truncate max-w-[100px]">
                  {getDisplayName(top3[0])}
                </p>
                <p className="text-sm text-primary font-semibold">
                  {formatNumber(getDisplayValue(top3[0]).value)} {getDisplayValue(top3[0]).suffix}
                </p>
              </motion.div>

              {/* 3rd Place */}
              <motion.div
                className="flex flex-col items-center"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-2">
                  {top3[2]?.avatar_url ? (
                    <img src={top3[2].avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-2xl">🎯</span>
                  )}
                </div>
                <Medal className="w-5 h-5 text-amber-600 mb-1" />
                <p className="text-sm font-medium text-foreground truncate max-w-[80px]">
                  {getDisplayName(top3[2])}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(getDisplayValue(top3[2]).value)}
                </p>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Rest of Leaderboard */}
      {!isLoading && rest.length > 0 && (
        <div className="px-4 space-y-2 flex-1">
          {rest.map((entry, index) => {
            const displayValue = getDisplayValue(entry);
            return (
              <motion.div
                key={entry.user_id}
                className="tg-section p-3 flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                {/* Rank */}
                <div className="w-8 flex justify-center">
                  {getRankIcon(entry.rank)}
                </div>

                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  {entry.avatar_url ? (
                    <img src={entry.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-lg">🧠</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-medium text-foreground truncate">
                      {getDisplayName(entry)}
                    </p>
                    {entry.has_premium && (
                      <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {sortBy === 'quizzes' && `${entry.count} тестов`}
                    {sortBy === 'challenges' && `${entry.wins} побед`}
                    {sortBy === 'popcorns' && `${entry.quiz_count} квизов`}
                    {sortBy === 'score' && `${entry.tests_count} тестов`}
                  </p>
                </div>

                {/* Score */}
                <div className="text-right">
                  <p className="font-bold text-primary">
                    {formatNumber(displayValue.value)} <span className="text-xs font-normal text-muted-foreground">{displayValue.suffix}</span>
                  </p>
                </div>

                {/* Challenge Button */}
                {sortBy !== 'popcorns' && (
                  <button
                    onClick={() => handleChallenge(entry)}
                    disabled={challengedUsers.has(entry.user_id)}
                    className={`p-2 rounded-lg transition-colors ${
                      challengedUsers.has(entry.user_id)
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    }`}
                  >
                    <Swords className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};
