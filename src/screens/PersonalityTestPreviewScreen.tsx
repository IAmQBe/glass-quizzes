import { motion } from "framer-motion";
import { ArrowLeft, Users, ExternalLink, Sparkles, HelpCircle, Award } from "lucide-react";
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

interface PersonalityTestPreviewScreenProps {
  test: {
    id: string;
    title: string;
    description?: string | null;
    image_url?: string | null;
    question_count: number;
    result_count: number;
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

export const PersonalityTestPreviewScreen = ({
  test,
  isLiked = false,
  isSaved = false,
  onBack,
  onStart,
  onToggleLike,
  onToggleSave,
}: PersonalityTestPreviewScreenProps) => {
  const handleSquadClick = () => {
    if (!test.creator?.squad) return;
    haptic.impact('light');
    const tg = getTelegram();
    const url = test.creator.squad.username
      ? `https://t.me/${test.creator.squad.username}`
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
          <h1 className="text-lg font-semibold flex-1 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Тест личности
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-5 space-y-5 pb-32">
        {/* Image with overlays */}
        <motion.div
          className="relative rounded-2xl overflow-hidden aspect-video bg-purple-500/10"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          {test.image_url ? (
            <img
              src={test.image_url}
              alt={test.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-pink-500/20">
              <Sparkles className="w-16 h-16 text-purple-500/30" />
            </div>
          )}

          {/* Top badges */}
          <div className="absolute top-3 left-3 flex gap-2">
            <div className="bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-white" />
              <span className="text-xs text-white font-medium">{test.participant_count}</span>
            </div>
            <div className="bg-purple-500/90 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-white" />
              <span className="text-xs text-white font-medium">{test.result_count}</span>
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
              isSaved ? "bg-purple-500 text-white" : "bg-black/40 text-white"
            }`}
          >
            <BookmarkIcon className="w-5 h-5" filled={isSaved} />
          </button>

          {/* Bottom left - Stats */}
          <div className="absolute bottom-3 left-3 flex gap-2">
            {test.like_count > 0 && (
              <div className="bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5">
                <PopcornIcon className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs text-white font-medium">{test.like_count}</span>
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
          <h2 className="text-2xl font-bold text-foreground mb-2">{test.title}</h2>
          {test.description && (
            <p className="text-muted-foreground">{test.description}</p>
          )}
        </motion.div>

        {/* Creator Info */}
        {test.creator && (
          <motion.div
            className="flex items-center gap-3"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center overflow-hidden">
              {test.creator.avatar_url ? (
                <img src={test.creator.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Sparkles className="w-5 h-5 text-purple-500" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">
                {test.creator.first_name || test.creator.username || 'Аноним'}
              </p>
              {test.creator.squad && (
                <button
                  onClick={handleSquadClick}
                  className="text-xs text-purple-500 flex items-center gap-1 hover:underline"
                >
                  <PopcornIcon className="w-3 h-3" />
                  {test.creator.squad.title}
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
            <span>{test.question_count} вопросов</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Award className="w-4 h-4 text-purple-500" />
            <span>{test.result_count} результатов</span>
          </div>
        </motion.div>

        {/* What you'll get */}
        <motion.div
          className="tg-section p-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="font-medium text-foreground mb-2">Что тебя ждёт:</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="text-purple-500">✦</span>
              {test.question_count} вопросов о тебе
            </li>
            <li className="flex items-center gap-2">
              <span className="text-purple-500">✦</span>
              {test.result_count} возможных результатов
            </li>
            <li className="flex items-center gap-2">
              <span className="text-purple-500">✦</span>
              Можно поделиться результатом
            </li>
          </ul>
        </motion.div>
      </div>

      {/* Fixed Start Button */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-background via-background to-transparent pb-safe">
        <motion.button
          onClick={() => {
            haptic.impact('medium');
            onStart();
          }}
          className="w-full flex items-center justify-center gap-2 text-lg py-4 rounded-2xl font-semibold bg-purple-500 text-white"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          whileTap={{ scale: 0.98 }}
        >
          <Sparkles className="w-5 h-5" />
          Узнать кто я
        </motion.button>
      </div>
    </motion.div>
  );
};
