import { motion } from "framer-motion";
import { Users, HelpCircle, Clock } from "lucide-react";
import { haptic } from "@/lib/telegram";

interface QuizCardProps {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  participant_count: number;
  question_count: number;
  duration_seconds: number;
  onClick: () => void;
}

export const QuizCard = ({
  title,
  description,
  image_url,
  participant_count,
  question_count,
  duration_seconds,
  onClick,
}: QuizCardProps) => {
  const handleClick = () => {
    haptic.impact('light');
    onClick();
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m`;
  };

  const formatParticipants = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <motion.button
      className="tg-section w-full text-left overflow-hidden"
      onClick={handleClick}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {/* Image */}
      <div className="relative aspect-[16/9] bg-secondary">
        {image_url ? (
          <img
            src={image_url}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <HelpCircle className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}
        
        {/* Participants Badge */}
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
          <Users className="w-3 h-3 text-white" />
          <span className="text-xs text-white font-medium">
            {formatParticipants(participant_count)}
          </span>
        </div>
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

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{question_count} questions</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatDuration(duration_seconds)}</span>
          </div>
        </div>
      </div>
    </motion.button>
  );
};