import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Users, ExternalLink, Clock, AlertCircle } from "lucide-react";
import { PopcornIcon } from "@/components/icons/PopcornIcon";
import { useSquads, useMySquad, useJoinSquad, useCanChangeSquad, Squad } from "@/hooks/useSquads";
import { haptic, openTelegramTarget, resolveSquadTelegramUrl } from "@/lib/telegram";
import { toast } from "@/hooks/use-toast";
import { SquadAvatar } from "@/components/SquadAvatar";

interface SquadScreenProps {
  squad: Squad;
  onBack: () => void;
  onQuizSelect?: (quizId: string) => void;
  onTestSelect?: (testId: string) => void;
}

export const SquadScreen = ({ squad, onBack, onQuizSelect, onTestSelect }: SquadScreenProps) => {
  const { data: mySquad } = useMySquad();
  const { data: canChangeData } = useCanChangeSquad();
  const joinSquad = useJoinSquad();
  const [isJoining, setIsJoining] = useState(false);

  const isMySquad = mySquad?.id === squad.id;
  const canChange = canChangeData?.canChange ?? true;

  const handleOpenChannel = () => {
    haptic.impact('light');
    const url = resolveSquadTelegramUrl({
      username: squad.username,
      inviteLink: squad.invite_link,
    });

    if (!url) {
      toast({
        title: "Ссылка недоступна",
        description: "У этой команды нет валидной ссылки канала или чата.",
      });
      return;
    }

    if (!openTelegramTarget(url)) {
      toast({
        title: "Не удалось открыть ссылку",
        description: "Попробуй еще раз чуть позже.",
      });
    }
  };

  const handleJoin = async () => {
    if (isMySquad) {
      toast({ title: "Ты уже в этой команде! 🍿" });
      return;
    }

    if (!canChange) {
      const nextDate = canChangeData?.nextChangeAt;
      const daysLeft = nextDate
        ? Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 7;
      toast({
        title: "Подожди немного",
        description: `Менять команду можно раз в неделю. Осталось ${daysLeft} дней.`
      });
      return;
    }

    setIsJoining(true);
    haptic.impact('medium');

    try {
      await joinSquad.mutateAsync(squad.id);
      toast({
        title: "Добро пожаловать! 🍿",
        description: `Ты теперь в команде "${squad.title}"`
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось вступить в команду"
      });
    } finally {
      setIsJoining(false);
    }
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col bg-background pb-24"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => {
              haptic.impact('light');
              onBack();
            }}
            className="p-2 -ml-2 rounded-full hover:bg-secondary"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold flex-1">Команда</h1>
        </div>
      </div>

      {/* Squad Info */}
      <div className="p-5 space-y-6">
        {/* Avatar & Title */}
        <motion.div
          className="flex flex-col items-center text-center"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {/* Avatar */}
          <button
            onClick={handleOpenChannel}
            className="w-24 h-24 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center mb-4 shadow-lg"
          >
            <SquadAvatar
              avatarUrl={squad.avatar_url}
              username={squad.username}
              alt={squad.title}
              className="w-full h-full rounded-2xl object-cover"
              fallback={<PopcornIcon className="w-12 h-12 text-white" />}
            />
          </button>

          {/* Title */}
          <h2 className="text-2xl font-bold text-foreground mb-1">{squad.title}</h2>

          {/* Username */}
          {squad.username && (
            <button
              onClick={handleOpenChannel}
              className="text-primary hover:underline flex items-center gap-1 text-sm"
            >
              @{squad.username}
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </motion.div>

        {/* Stats */}
        <motion.div
          className="grid grid-cols-2 gap-3"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <div className="tg-section p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Users className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold">{formatCount(squad.member_count)}</span>
            </div>
            <p className="text-xs text-muted-foreground">участников</p>
          </div>

          <div className="tg-section p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <PopcornIcon className="w-5 h-5 text-orange-500" />
              <span className="text-2xl font-bold">{formatCount(squad.total_popcorns)}</span>
            </div>
            <p className="text-xs text-muted-foreground">попкорнов</p>
          </div>
        </motion.div>

        {/* Join Button */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {isMySquad ? (
            <div className="tg-section p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-green-500 mb-2">
                <PopcornIcon className="w-5 h-5" />
                <span className="font-medium">Ты в этой команде!</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Все твои лайки идут в копилку команды
              </p>
            </div>
          ) : (
            <button
              onClick={handleJoin}
              disabled={isJoining || !canChange}
              className={`tg-button w-full flex items-center justify-center gap-2 ${!canChange ? 'opacity-50' : ''
                }`}
            >
              {isJoining ? (
                <>Вступаем...</>
              ) : !canChange ? (
                <>
                  <Clock className="w-4 h-4" />
                  Смена команды через {Math.ceil((canChangeData?.nextChangeAt?.getTime()! - Date.now()) / (1000 * 60 * 60 * 24))} дней
                </>
              ) : (
                <>
                  <PopcornIcon className="w-4 h-4" />
                  Вступить в команду
                </>
              )}
            </button>
          )}
        </motion.div>

        {/* Info about weekly limit */}
        {!isMySquad && canChange && mySquad && (
          <motion.div
            className="flex items-start gap-2 p-3 rounded-xl bg-orange-500/10 text-orange-600"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p className="text-xs">
              Ты сейчас в команде "{mySquad.title}". При вступлении в новую команду ты покинешь текущую. Менять команду можно раз в неделю.
            </p>
          </motion.div>
        )}

        {/* Channel Link */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <button
            onClick={handleOpenChannel}
            className="tg-button-secondary w-full flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Открыть {squad.type === 'channel' ? 'канал' : 'чат'} в Telegram
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
};
