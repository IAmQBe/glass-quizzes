import { motion } from "framer-motion";
import { Trophy, Star, Crown, Medal } from "lucide-react";

interface LeaderEntry {
  rank: number;
  username: string;
  score: number;
  hasPremium: boolean;
}

interface LeaderboardPreviewProps {
  entries: LeaderEntry[];
  onViewAll: () => void;
}

export const LeaderboardPreview = ({ entries, onViewAll }: LeaderboardPreviewProps) => {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{rank}</span>;
    }
  };

  return (
    <div className="tg-section">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Top Players</h3>
        </div>
        <button
          className="text-sm text-primary font-medium"
          onClick={onViewAll}
        >
          View all
        </button>
      </div>

      <div className="divide-y divide-border">
        {entries.slice(0, 5).map((entry, index) => (
          <motion.div
            key={entry.rank}
            className="flex items-center gap-3 px-4 py-3"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: index * 0.05 }}
          >
            {getRankIcon(entry.rank)}
            
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-lg">🧠</span>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-1">
                <span className="font-medium text-foreground">{entry.username}</span>
                {entry.hasPremium && (
                  <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="font-bold text-foreground">{entry.score}</span>
              <span className="text-xs text-muted-foreground ml-1">pts</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};