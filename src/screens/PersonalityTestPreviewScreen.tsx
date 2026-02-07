import { motion } from "framer-motion";
import { ArrowLeft, Users, ExternalLink, Sparkles, HelpCircle, Award, Share2, VenetianMask } from "lucide-react";
import { PopcornIcon } from "@/components/icons/PopcornIcon";
import { BookmarkIcon } from "@/components/icons/BookmarkIcon";
import { GifImage } from "@/components/GifImage";
import { haptic, openTelegramTarget, resolveSquadTelegramUrl, sharePersonalityTestInvite } from "@/lib/telegram";
import { formatQuestionCount } from "@/lib/utils";

interface CreatorInfo {
  id: string;
  first_name: string | null;
  username: string | null;
  avatar_url: string | null;
  squad?: {
    id: string;
    title: string;
    username: string | null;
    invite_link?: string | null;
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
    is_anonymous?: boolean;
    creator?: CreatorInfo | null;
    is_published?: boolean;
    status?: string | null;
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
  const moderationState = (() => {
    if (test.is_published === true || test.status === "published") return "published";
    if (test.status === "pending" || test.status === "reviewing") return "pending";
    if (test.status === "rejected") return "rejected";
    return "draft";
  })();
  const isPublished = moderationState === "published";
  const moderationBadgeLabel = moderationState === "pending"
    ? "На проверке"
    : moderationState === "rejected"
      ? "Отклонён"
      : moderationState === "draft"
        ? "Черновик"
        : null;

  const handleSquadClick = () => {
    if (test.is_anonymous || !test.creator?.squad) return;
    haptic.impact('light');
    const url = resolveSquadTelegramUrl({
      username: test.creator.squad.username,
      inviteLink: test.creator.squad.invite_link,
    });
    openTelegramTarget(url);
  };

  const handleLike = () => {
    haptic.impact('light');
    onToggleLike?.();
  };

  const handleSave = () => {
    haptic.impact('light');
    onToggleSave?.();
  };

  const handleShare = () => {
    haptic.impact('light');
    sharePersonalityTestInvite(test.id, test.title, test.description);
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
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
          {isPublished ? (
            <button
              onClick={handleShare}
              className="p-2 -mr-2 rounded-full hover:bg-secondary"
              aria-label="Поделиться тестом"
            >
              <Share2 className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-9" />
          )}
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
            <GifImage
              src={test.image_url}
              alt={test.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-pink-500/20">
              <Sparkles className="w-16 h-16 text-purple-500/30" />
            </div>
          )}

          {/* Image overlay intentionally minimal */}
        </motion.div>

        {/* Title & Description */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-2xl font-bold text-foreground">{test.title}</h2>
            {moderationBadgeLabel && (
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  moderationState === "pending"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                    : moderationState === "rejected"
                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      : "bg-secondary text-muted-foreground"
                }`}
              >
                {moderationBadgeLabel}
              </span>
            )}
          </div>
          {test.description && (
            <p className="text-muted-foreground">{test.description}</p>
          )}
          {!isPublished && moderationState === "pending" && (
            <p className="text-sm text-muted-foreground mt-2">
              Тест проходит модерацию. После проверки он станет доступен всем.
            </p>
          )}
        </motion.div>

        {/* Creator Info */}
        {(test.creator || test.is_anonymous) && (
          <motion.div
            className="flex items-center gap-3"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center overflow-hidden">
              {test.is_anonymous ? (
                <VenetianMask className="w-5 h-5 text-muted-foreground" />
              ) : test.creator?.avatar_url ? (
                <img src={test.creator.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Sparkles className="w-5 h-5 text-purple-500" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">
                {test.is_anonymous ? 'UNNAMED' : (test.creator?.first_name || test.creator?.username || 'Аноним')}
              </p>
              {!test.is_anonymous && test.creator?.squad && (
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

        {/* Stats + Actions */}
        <motion.div
          className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm text-muted-foreground"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 min-w-0">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <HelpCircle className="w-4 h-4" />
              <span>{formatQuestionCount(test.question_count)}</span>
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <Award className="w-4 h-4 text-purple-500" />
              <span>{test.result_count} результатов</span>
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <Users className="w-4 h-4" />
              <span>{formatCount(test.participant_count)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-self-end">
            {isPublished && onToggleLike && (
              <button
                onClick={handleLike}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors shadow-sm ${
                  isLiked
                    ? "bg-yellow-500/20 text-yellow-600"
                    : "bg-card text-muted-foreground border border-border/70 hover:bg-secondary"
                }`}
              >
                <PopcornIcon className="w-4 h-4" active={isLiked} />
                <span>{formatCount(test.like_count)}</span>
              </button>
            )}
            {isPublished && onToggleSave && (
              <button
                onClick={handleSave}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors shadow-sm ${
                  isSaved
                    ? "bg-purple-500/20 text-purple-500"
                    : "bg-card text-muted-foreground border border-border/70 hover:bg-secondary"
                }`}
              >
                <BookmarkIcon className="w-4 h-4" filled={isSaved} />
                <span>{formatCount(test.save_count)}</span>
              </button>
            )}
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
              {formatQuestionCount(test.question_count)} о тебе
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
        {isPublished ? (
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
        ) : (
          <motion.div
            className="w-full rounded-2xl py-4 text-center text-sm font-medium bg-secondary text-muted-foreground"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            {moderationState === "pending" ? "Тест на проверке модераторами" : "Тест пока недоступен"}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
