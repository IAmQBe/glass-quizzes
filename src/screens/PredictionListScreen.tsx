import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { haptic } from "@/lib/telegram";
import { PredictionPoll, PredictionStatus, getPredictionPoolTotal, predictionStatusLabel } from "@/types/prediction";

type StatusFilter = "open" | "locked" | "resolved" | "moderation";
type ScopeFilter = "all" | "my_squad";
type SortMode = "popular" | "closing" | "new";

interface PredictionListScreenProps {
  predictions: PredictionPoll[];
  mySquadId?: string | null;
  onBack: () => void;
  onOpenPrediction: (predictionId: string) => void;
  onCreatePrediction: () => void;
  createQuotaBadge?: string;
}

const OPEN_STATUSES: PredictionStatus[] = ["open"];
const LOCKED_STATUSES: PredictionStatus[] = ["locked", "pending_resolution", "under_review"];
const RESOLVED_STATUSES: PredictionStatus[] = ["resolved", "cancelled", "invalid"];
const MODERATION_STATUSES: PredictionStatus[] = ["pending", "rejected"];

const formatPopcorn = (value: number) => `${Math.round(value).toLocaleString("ru-RU")} 🍿`;

const formatTimeLeft = (deadlineAt: string) => {
  const deadlineMs = new Date(deadlineAt).getTime();
  const diffMs = deadlineMs - Date.now();
  if (diffMs <= 0) return "дедлайн истек";

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}д ${hours}ч`;
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
};

const isStatusMatch = (status: PredictionStatus, filter: StatusFilter) => {
  if (filter === "open") return OPEN_STATUSES.includes(status);
  if (filter === "locked") return LOCKED_STATUSES.includes(status);
  if (filter === "moderation") return MODERATION_STATUSES.includes(status);
  return RESOLVED_STATUSES.includes(status);
};

export const PredictionListScreen = ({
  predictions,
  mySquadId,
  onBack,
  onOpenPrediction,
  onCreatePrediction,
  createQuotaBadge,
}: PredictionListScreenProps) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("popular");
  const [searchQuery, setSearchQuery] = useState("");

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const hasModerationItems = useMemo(
    () => predictions.some((prediction) => MODERATION_STATUSES.includes(prediction.status)),
    [predictions]
  );

  const filteredPredictions = useMemo(() => {
    let next = predictions.filter((prediction) => isStatusMatch(prediction.status, statusFilter));

    if (scopeFilter === "my_squad" && mySquadId) {
      next = next.filter((prediction) => prediction.squad_id === mySquadId);
    }

    if (normalizedQuery) {
      next = next.filter((prediction) => {
        return (
          prediction.title.toLowerCase().includes(normalizedQuery) ||
          prediction.option_a_label.toLowerCase().includes(normalizedQuery) ||
          prediction.option_b_label.toLowerCase().includes(normalizedQuery) ||
          prediction.squad_title.toLowerCase().includes(normalizedQuery)
        );
      });
    }

    next.sort((a, b) => {
      if (sortMode === "popular") {
        const byPool = getPredictionPoolTotal(b) - getPredictionPoolTotal(a);
        if (byPool !== 0) return byPool;
        return b.participant_count - a.participant_count;
      }
      if (sortMode === "closing") {
        return new Date(a.deadline_at).getTime() - new Date(b.deadline_at).getTime();
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return next;
  }, [predictions, statusFilter, scopeFilter, mySquadId, normalizedQuery, sortMode]);

  return (
    <motion.div
      className="min-h-screen bg-background pb-24"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="sticky top-0 bg-background/80 backdrop-blur-lg z-10 px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => {
              haptic.selection();
              onBack();
            }}
            className="p-2 -ml-2 text-primary"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-foreground flex-1 text-center">Все прогнозы</h1>
          <div className="flex items-center gap-2">
            {createQuotaBadge ? (
              <span className="text-[10px] px-2 py-1 rounded-full bg-secondary text-muted-foreground whitespace-nowrap">
                {createQuotaBadge}
              </span>
            ) : null}
            <button
              onClick={() => {
                haptic.impact("medium");
                onCreatePrediction();
              }}
              className="p-2 text-primary"
              aria-label="Создать прогноз"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск прогноза..."
            className="pl-9 bg-secondary border-0"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {(
            [
              { id: "open", label: "Open" },
              { id: "locked", label: "Locked" },
              ...(hasModerationItems ? ([{ id: "moderation", label: "На модерации" }] as const) : []),
              { id: "resolved", label: "Resolved" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                haptic.selection();
                setStatusFilter(item.id);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                statusFilter === item.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {(
            [
              { id: "all", label: "Все" },
              { id: "my_squad", label: "Мой сквад" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                haptic.selection();
                setScopeFilter(item.id);
              }}
              disabled={item.id === "my_squad" && !mySquadId}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap disabled:opacity-50 ${
                scopeFilter === item.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {(
            [
              { id: "popular", label: "Популярные" },
              { id: "closing", label: "Скоро закроются" },
              { id: "new", label: "Новые" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                haptic.selection();
                setSortMode(item.id);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                sortMode === item.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filteredPredictions.length === 0 ? (
            <div className="tg-section p-6 text-center">
              <p className="font-medium text-foreground">Прогнозы не найдены</p>
              <p className="text-sm text-muted-foreground mt-1">
                Попробуй сменить фильтры или поисковый запрос.
              </p>
            </div>
          ) : (
            filteredPredictions.map((prediction) => (
              <button
                key={prediction.id}
                onClick={() => {
                  haptic.impact("light");
                  onOpenPrediction(prediction.id);
                }}
                className="w-full tg-section p-3 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-snug">{prediction.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{prediction.squad_title}</p>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-secondary text-muted-foreground whitespace-nowrap">
                    {predictionStatusLabel[prediction.status]}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Ставки до: {formatTimeLeft(prediction.deadline_at)}</span>
                  <span>{prediction.participant_count} участников</span>
                </div>

                <div className="mt-1.5 flex items-center justify-between">
                  <p className="text-xs text-foreground font-medium">
                    Пул: {formatPopcorn(getPredictionPoolTotal(prediction))}
                  </p>
                  <span className="text-xs text-primary font-medium inline-flex items-center gap-1">
                    Открыть
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
};
