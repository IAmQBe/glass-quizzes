import { motion } from "framer-motion";
import { Users, HelpCircle, Clock, Check } from "lucide-react";
import { haptic, getTelegram } from "@/lib/telegram";
import { PopcornIcon } from "./icons/PopcornIcon";
import { BookmarkIcon } from "./icons/BookmarkIcon";

interface CreatorInfo {
  id: string;
  first_name: string | null;
  username: string | null;
  avatar_url: string | null;
  squad?: {
    id: string;
    title: string;
    username: string | null;
  } | null;
}

interface QuizCardProps {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  participant_count: number;
  question_count: number;
  duration_seconds: number;
  like_count?: number;
  save_count?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  isCompleted?: boolean;
  creator?: CreatorInfo | null;
  onClick: () => void;
  onToggleLike?: () => void;
  onToggleSave?: () => void;
}

export const QuizCard = ({
  title,
  description,
  image_url,
  participant_count,
  question_count,
  duration_seconds,
  like_count = 0,
  save_count = 0,
  isLiked = false,
  isSaved = false,
  isCompleted = false,
  creator,
  onClick,
  onToggleLike,
  onToggleSave,
}: QuizCardProps) => {
  const handleClick = () => {
    haptic.impact('light');
    onClick();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.impact('light');
    onToggleLike?.();
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.impact('light');
    onToggleSave?.();
  };

  const handleSquadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!creator?.squad?.username) return;

    haptic.impact('light');
    const tg = getTelegram();
    const url = `https://t.me/${creator.squad.username}`;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m`;
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <motion.div
      className={`tg-section w-full text-left overflow-hidden rounded-2xl ${isCompleted ? 'ring-2 ring-green-500/50' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {/* Image */}
      <div className="relative aspect-[16/9] bg-secondary rounded-t-2xl overflow-hidden">
        {image_url ? (
          <img
            src={image_url}
            alt={title}
            className={`w-full h-full object-cover ${isCompleted ? 'opacity-80' : ''}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
            <HelpCircle className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}

        {/* Top left - Participants */}
        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
          <Users className="w-3 h-3 text-white" />
          <span className="text-xs text-white font-medium">
            {formatCount(participant_count)}
          </span>
        </div>

        {/* Completed badge */}
        {isCompleted && (
          <div className="absolute top-2 right-12 bg-green-500/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
            <Check className="w-3 h-3 text-white" />
            <span className="text-xs text-white font-medium">Пройден</span>
          </div>
        )}

        {/* Image overlay left intentionally minimal */}
      </div>

      {/* Content */}
      <div className="p-3">
        <h3 className="font-semibold text-foreground text-base mb-1 line-clamp-1">
          {title}
        </h3>

        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {description}
          </p>
        )}

        {/* Creator info */}
        {creator && (
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              {creator.avatar_url ? (
                <img src={creator.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px]">🧠</span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {creator.first_name || creator.username || 'Аноним'}
            </span>
            {creator.squad && (
              <button
                onClick={handleSquadClick}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <PopcornIcon className="w-3 h-3" />
                {creator.squad.title}
              </button>
            )}
          </div>
        )}

        {/* Stats + Actions */}
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{question_count} вопросов</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatDuration(duration_seconds)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {onToggleLike && (
              <button
                onClick={handleLike}
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors ${isLiked
                  ? "bg-amber-500/20 text-amber-600"
                  : "bg-secondary text-muted-foreground"
                  }`}
              >
                <PopcornIcon className="w-3.5 h-3.5" />
                <span>{formatCount(like_count)}</span>
              </button>
            )}
            {onToggleSave && (
              <button
                onClick={handleSave}
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors ${isSaved
                  ? "bg-primary/20 text-primary"
                  : "bg-secondary text-muted-foreground"
                  }`}
              >
                <BookmarkIcon className="w-3.5 h-3.5" filled={isSaved} />
                <span>{formatCount(save_count)}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
