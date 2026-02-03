import { motion } from "framer-motion";
import { ArrowLeft, Clock, Users, Play, ExternalLink, HelpCircle } from "lucide-react";
import { PopcornIcon } from "@/components/icons/PopcornIcon";
import { BookmarkIcon } from "@/components/icons/BookmarkIcon";
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

interface QuizPreviewScreenProps {
  quiz: {
    id: string;
    title: string;
    description?: string | null;
    image_url?: string | null;
    question_count: number;
    duration_seconds: number;
    participant_count: number;
    like_count: number;
    save_count: number;
    creator?: CreatorInfo | null;
  };
  isLiked?: boolean;
  isSaved?: boolean;
  onBack: () => void;
  onStart: () => void;
  onToggleLike?: () => void;
  onToggleSave?: () => void;
}

export const QuizPreviewScreen = ({
  quiz,
  isLiked = false,
  isSaved = false,
  onBack,
  onStart,
  onToggleLike,
  onToggleSave,
}: QuizPreviewScreenProps) => {
  const handleSquadClick = () => {
    if (!quiz.creator?.squad) return;
    haptic.impact('light');
    const tg = getTelegram();
    const url = quiz.creator.squad.username
      ? `https://t.me/${quiz.creator.squad.username}`
      : null;
    if (url && tg?.openTelegramLink) {
      tg.openTelegramLink(url);
    }
  };

  const handleLike = () => {
    haptic.impact('light');
    onToggleLike?.();
  };

  const handleSave = () => {
    haptic.impact('light');
    onToggleSave?.();
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} сек`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes} мин`;
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col bg-background safe-bottom"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
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
          <h1 className="text-lg font-semibold flex-1">Квиз</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-5 space-y-5 pb-32">
        {/* Image with overlays */}
        <motion.div
          className="relative rounded-2xl overflow-hidden aspect-video bg-secondary"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          {quiz.image_url ? (
            <img
              src={quiz.image_url}
              alt={quiz.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
              <HelpCircle className="w-16 h-16 text-muted-foreground/30" />
            </div>
          )}

          {/* Top badges */}
          <div className="absolute top-3 left-3 flex gap-2">
            <div className="bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-white" />
              <span className="text-xs text-white font-medium">{quiz.participant_count}</span>
            </div>
            <div className="bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-white" />
              <span className="text-xs text-white font-medium">{formatDuration(quiz.duration_seconds)}</span>
            </div>
          </div>

          {/* Top right - Like button */}
          <button
            onClick={handleLike}
            className={`absolute top-3 right-3 w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center transition-colors ${
              isLiked ? "bg-amber-500 text-white" : "bg-black/40 text-white"
            }`}
          >
            <PopcornIcon className="w-5 h-5" />
          </button>

          {/* Bottom right - Save button */}
          <button
            onClick={handleSave}
            className={`absolute bottom-3 right-3 w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center transition-colors ${
              isSaved ? "bg-primary text-white" : "bg-black/40 text-white"
            }`}
          >
            <BookmarkIcon className="w-5 h-5" filled={isSaved} />
          </button>

          {/* Bottom left - Stats */}
          <div className="absolute bottom-3 left-3 flex gap-2">
            {quiz.like_count > 0 && (
              <div className="bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5">
                <PopcornIcon className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs text-white font-medium">{quiz.like_count}</span>
              </div>
            )}
            {quiz.save_count > 0 && (
              <div className="bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5">
                <BookmarkIcon className="w-3.5 h-3.5 text-white" />
                <span className="text-xs text-white font-medium">{quiz.save_count}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Title & Description */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
        >
          <h2 className="text-2xl font-bold text-foreground mb-2">{quiz.title}</h2>
          {quiz.description && (
            <p className="text-muted-foreground">{quiz.description}</p>
          )}
        </motion.div>

        {/* Creator Info */}
        {quiz.creator && (
          <motion.div
            className="flex items-center gap-3"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              {quiz.creator.avatar_url ? (
                <img src={quiz.creator.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <HelpCircle className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">
                {quiz.creator.first_name || quiz.creator.username || 'Аноним'}
              </p>
              {quiz.creator.squad && (
                <button
                  onClick={handleSquadClick}
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  <PopcornIcon className="w-3 h-3" />
                  {quiz.creator.squad.title}
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Stats row */}
        <motion.div
          className="flex items-center gap-4 text-sm text-muted-foreground"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4" />
            <span>{quiz.question_count} вопросов</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>{formatDuration(quiz.duration_seconds)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            <span>{quiz.participant_count}</span>
          </div>
        </motion.div>
      </div>

      {/* Fixed Start Button */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-background via-background to-transparent pb-safe">
        <motion.button
          onClick={() => {
            haptic.impact('medium');
            onStart();
          }}
          className="tg-button w-full flex items-center justify-center gap-2 text-lg py-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          whileTap={{ scale: 0.98 }}
        >
          <Play className="w-5 h-5" />
          Начать квиз
        </motion.button>
      </div>
    </motion.div>
  );
};
