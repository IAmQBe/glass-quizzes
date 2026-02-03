import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Crown, Medal, ArrowLeft, Users, Loader2, Clock } from "lucide-react";
import { haptic, getTelegram } from "@/lib/telegram";
import { PopcornIcon } from "@/components/icons/PopcornIcon";
import { toast } from "@/hooks/use-toast";
import { useLeaderboard, LeaderboardEntry, formatNumber } from "@/hooks/useLeaderboard";
import { useSquadLeaderboard, Squad } from "@/hooks/useSquads";

interface LeaderboardScreenProps {
  onBack: () => void;
  onSquadSelect?: (squad: Squad) => void;
}

type LeaderboardTab = "squads" | "creators" | "score" | "challenges";

const tabs: { id: LeaderboardTab; label: string; icon: React.ReactNode; active: boolean }[] = [
  { id: "squads", label: "Команды", icon: <Users className="w-4 h-4" />, active: true },
  { id: "creators", label: "Создатели", icon: <PopcornIcon className="w-4 h-4" />, active: true },
  { id: "score", label: "Кубки", icon: <Trophy className="w-4 h-4" />, active: false },
  { id: "challenges", label: "Челленджи", icon: <Trophy className="w-4 h-4" />, active: false },
];

export const LeaderboardScreen = ({ onBack, onSquadSelect }: LeaderboardScreenProps) => {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("squads");

  const { data: squadLeaderboard = [], isLoading: squadsLoading } = useSquadLeaderboard(20);
  const { data: creatorsLeaderboard = [], isLoading: creatorsLoading } = useLeaderboard("popcorns");

  const isLoading = activeTab === "squads" ? squadsLoading : creatorsLoading;

  const handleTabClick = (tab: LeaderboardTab, isActive: boolean) => {
    haptic.selection();
    if (!isActive) {
      toast({
        title: "Скоро 🍿",
        description: "Этот рейтинг появится в следующем обновлении"
      });
      return;
    }
    setActiveTab(tab);
  };

  const handleSquadClick = (squad: Squad) => {
    haptic.impact('light');
    onSquadSelect?.(squad);
  };

  const handleOpenChannel = (squad: Squad) => {
    haptic.impact('light');
    const tg = getTelegram();
    const url = squad.username
      ? `https://t.me/${squad.username}`
      : squad.invite_link;

    if (url) {
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(url);
      } else {
        window.open(url, '_blank');
      }
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return (
          <span className="text-sm font-bold text-muted-foreground w-5 text-center">
            {rank}
          </span>
        );
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
          <h1 className="text-lg font-semibold text-foreground">Лидерборд</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 py-3 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id, tab.active)}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.id && tab.active
                  ? "bg-primary text-primary-foreground"
                  : tab.active
                    ? "bg-secondary text-muted-foreground"
                    : "bg-secondary/50 text-muted-foreground/50"
                }`}
            >
              {tab.icon}
              {tab.label}
              {!tab.active && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-medium bg-orange-500 text-white rounded-full">
                  soon
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}

      {/* Squads Leaderboard */}
      {!isLoading && activeTab === "squads" && (
        <div className="flex-1 px-4 space-y-2">
          {squadLeaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Users className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Пока нет команд</h3>
              <p className="text-muted-foreground text-sm">
                Создай первую команду и попади в топ!
              </p>
            </div>
          ) : (
            <>
              {/* Top 3 Podium for Squads */}
              {squadLeaderboard.length >= 3 && (
                <motion.div
                  className="py-6 bg-gradient-to-b from-orange-500/5 to-transparent rounded-2xl mb-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-end justify-center gap-2">
                    {/* 2nd Place */}
                    <motion.button
                      onClick={() => handleSquadClick(squadLeaderboard[1])}
                      className="flex flex-col items-center"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.1 }}
                    >
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center mb-2">
                        {squadLeaderboard[1]?.avatar_url ? (
                          <img src={squadLeaderboard[1].avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                        ) : (
                          <PopcornIcon className="w-7 h-7 text-white" />
                        )}
                      </div>
                      <Medal className="w-4 h-4 text-gray-400 mb-1" />
                      <p className="text-xs font-medium text-foreground truncate max-w-[70px]">
                        {squadLeaderboard[1].title}
                      </p>
                      <p className="text-xs text-orange-500 font-medium">
                        {formatNumber(squadLeaderboard[1].total_popcorns)} 🍿
                      </p>
                    </motion.button>

                    {/* 1st Place */}
                    <motion.button
                      onClick={() => handleSquadClick(squadLeaderboard[0])}
                      className="flex flex-col items-center -mt-4"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                    >
                      <Crown className="w-5 h-5 text-yellow-500 mb-1" />
                      <div className="w-18 h-18 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 border-4 border-yellow-500 flex items-center justify-center mb-2 p-0.5">
                        {squadLeaderboard[0]?.avatar_url ? (
                          <img src={squadLeaderboard[0].avatar_url} alt="" className="w-full h-full rounded-lg object-cover" />
                        ) : (
                          <PopcornIcon className="w-9 h-9 text-white" />
                        )}
                      </div>
                      <p className="text-sm font-bold text-foreground truncate max-w-[90px]">
                        {squadLeaderboard[0].title}
                      </p>
                      <p className="text-sm text-orange-500 font-bold">
                        {formatNumber(squadLeaderboard[0].total_popcorns)} 🍿
                      </p>
                    </motion.button>

                    {/* 3rd Place */}
                    <motion.button
                      onClick={() => handleSquadClick(squadLeaderboard[2])}
                      className="flex flex-col items-center"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center mb-2">
                        {squadLeaderboard[2]?.avatar_url ? (
                          <img src={squadLeaderboard[2].avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                        ) : (
                          <PopcornIcon className="w-7 h-7 text-white" />
                        )}
                      </div>
                      <Medal className="w-4 h-4 text-amber-600 mb-1" />
                      <p className="text-xs font-medium text-foreground truncate max-w-[70px]">
                        {squadLeaderboard[2].title}
                      </p>
                      <p className="text-xs text-orange-500 font-medium">
                        {formatNumber(squadLeaderboard[2].total_popcorns)} 🍿
                      </p>
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* Rest of squads */}
              {squadLeaderboard.slice(3).map((squad, index) => (
                <motion.button
                  key={squad.id}
                  onClick={() => handleSquadClick(squad)}
                  className="tg-section p-3 flex items-center gap-3 w-full text-left"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  {/* Rank */}
                  <div className="w-6 flex justify-center">
                    {getRankIcon(index + 4)}
                  </div>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center flex-shrink-0">
                    {squad.avatar_url ? (
                      <img src={squad.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                    ) : (
                      <PopcornIcon className="w-5 h-5 text-white" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{squad.title}</p>
                    {squad.username && (
                      <p className="text-xs text-muted-foreground">@{squad.username}</p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="text-right">
                    <p className="font-bold text-orange-500">
                      {formatNumber(squad.total_popcorns)} <span className="text-xs">🍿</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <Users className="w-3 h-3 inline mr-1" />
                      {formatNumber(squad.member_count)}
                    </p>
                  </div>
                </motion.button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Creators Leaderboard */}
      {!isLoading && activeTab === "creators" && (
        <div className="flex-1 px-4 space-y-2">
          {creatorsLeaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <PopcornIcon className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Пока нет создателей</h3>
              <p className="text-muted-foreground text-sm">
                Создавай контент и собирай попкорны!
              </p>
            </div>
          ) : (
            <>
              {/* Top 3 Podium */}
              {creatorsLeaderboard.length >= 3 && (
                <motion.div
                  className="py-6 bg-gradient-to-b from-primary/5 to-transparent rounded-2xl mb-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-end justify-center gap-2">
                    {/* 2nd Place */}
                    <motion.div
                      className="flex flex-col items-center"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.1 }}
                    >
                      <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-2">
                        {creatorsLeaderboard[1]?.avatar_url ? (
                          <img src={creatorsLeaderboard[1].avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span className="text-2xl">🧠</span>
                        )}
                      </div>
                      <Medal className="w-4 h-4 text-gray-400 mb-1" />
                      <p className="text-xs font-medium text-foreground truncate max-w-[70px]">
                        {getDisplayName(creatorsLeaderboard[1])}
                      </p>
                      <p className="text-xs text-orange-500">
                        {formatNumber(creatorsLeaderboard[1].popcorns || 0)} 🍿
                      </p>
                    </motion.div>

                    {/* 1st Place */}
                    <motion.div
                      className="flex flex-col items-center -mt-4"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                    >
                      <Crown className="w-5 h-5 text-yellow-500 mb-1" />
                      <div className="w-18 h-18 rounded-full bg-primary/20 border-4 border-yellow-500 flex items-center justify-center mb-2">
                        {creatorsLeaderboard[0]?.avatar_url ? (
                          <img src={creatorsLeaderboard[0].avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span className="text-3xl">🏆</span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-foreground truncate max-w-[90px]">
                        {getDisplayName(creatorsLeaderboard[0])}
                      </p>
                      <p className="text-sm text-orange-500 font-bold">
                        {formatNumber(creatorsLeaderboard[0].popcorns || 0)} 🍿
                      </p>
                    </motion.div>

                    {/* 3rd Place */}
                    <motion.div
                      className="flex flex-col items-center"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-2">
                        {creatorsLeaderboard[2]?.avatar_url ? (
                          <img src={creatorsLeaderboard[2].avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span className="text-2xl">🎯</span>
                        )}
                      </div>
                      <Medal className="w-4 h-4 text-amber-600 mb-1" />
                      <p className="text-xs font-medium text-foreground truncate max-w-[70px]">
                        {getDisplayName(creatorsLeaderboard[2])}
                      </p>
                      <p className="text-xs text-orange-500">
                        {formatNumber(creatorsLeaderboard[2].popcorns || 0)} 🍿
                      </p>
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {/* Rest of creators */}
              {creatorsLeaderboard.slice(3).map((entry, index) => (
                <motion.div
                  key={entry.user_id}
                  className="tg-section p-3 flex items-center gap-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  {/* Rank */}
                  <div className="w-6 flex justify-center">
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
                    <p className="font-medium text-foreground truncate">
                      {getDisplayName(entry)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.quiz_count} квизов
                    </p>
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    <p className="font-bold text-orange-500">
                      {formatNumber(entry.popcorns || 0)} <span className="text-xs">🍿</span>
                    </p>
                  </div>
                </motion.div>
              ))}
            </>
          )}
        </div>
      )}
    </motion.div>
  );
};
