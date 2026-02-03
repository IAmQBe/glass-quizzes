import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Search, Users, X, Plus, Trophy } from "lucide-react";
import { PopcornIcon } from "@/components/icons/PopcornIcon";
import { useSquads, useMySquad, Squad } from "@/hooks/useSquads";
import { haptic } from "@/lib/telegram";
import { Input } from "@/components/ui/input";

interface SquadListScreenProps {
  onBack: () => void;
  onSquadSelect: (squad: Squad) => void;
  onCreateSquad: () => void;
}

export const SquadListScreen = ({ onBack, onSquadSelect, onCreateSquad }: SquadListScreenProps) => {
  const { data: squads = [], isLoading } = useSquads();
  const { data: mySquad } = useMySquad();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSquads = useMemo(() => {
    if (!searchQuery.trim()) return squads;
    const query = searchQuery.toLowerCase();
    return squads.filter(s => 
      s.title.toLowerCase().includes(query) ||
      s.username?.toLowerCase().includes(query)
    );
  }, [squads, searchQuery]);

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col bg-background"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
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
          <h1 className="text-lg font-semibold flex-1">Попкорн-команды</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-5 space-y-4">
        {/* My Squad Card */}
        {mySquad && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="tg-section p-4 border-2 border-primary/30"
          >
            <div className="flex items-center gap-1 text-xs text-primary font-medium mb-2">
              <Trophy className="w-3 h-3" />
              Твоя команда
            </div>
            <button
              onClick={() => {
                haptic.impact('light');
                onSquadSelect(mySquad);
              }}
              className="flex items-center gap-3 w-full text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center flex-shrink-0">
                {mySquad.avatar_url ? (
                  <img src={mySquad.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                ) : (
                  <PopcornIcon className="w-6 h-6 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">{mySquad.title}</h3>
                {mySquad.username && (
                  <p className="text-xs text-muted-foreground">@{mySquad.username}</p>
                )}
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-orange-500 font-medium">
                  <PopcornIcon className="w-4 h-4" />
                  {formatCount(mySquad.total_popcorns)}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="w-3 h-3" />
                  {formatCount(mySquad.member_count)}
                </div>
              </div>
            </button>
          </motion.div>
        )}

        {/* Search */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="relative"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию или @username"
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </motion.div>

        {/* Create Squad Button */}
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          onClick={() => {
            haptic.impact('medium');
            onCreateSquad();
          }}
          className="tg-section p-4 w-full flex items-center gap-3 border-2 border-dashed border-border hover:border-primary/50 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Plus className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="font-semibold text-foreground">Создать команду</h3>
            <p className="text-xs text-muted-foreground">Из своего канала или чата</p>
          </div>
        </motion.button>

        {/* Squads List */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground px-1">
            {searchQuery ? `Найдено: ${filteredSquads.length}` : `Все команды (${squads.length})`}
          </h2>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="tg-section p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-secondary" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-secondary rounded w-2/3" />
                      <div className="h-3 bg-secondary rounded w-1/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredSquads.length === 0 ? (
            <div className="tg-section p-6 text-center">
              <PopcornIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-1">
                {searchQuery ? "Ничего не найдено" : "Пока нет команд"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery 
                  ? "Попробуй другой запрос" 
                  : "Стань первым — создай свою команду!"
                }
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredSquads.map((squad, index) => (
                <motion.button
                  key={squad.id}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15 + index * 0.03 }}
                  onClick={() => {
                    haptic.impact('light');
                    onSquadSelect(squad);
                  }}
                  className={`tg-section p-4 w-full flex items-center gap-3 text-left ${
                    mySquad?.id === squad.id ? 'ring-2 ring-primary/30' : ''
                  }`}
                >
                  {/* Rank */}
                  <div className="w-6 text-center text-sm font-medium text-muted-foreground">
                    #{index + 1}
                  </div>

                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center flex-shrink-0">
                    {squad.avatar_url ? (
                      <img src={squad.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                    ) : (
                      <PopcornIcon className="w-6 h-6 text-white" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{squad.title}</h3>
                    {squad.username && (
                      <p className="text-xs text-muted-foreground">@{squad.username}</p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-orange-500 font-medium">
                      <PopcornIcon className="w-4 h-4" />
                      {formatCount(squad.total_popcorns)}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="w-3 h-3" />
                      {formatCount(squad.member_count)}
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </motion.div>
  );
};
