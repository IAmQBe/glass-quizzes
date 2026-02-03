import { motion } from "framer-motion";
import { ArrowLeft, Users, Play, ExternalLink, Sparkles } from "lucide-react";
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
        {/* Image */}
        {test.image_url && (
          <motion.div
            className="relative rounded-2xl overflow-hidden aspect-video bg-purple-500/10"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <img
              src={test.image_url}
              alt={test.title}
              className="w-full h-full object-cover"
            />
          </motion.div>
        )}

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
                <span className="text-lg">🎭</span>
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

        {/* Stats */}
        <motion.div
          className="grid grid-cols-4 gap-2"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <div className="tg-section p-3 text-center">
            <p className="text-lg font-bold text-foreground">{test.question_count}</p>
            <p className="text-xs text-muted-foreground">вопросов</p>
          </div>
          <div className="tg-section p-3 text-center">
            <p className="text-lg font-bold text-purple-500">{test.result_count}</p>
            <p className="text-xs text-muted-foreground">результ.</p>
          </div>
          <div className="tg-section p-3 text-center">
            <p className="text-lg font-bold text-foreground">{test.participant_count.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">участий</p>
          </div>
          <div className="tg-section p-3 text-center">
            <p className="text-lg font-bold text-orange-500">{test.like_count}</p>
            <p className="text-xs text-muted-foreground">🍿</p>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          className="flex gap-3"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <button
            onClick={() => {
              haptic.impact('light');
              onToggleLike?.();
            }}
            className={`flex-1 tg-button-secondary flex items-center justify-center gap-2 ${isLiked ? 'text-orange-500' : ''
              }`}
          >
            <PopcornIcon className={`w-5 h-5 ${isLiked ? 'fill-orange-500' : ''}`} />
            {test.like_count}
          </button>
          <button
            onClick={() => {
              haptic.impact('light');
              onToggleSave?.();
            }}
            className={`flex-1 tg-button-secondary flex items-center justify-center gap-2 ${isSaved ? 'text-purple-500' : ''
              }`}
          >
            <BookmarkIcon className={`w-5 h-5 ${isSaved ? 'fill-purple-500' : ''}`} />
            {test.save_count}
          </button>
        </motion.div>

        {/* What you'll get */}
        <motion.div
          className="tg-section p-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
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
          transition={{ delay: 0.3 }}
          whileTap={{ scale: 0.98 }}
        >
          <Sparkles className="w-5 h-5" />
          Узнать кто я
        </motion.button>
      </div>
    </motion.div>
  );
};
