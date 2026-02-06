import { motion } from "framer-motion";
import { Users, HelpCircle, Sparkles, Check, Award, Share2, VenetianMask } from "lucide-react";
import { haptic, openTelegramTarget, resolveSquadTelegramUrl, sharePersonalityTestInvite } from "@/lib/telegram";
import { formatQuestionCount } from "@/lib/utils";
import { PopcornIcon } from "./icons/PopcornIcon";
import { BookmarkIcon } from "./icons/BookmarkIcon";
import { GifImage } from "./GifImage";

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

interface PersonalityTestCardProps {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  participant_count: number;
  question_count: number;
  result_count: number;
  like_count?: number;
  save_count?: number;
  is_anonymous?: boolean;
  isLiked?: boolean;
  isSaved?: boolean;
  isCompleted?: boolean;
  creator?: CreatorInfo | null;
  onClick: () => void;
  onToggleLike?: () => void;
  onToggleSave?: () => void;
}

export const PersonalityTestCard = ({
  id,
  title,
  description,
  image_url,
  participant_count,
  question_count,
  result_count,
  like_count = 0,
  save_count = 0,
  is_anonymous = false,
  isLiked = false,
  isSaved = false,
  isCompleted = false,
  creator,
  onClick,
  onToggleLike,
  onToggleSave,
}: PersonalityTestCardProps) => {
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
    if (is_anonymous || !creator?.squad?.username) return;

    haptic.impact('light');
    const url = resolveSquadTelegramUrl({ username: creator.squad.username });
    openTelegramTarget(url);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.impact('light');
    sharePersonalityTestInvite(id, title, description);
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
      <div className="relative aspect-[16/9] bg-purple-500/10 rounded-t-2xl overflow-hidden">
        {image_url ? (
          <GifImage
            src={image_url}
            alt={title}
            className={`w-full h-full object-cover ${isCompleted ? 'opacity-80' : ''}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <Sparkles className="w-12 h-12 text-purple-500/30" />
          </div>
        )}

        {/* Top left - Badge */}
        <div className="absolute top-2 left-2 bg-purple-500/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-white" />
          <span className="text-xs text-white font-medium">Тест личности</span>
        </div>

        {/* Top right - Share */}
        <button
          onClick={handleShare}
          className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full w-7 h-7 flex items-center justify-center text-white"
          aria-label="Поделиться тестом"
        >
          <Share2 className="w-3.5 h-3.5" />
        </button>

        {/* Top right - Completed badge */}
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
        {(creator || is_anonymous) && (
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center overflow-hidden">
              {is_anonymous ? (
                <VenetianMask className="w-3.5 h-3.5 text-muted-foreground" />
              ) : creator?.avatar_url ? (
                <img src={creator.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px]">✨</span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {is_anonymous ? 'UNNAMED' : (creator?.first_name || creator?.username || 'Аноним')}
            </span>
            {!is_anonymous && creator?.squad && (
              <button
                onClick={handleSquadClick}
                className="text-xs text-purple-500 hover:underline flex items-center gap-1"
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
              <span>{formatQuestionCount(question_count)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Award className="w-3.5 h-3.5" />
              <span>{result_count}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              <span>{formatCount(participant_count)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {onToggleLike && (
              <button
                onClick={handleLike}
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors ${isLiked
                  ? "bg-yellow-500/20 text-yellow-600"
                  : "bg-secondary text-muted-foreground"
                  }`}
              >
                <PopcornIcon className="w-3.5 h-3.5" active={isLiked} />
                <span>{formatCount(like_count)}</span>
              </button>
            )}
            {onToggleSave && (
              <button
                onClick={handleSave}
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors ${isSaved
                  ? "bg-purple-500/20 text-purple-500"
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
