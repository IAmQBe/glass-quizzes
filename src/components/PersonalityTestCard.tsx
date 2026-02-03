import { motion } from "framer-motion";
import { Users, Clock, HelpCircle, Sparkles } from "lucide-react";
import { PopcornIcon } from "./icons/PopcornIcon";
import { BookmarkIcon } from "./icons/BookmarkIcon";
import { haptic, getTelegram } from "@/lib/telegram";

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
  isLiked?: boolean;
  isSaved?: boolean;
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
  isLiked = false,
  isSaved = false,
  creator,
  onClick,
  onToggleLike,
  onToggleSave,
}: PersonalityTestCardProps) => {
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

  return (
    <motion.div
      className="tg-card overflow-hidden cursor-pointer active:scale-[0.98] transition-transform rounded-2xl"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
    >
      {/* Image with gradient overlay */}
      {image_url && (
        <div className="relative h-32 overflow-hidden rounded-t-xl -mx-4 -mt-4 mb-3">
          <img
            src={image_url}
            alt={title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

          {/* Badge */}
          <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-purple-500/90 text-white text-xs font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Тест личности
          </div>

          {/* Results count badge */}
          <div className="absolute bottom-2 left-2 px-2 py-1 rounded-full bg-black/50 text-white text-xs">
            {result_count} результатов
          </div>
        </div>
      )}

      {/* No image - show badge inline */}
      {!image_url && (
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-500 text-xs font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Тест личности
          </span>
          <span className="text-xs text-muted-foreground">
            {result_count} результатов
          </span>
        </div>
      )}

      {/* Title */}
      <h3 className="font-semibold text-foreground text-lg mb-1 line-clamp-2">{title}</h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{description}</p>
      )}

      {/* Creator info */}
      {creator && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-muted-foreground">
            от {creator.first_name || creator.username || 'Аноним'}
          </span>
          {creator.squad && (
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

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{question_count} вопросов</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span>{participant_count}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {onToggleLike && (
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 p-1.5 rounded-lg transition-colors ${isLiked ? 'text-orange-500 bg-orange-500/10' : 'text-muted-foreground hover:text-orange-500'
                }`}
            >
              <PopcornIcon className="w-4 h-4" filled={isLiked} />
              {like_count > 0 && <span className="text-xs">{like_count}</span>}
            </button>
          )}

          {onToggleSave && (
            <button
              onClick={handleSave}
              className={`flex items-center gap-1 p-1.5 rounded-lg transition-colors ${isSaved ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary'
                }`}
            >
              <BookmarkIcon className="w-4 h-4" filled={isSaved} />
              {save_count > 0 && <span className="text-xs">{save_count}</span>}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
