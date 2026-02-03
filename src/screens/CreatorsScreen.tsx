import { motion } from "framer-motion";
import { ArrowLeft, Trophy, Users, Star, TrendingUp, Loader2 } from "lucide-react";
import { PopcornIcon } from "@/components/icons/PopcornIcon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { haptic } from "@/lib/telegram";
import { useLeaderboard, formatNumber } from "@/hooks/useLeaderboard";

interface CreatorsScreenProps {
  onBack: () => void;
  onCreatorSelect?: (creatorId: string) => void;
}

export const CreatorsScreen = ({ onBack, onCreatorSelect }: CreatorsScreenProps) => {
  const { data: creators = [], isLoading, error } = useLeaderboard('popcorns', 50);

  const handleBack = () => {
    haptic.selection();
    onBack();
  };

  const getRankBadge = (index: number) => {
    if (index === 0) {
      return (
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
          <Trophy className="w-3.5 h-3.5 text-white" />
        </div>
      );
    }
    if (index === 1) {
      return (
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">2</span>
        </div>
      );
    }
    if (index === 2) {
      return (
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-600 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">3</span>
        </div>
      );
    }
    return null;
  };

  const getDisplayName = (creator: typeof creators[0]) => {
    return creator.username || creator.first_name || 'Creator';
  };

  return (
    <motion.div
      className="flex flex-col min-h-screen pb-32"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="sticky top-0 bg-background/80 backdrop-blur-lg z-10 px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <button
            className="p-2 -ml-2 text-primary"
            onClick={handleBack}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Топ создателей</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Stats Header */}
      <div className="px-4 py-4 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Лидеры по попкорну</h2>
            <p className="text-xs text-muted-foreground">
              Создатели самых популярных квизов
            </p>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && creators.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <PopcornIcon className="w-16 h-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Пока нет создателей</h3>
          <p className="text-muted-foreground text-center text-sm">
            Будь первым! Создавай квизы и собирай попкорн 🍿
          </p>
        </div>
      )}

      {/* Creators Grid */}
      {!isLoading && creators.length > 0 && (
        <div className="px-4 py-4 space-y-3">
          {creators.map((creator, index) => (
            <motion.div
              key={creator.user_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className="cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => {
                  haptic.selection();
                  onCreatorSelect?.(creator.user_id);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="relative">
                      <Avatar className="w-14 h-14">
                        <AvatarImage src={creator.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-lg">
                          {(creator.username || creator.first_name || '?')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {getRankBadge(index)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground truncate">
                          {getDisplayName(creator)}
                        </span>
                        {creator.has_premium && (
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {creator.quiz_count || 0} квизов
                        </span>
                      </div>
                    </div>

                    {/* Popcorns */}
                    <div className="text-right">
                      <div className="flex items-center gap-1.5">
                        <PopcornIcon className="w-5 h-5 text-amber-500" />
                        <span className="font-bold text-foreground">
                          {formatNumber(creator.total_popcorns || 0)}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        #{index + 1}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
