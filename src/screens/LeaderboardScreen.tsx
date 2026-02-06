import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Crown, Medal, ArrowLeft, Users, Loader2 } from "lucide-react";
import { haptic } from "@/lib/telegram";
import { PopcornIcon } from "@/components/icons/PopcornIcon";
import { toast } from "@/hooks/use-toast";
import { useLeaderboard, LeaderboardEntry, formatNumber } from "@/hooks/useLeaderboard";
import { useSquadLeaderboard, useMySquad, Squad, SquadLeaderboardEntry } from "@/hooks/useSquads";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { SquadAvatar } from "@/components/SquadAvatar";

interface LeaderboardScreenProps {
  onBack: () => void;
  onSquadSelect?: (squad: Squad) => void;
}

type LeaderboardTab = "squads" | "creators" | "score" | "challenges";
type UserLeaderboardTab = Exclude<LeaderboardTab, "squads">;

const MAX_LEADERBOARD_ITEMS = 300;
const EXTENDED_LOOKUP_LIMIT = 5000;
const STICKY_BOTTOM_CLASS = "sticky bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] z-20 pt-2";

const tabs: { id: LeaderboardTab; label: string; icon: React.ReactNode; active: boolean }[] = [
  { id: "squads", label: "Команды", icon: <Users className="w-4 h-4" />, active: true },
  { id: "creators", label: "Создатели", icon: <PopcornIcon className="w-4 h-4" />, active: true },
  { id: "score", label: "Кубки", icon: <Trophy className="w-4 h-4" />, active: false },
  { id: "challenges", label: "Челленджи", icon: <Medal className="w-4 h-4" />, active: false },
];

export const LeaderboardScreen = ({ onBack, onSquadSelect }: LeaderboardScreenProps) => {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("squads");

  const { data: currentProfile } = useCurrentProfile();
  const { data: mySquad } = useMySquad();

  const { data: squadLeaderboard = [], isLoading: squadsLoading } = useSquadLeaderboard(
    MAX_LEADERBOARD_ITEMS,
    activeTab === "squads"
  );
  const mySquadInTop = mySquad?.id ? squadLeaderboard.find((entry) => entry.id === mySquad.id) : undefined;
  const shouldLoadMySquadOutsideTop =
    activeTab === "squads" && Boolean(mySquad?.id) && !mySquadInTop;
  const { data: extendedSquadLeaderboard = [] } = useSquadLeaderboard(
    EXTENDED_LOOKUP_LIMIT,
    shouldLoadMySquadOutsideTop
  );
  const mySquadOutsideTop = shouldLoadMySquadOutsideTop && mySquad?.id
    ? extendedSquadLeaderboard.find((entry) => entry.id === mySquad.id)
    : undefined;

  const { data: creatorsLeaderboard = [], isLoading: creatorsLoading } = useLeaderboard(
    "popcorns",
    MAX_LEADERBOARD_ITEMS,
    activeTab === "creators"
  );
  const myCreatorInTop = currentProfile?.id
    ? creatorsLeaderboard.find((entry) => entry.user_id === currentProfile.id)
    : undefined;
  const shouldLoadMyCreatorOutsideTop =
    activeTab === "creators" && Boolean(currentProfile?.id) && !myCreatorInTop;
  const { data: extendedCreatorsLeaderboard = [] } = useLeaderboard(
    "popcorns",
    EXTENDED_LOOKUP_LIMIT,
    shouldLoadMyCreatorOutsideTop
  );
  const myCreatorOutsideTop = shouldLoadMyCreatorOutsideTop && currentProfile?.id
    ? extendedCreatorsLeaderboard.find((entry) => entry.user_id === currentProfile.id)
    : undefined;

  const { data: scoreLeaderboard = [], isLoading: scoreLoading } = useLeaderboard(
    "score",
    MAX_LEADERBOARD_ITEMS,
    activeTab === "score"
  );
  const myScoreInTop = currentProfile?.id
    ? scoreLeaderboard.find((entry) => entry.user_id === currentProfile.id)
    : undefined;
  const shouldLoadMyScoreOutsideTop =
    activeTab === "score" && Boolean(currentProfile?.id) && !myScoreInTop;
  const { data: extendedScoreLeaderboard = [] } = useLeaderboard(
    "score",
    EXTENDED_LOOKUP_LIMIT,
    shouldLoadMyScoreOutsideTop
  );
  const myScoreOutsideTop = shouldLoadMyScoreOutsideTop && currentProfile?.id
    ? extendedScoreLeaderboard.find((entry) => entry.user_id === currentProfile.id)
    : undefined;

  const { data: challengesLeaderboard = [], isLoading: challengesLoading } = useLeaderboard(
    "challenges",
    MAX_LEADERBOARD_ITEMS,
    activeTab === "challenges"
  );
  const myChallengesInTop = currentProfile?.id
    ? challengesLeaderboard.find((entry) => entry.user_id === currentProfile.id)
    : undefined;
  const shouldLoadMyChallengesOutsideTop =
    activeTab === "challenges" && Boolean(currentProfile?.id) && !myChallengesInTop;
  const { data: extendedChallengesLeaderboard = [] } = useLeaderboard(
    "challenges",
    EXTENDED_LOOKUP_LIMIT,
    shouldLoadMyChallengesOutsideTop
  );
  const myChallengesOutsideTop = shouldLoadMyChallengesOutsideTop && currentProfile?.id
    ? extendedChallengesLeaderboard.find((entry) => entry.user_id === currentProfile.id)
    : undefined;

  const showSquadSticky =
    activeTab === "squads" &&
    !squadsLoading &&
    Boolean(mySquadOutsideTop) &&
    Number(mySquadOutsideTop?.rank || 0) > MAX_LEADERBOARD_ITEMS;

  const showCreatorSticky =
    activeTab === "creators" &&
    !creatorsLoading &&
    Boolean(myCreatorOutsideTop) &&
    Number(myCreatorOutsideTop?.rank || 0) > MAX_LEADERBOARD_ITEMS;

  const showScoreSticky =
    activeTab === "score" &&
    !scoreLoading &&
    Boolean(myScoreOutsideTop) &&
    Number(myScoreOutsideTop?.rank || 0) > MAX_LEADERBOARD_ITEMS;

  const showChallengesSticky =
    activeTab === "challenges" &&
    !challengesLoading &&
    Boolean(myChallengesOutsideTop) &&
    Number(myChallengesOutsideTop?.rank || 0) > MAX_LEADERBOARD_ITEMS;

  const isLoading =
    activeTab === "squads"
      ? squadsLoading
      : activeTab === "creators"
        ? creatorsLoading
        : activeTab === "score"
          ? scoreLoading
          : challengesLoading;

  const handleTabClick = (tab: LeaderboardTab, isActive: boolean) => {
    haptic.selection();
    if (!isActive) {
      toast({
        title: "Скоро 🍿",
        description: "Этот рейтинг появится в следующем обновлении",
      });
      return;
    }
    setActiveTab(tab);
  };

  const handleSquadClick = (squad: Squad) => {
    haptic.impact("light");
    onSquadSelect?.(squad);
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
        return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{rank}</span>;
    }
  };

  const getDisplayName = (entry: LeaderboardEntry) => {
    if (entry.username) return entry.username;
    if (entry.first_name) return entry.first_name;
    return entry.user_id ? `Автор ${entry.user_id.slice(0, 6)}` : "Player";
  };

  const getUserMetric = (entry: LeaderboardEntry, tab: UserLeaderboardTab) => {
    if (tab === "creators") {
      return {
        kind: "popcorns" as const,
        value: Number(entry.popcorns || entry.total_popcorns || 0),
        subtitle: `${entry.quiz_count || 0} квизов`,
      };
    }

    if (tab === "score") {
      return {
        kind: "score" as const,
        value: Number(entry.total_score || 0),
        subtitle: `${entry.tests_count || 0} тестов`,
      };
    }

    return {
      kind: "wins" as const,
      value: Number(entry.wins || 0),
      subtitle: "Победы в челленджах",
    };
  };

  const renderMetric = (
    kind: "popcorns" | "score" | "wins",
    value: number,
    size: "sm" | "md" = "sm"
  ) => {
    const textClass = size === "md" ? "text-sm font-bold" : "text-xs font-medium";
    const iconClass = size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";

    if (kind === "popcorns") {
      return (
        <span className={`${textClass} text-orange-500 inline-flex items-center gap-1`}>
          <PopcornIcon className={iconClass} />
          {formatNumber(value)}
        </span>
      );
    }

    if (kind === "score") {
      return (
        <span className={`${textClass} text-primary inline-flex items-center gap-1`}>
          <Trophy className={iconClass} />
          {formatNumber(value)}
        </span>
      );
    }

    return (
      <span className={`${textClass} text-amber-600 inline-flex items-center gap-1`}>
        <Medal className={iconClass} />
        {formatNumber(value)}
      </span>
    );
  };

  const renderUserPodium = (entries: LeaderboardEntry[], tab: UserLeaderboardTab) => {
    if (entries.length < 3) return null;

    const first = entries[0];
    const second = entries[1];
    const third = entries[2];

    const firstMetric = getUserMetric(first, tab);
    const secondMetric = getUserMetric(second, tab);
    const thirdMetric = getUserMetric(third, tab);

    return (
      <motion.div
        className="py-5 bg-gradient-to-b from-primary/5 to-transparent rounded-2xl mb-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-end justify-center gap-4">
          <motion.div
            className="flex flex-col items-center min-w-[86px]"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-2 overflow-hidden">
              {second.avatar_url ? (
                <img src={second.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-xl">🧠</span>
              )}
            </div>
            <Medal className="w-4 h-4 text-gray-400 mb-1" />
            <p className="text-xs font-medium text-foreground truncate max-w-[86px] text-center">
              {getDisplayName(second)}
            </p>
            {renderMetric(secondMetric.kind, secondMetric.value)}
          </motion.div>

          <motion.div
            className="flex flex-col items-center -mt-3 min-w-[104px]"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <Crown className="w-5 h-5 text-yellow-500 mb-1" />
            <div className="w-[76px] h-[76px] rounded-full bg-primary/20 border-2 border-yellow-500 flex items-center justify-center mb-2 overflow-hidden">
              {first.avatar_url ? (
                <img src={first.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-3xl">🏆</span>
              )}
            </div>
            <p className="text-sm font-bold text-foreground truncate max-w-[104px] text-center">
              {getDisplayName(first)}
            </p>
            {renderMetric(firstMetric.kind, firstMetric.value, "md")}
          </motion.div>

          <motion.div
            className="flex flex-col items-center min-w-[86px]"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-2 overflow-hidden">
              {third.avatar_url ? (
                <img src={third.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-xl">🎯</span>
              )}
            </div>
            <Medal className="w-4 h-4 text-amber-600 mb-1" />
            <p className="text-xs font-medium text-foreground truncate max-w-[86px] text-center">
              {getDisplayName(third)}
            </p>
            {renderMetric(thirdMetric.kind, thirdMetric.value)}
          </motion.div>
        </div>
      </motion.div>
    );
  };

  const renderUserList = (entries: LeaderboardEntry[], tab: UserLeaderboardTab) => {
    const rows = entries.length >= 3 ? entries.slice(3) : entries;

    return rows.map((entry, index) => {
      const metric = getUserMetric(entry, tab);

      return (
        <motion.div
          key={entry.user_id}
          className="tg-section p-3 flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: Math.min(index, 12) * 0.02 }}
        >
          <div className="w-6 flex justify-center">{getRankIcon(entry.rank)}</div>

          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
            {entry.avatar_url ? (
              <img src={entry.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-lg">🧠</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{getDisplayName(entry)}</p>
            <p className="text-xs text-muted-foreground">{metric.subtitle}</p>
          </div>

          <div className="text-right">{renderMetric(metric.kind, metric.value, "md")}</div>
        </motion.div>
      );
    });
  };

  const renderUserSticky = (entry: LeaderboardEntry, tab: UserLeaderboardTab) => {
    const metric = getUserMetric(entry, tab);

    return (
      <div className={STICKY_BOTTOM_CLASS}>
        <div className="tg-section border border-primary/20 bg-background/95 backdrop-blur p-3 flex items-center gap-3 shadow-lg">
          <div className="w-6 flex justify-center">
            <span className="text-sm font-bold text-muted-foreground text-center">{entry.rank}</span>
          </div>

          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
            {entry.avatar_url ? (
              <img src={entry.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-lg">🧠</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Ваше место</p>
            <p className="font-medium text-foreground truncate">{getDisplayName(entry)}</p>
          </div>

          <div className="text-right">{renderMetric(metric.kind, metric.value, "md")}</div>
        </div>
      </div>
    );
  };

  const renderSquadPodium = (entries: SquadLeaderboardEntry[]) => {
    if (entries.length === 0) return null;

    const first = entries[0];
    const second = entries[1];
    const third = entries[2];

    return (
      <motion.div
        className="py-5 bg-gradient-to-b from-orange-500/5 to-transparent rounded-2xl mb-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-end justify-center gap-4">
          {second && (
            <motion.button
              onClick={() => handleSquadClick(second)}
              className="flex flex-col items-center min-w-[86px]"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-2 overflow-hidden">
                <SquadAvatar
                  avatarUrl={second.avatar_url}
                  username={second.username}
                  alt={second.title}
                  className="w-full h-full rounded-full object-cover"
                  fallback={<span className="text-xl">🧠</span>}
                />
              </div>
              <Medal className="w-4 h-4 text-gray-400 mb-1" />
              <p className="text-xs font-medium text-foreground truncate max-w-[86px] text-center">{second.title}</p>
              <p className="text-xs text-orange-500 font-medium inline-flex items-center gap-1">
                <PopcornIcon className="w-3.5 h-3.5" />
                {formatNumber(second.total_popcorns)}
              </p>
            </motion.button>
          )}

          <motion.button
            onClick={() => handleSquadClick(first)}
            className="flex flex-col items-center -mt-3 min-w-[104px]"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <Crown className="w-5 h-5 text-yellow-500 mb-1" />
            <div className="w-[76px] h-[76px] rounded-full bg-primary/20 border-2 border-yellow-500 flex items-center justify-center mb-2 p-0.5 overflow-hidden">
              <SquadAvatar
                avatarUrl={first.avatar_url}
                username={first.username}
                alt={first.title}
                className="w-full h-full rounded-full object-cover"
                fallback={<span className="text-3xl">🏆</span>}
              />
            </div>
            <p className="text-sm font-bold text-foreground truncate max-w-[104px] text-center">{first.title}</p>
            <p className="text-sm text-orange-500 font-bold inline-flex items-center gap-1">
              <PopcornIcon className="w-4 h-4" />
              {formatNumber(first.total_popcorns)}
            </p>
          </motion.button>

          {third && (
            <motion.button
              onClick={() => handleSquadClick(third)}
              className="flex flex-col items-center min-w-[86px]"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-2 overflow-hidden">
                <SquadAvatar
                  avatarUrl={third.avatar_url}
                  username={third.username}
                  alt={third.title}
                  className="w-full h-full rounded-full object-cover"
                  fallback={<span className="text-xl">🎯</span>}
                />
              </div>
              <Medal className="w-4 h-4 text-amber-600 mb-1" />
              <p className="text-xs font-medium text-foreground truncate max-w-[86px] text-center">{third.title}</p>
              <p className="text-xs text-orange-500 font-medium inline-flex items-center gap-1">
                <PopcornIcon className="w-3.5 h-3.5" />
                {formatNumber(third.total_popcorns)}
              </p>
            </motion.button>
          )}
        </div>
      </motion.div>
    );
  };

  const renderSquadSticky = (entry: SquadLeaderboardEntry) => {
    return (
      <div className={STICKY_BOTTOM_CLASS}>
        <button
          onClick={() => handleSquadClick(entry)}
          className="tg-section border border-primary/20 bg-background/95 backdrop-blur p-3 flex items-center gap-3 shadow-lg w-full text-left"
        >
          <div className="w-6 flex justify-center">
            <span className="text-sm font-bold text-muted-foreground text-center">{entry.rank}</span>
          </div>

          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
            <SquadAvatar
              avatarUrl={entry.avatar_url}
              username={entry.username}
              alt={entry.title}
              className="w-full h-full rounded-full object-cover"
              fallback={<span className="text-lg">🧠</span>}
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Место вашей команды</p>
            <p className="font-medium text-foreground truncate">{entry.title}</p>
          </div>

          <div className="text-right">
            <p className="font-bold text-orange-500 inline-flex items-center gap-1 justify-end">
              <PopcornIcon className="w-4 h-4" />
              {formatNumber(entry.total_popcorns)}
            </p>
          </div>
        </button>
      </div>
    );
  };

  return (
    <motion.div
      className="flex flex-col min-h-screen safe-bottom-nav"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
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

      <div className="px-4 py-3 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id, tab.active)}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id && tab.active
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

      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}

      {!isLoading && activeTab === "squads" && (
        <div className="flex-1 px-4 space-y-2">
          {squadLeaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Users className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Пока нет команд</h3>
              <p className="text-muted-foreground text-sm">Создай первую команду и попади в топ!</p>
            </div>
          ) : (
            <>
              {renderSquadPodium(squadLeaderboard)}

              {squadLeaderboard.slice(Math.min(3, squadLeaderboard.length)).map((squad, index) => (
                <motion.button
                  key={squad.id}
                  onClick={() => handleSquadClick(squad)}
                  className="tg-section p-3 flex items-center gap-3 w-full text-left"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index, 12) * 0.02 }}
                >
                  <div className="w-6 flex justify-center">{getRankIcon(squad.rank)}</div>

                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <SquadAvatar
                      avatarUrl={squad.avatar_url}
                      username={squad.username}
                      alt={squad.title}
                      className="w-full h-full rounded-full object-cover"
                      fallback={<span className="text-lg">🧠</span>}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{squad.title}</p>
                    <p className="text-xs text-muted-foreground">{formatNumber(squad.member_count)} участников</p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-orange-500 inline-flex items-center gap-1 justify-end">
                      <PopcornIcon className="w-4 h-4" />
                      {formatNumber(squad.total_popcorns)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <Users className="w-3 h-3 inline mr-1" />
                      {formatNumber(squad.member_count)}
                    </p>
                  </div>
                </motion.button>
              ))}

              {showSquadSticky && mySquadOutsideTop && renderSquadSticky(mySquadOutsideTop)}
            </>
          )}
        </div>
      )}

      {!isLoading && activeTab === "creators" && (
        <div className="flex-1 px-4 space-y-2">
          {creatorsLeaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <PopcornIcon className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Пока нет создателей</h3>
              <p className="text-muted-foreground text-sm">Создавай контент и собирай попкорны!</p>
            </div>
          ) : (
            <>
              {renderUserPodium(creatorsLeaderboard, "creators")}
              {renderUserList(creatorsLeaderboard, "creators")}
              {showCreatorSticky && myCreatorOutsideTop && renderUserSticky(myCreatorOutsideTop, "creators")}
            </>
          )}
        </div>
      )}

      {!isLoading && activeTab === "score" && (
        <div className="flex-1 px-4 space-y-2">
          {scoreLeaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Trophy className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Пока нет лидеров</h3>
              <p className="text-muted-foreground text-sm">Проходи квизы и набирай кубки!</p>
            </div>
          ) : (
            <>
              {renderUserPodium(scoreLeaderboard, "score")}
              {renderUserList(scoreLeaderboard, "score")}
              {showScoreSticky && myScoreOutsideTop && renderUserSticky(myScoreOutsideTop, "score")}
            </>
          )}
        </div>
      )}

      {!isLoading && activeTab === "challenges" && (
        <div className="flex-1 px-4 space-y-2">
          {challengesLeaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Medal className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Пока нет победителей</h3>
              <p className="text-muted-foreground text-sm">Участвуй в челленджах и поднимайся в топ!</p>
            </div>
          ) : (
            <>
              {renderUserPodium(challengesLeaderboard, "challenges")}
              {renderUserList(challengesLeaderboard, "challenges")}
              {showChallengesSticky && myChallengesOutsideTop && renderUserSticky(myChallengesOutsideTop, "challenges")}
            </>
          )}
        </div>
      )}
    </motion.div>
  );
};
