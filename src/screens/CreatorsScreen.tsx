import { motion } from "framer-motion";
import { ArrowLeft, Trophy, Users, Star, TrendingUp } from "lucide-react";
import { PopcornIcon } from "@/components/icons/PopcornIcon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { haptic } from "@/lib/telegram";

interface Creator {
  id: string;
  username: string;
  avatarUrl?: string;
  hasPremium: boolean;
  totalLikes: number;
  totalQuizzes: number;
  topQuiz?: {
    title: string;
    likes: number;
  };
}

// Mock data - will be replaced with real data from DB
const mockCreators: Creator[] = [
  {
    id: "1",
    username: "QuizMaster",
    avatarUrl: undefined,
    hasPremium: true,
    totalLikes: 15420,
    totalQuizzes: 24,
    topQuiz: { title: "Угадай фильм по кадру", likes: 3250 },
  },
  {
    id: "2",
    username: "BrainGenius",
    avatarUrl: undefined,
    hasPremium: true,
    totalLikes: 12890,
    totalQuizzes: 18,
    topQuiz: { title: "IQ Тест 2024", likes: 2890 },
  },
  {
    id: "3",
    username: "TestPro",
    avatarUrl: undefined,
    hasPremium: false,
    totalLikes: 9540,
    totalQuizzes: 31,
    topQuiz: { title: "Насколько ты интроверт?", likes: 2100 },
  },
  {
    id: "4",
    username: "MindExplorer",
    avatarUrl: undefined,
    hasPremium: true,
    totalLikes: 8720,
    totalQuizzes: 15,
    topQuiz: { title: "Тест на эмпатию", likes: 1980 },
  },
  {
    id: "5",
    username: "QuizNinja",
    avatarUrl: undefined,
    hasPremium: false,
    totalLikes: 7650,
    totalQuizzes: 22,
    topQuiz: { title: "Знаешь ли ты аниме?", likes: 1750 },
  },
  {
    id: "6",
    username: "BrainStorm",
    avatarUrl: undefined,
    hasPremium: false,
    totalLikes: 6340,
    totalQuizzes: 12,
    topQuiz: { title: "Логические задачи", likes: 1420 },
  },
  {
    id: "7",
    username: "TestKing",
    avatarUrl: undefined,
    hasPremium: true,
    totalLikes: 5890,
    totalQuizzes: 9,
    topQuiz: { title: "Психотип личности", likes: 1380 },
  },
  {
    id: "8",
    username: "QuizWizard",
    avatarUrl: undefined,
    hasPremium: false,
    totalLikes: 4520,
    totalQuizzes: 14,
    topQuiz: { title: "География мира", likes: 1100 },
  },
];

interface CreatorsScreenProps {
  onBack: () => void;
  onCreatorSelect?: (creatorId: string) => void;
}

export const CreatorsScreen = ({ onBack, onCreatorSelect }: CreatorsScreenProps) => {
  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `#${index + 1}`;
  };

  return (
    <motion.div
      className="min-h-screen bg-background p-4 pb-24 safe-bottom"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Топ создателей</h1>
          <p className="text-sm text-muted-foreground">Авторы виральных квизов</p>
        </div>
      </div>

      {/* Stats summary */}
      <motion.div
        className="grid grid-cols-3 gap-3 mb-6"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20">
          <CardContent className="p-3 text-center">
            <Users className="w-5 h-5 text-primary mx-auto mb-1" />
            <div className="text-lg font-bold text-foreground">156</div>
            <div className="text-[10px] text-muted-foreground">Создателей</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/20">
          <CardContent className="p-3 text-center">
            <PopcornIcon className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <div className="text-lg font-bold text-foreground">2.4M</div>
            <div className="text-[10px] text-muted-foreground">Лайков</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <div className="text-lg font-bold text-foreground">892</div>
            <div className="text-[10px] text-muted-foreground">Квизов</div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Creators list */}
      <div className="space-y-3">
        {mockCreators.map((creator, index) => (
          <motion.div
            key={creator.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 + index * 0.05 }}
          >
            <Card
              className="overflow-hidden cursor-pointer hover:bg-secondary/50 transition-colors"
              onClick={() => {
                haptic.selection();
                onCreatorSelect?.(creator.id);
              }}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <div className={`w-8 text-center font-bold ${index < 3 ? "text-lg" : "text-sm text-muted-foreground"}`}>
                    {getRankBadge(index)}
                  </div>

                  {/* Avatar */}
                  <Avatar className="w-12 h-12 border-2 border-primary/20">
                    <AvatarImage src={creator.avatarUrl} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {creator.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground truncate">
                        {creator.username}
                      </span>
                      {creator.hasPremium && (
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />
                      )}
                    </div>
                    {creator.topQuiz && (
                      <p className="text-xs text-muted-foreground truncate">
                        🔥 {creator.topQuiz.title}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <PopcornIcon className="w-3 h-3" />
                        {formatNumber(creator.totalLikes)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {creator.totalQuizzes} квизов
                      </span>
                    </div>
                  </div>

                  {/* Top quiz likes */}
                  {creator.topQuiz && (
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">топ квиз</div>
                      <div className="text-sm font-semibold text-primary flex items-center gap-1 justify-end">
                        <PopcornIcon className="w-3.5 h-3.5" />
                        {formatNumber(creator.topQuiz.likes)}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};
