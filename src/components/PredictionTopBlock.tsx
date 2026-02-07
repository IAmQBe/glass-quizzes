import { motion } from "framer-motion";
import { ChevronRight, Clock3, Flame, Plus } from "lucide-react";
import { haptic } from "@/lib/telegram";
import { PredictionPoll, getPredictionPoolTotal } from "@/types/prediction";

interface PredictionTopBlockProps {
  predictions: PredictionPoll[];
  onOpenPrediction: (predictionId: string) => void;
  onOpenAll: () => void;
  onCreatePrediction: () => void;
  createHint?: string;
}

const formatPopcorn = (value: number) => `${Math.round(value).toLocaleString("ru-RU")} 🍿`;

const formatTimeLeft = (deadlineAt: string) => {
  const deadlineMs = new Date(deadlineAt).getTime();
  const diffMs = deadlineMs - Date.now();

  if (diffMs <= 0) {
    return "закрыт";
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}д ${hours}ч`;
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
};

const shortOption = (text: string) => {
  if (text.length <= 12) return text;
  return `${text.slice(0, 12)}...`;
};

export const PredictionTopBlock = ({
  predictions,
  onOpenPrediction,
  onOpenAll,
  onCreatePrediction,
  createHint,
}: PredictionTopBlockProps) => {
  return (
    <motion.section
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.145 }}
      className="space-y-2.5"
    >
      <div className="tg-section p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            Топ-3 событий
          </h3>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {predictions.length === 0 && (
            <div className="rounded-xl border border-border p-3 text-sm text-muted-foreground w-full">
              Сейчас нет открытых событий. Загляни в витрину позже.
            </div>
          )}

          {predictions.slice(0, 3).map((prediction) => (
            <button
              key={prediction.id}
              onClick={() => {
                haptic.impact("light");
                onOpenPrediction(prediction.id);
              }}
              className="w-[208px] shrink-0 rounded-xl border border-border px-2.5 py-2 text-left bg-card"
            >
              <div className="flex items-start justify-between gap-1.5">
                <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">{prediction.title}</p>
                <span className="text-[10px] px-2 py-1 rounded-full bg-secondary text-muted-foreground whitespace-nowrap">
                  {formatTimeLeft(prediction.deadline_at)}
                </span>
              </div>

              <p className="text-xs text-muted-foreground mt-1">
                Пул: {formatPopcorn(getPredictionPoolTotal(prediction))}
              </p>

              <div className="mt-1 flex gap-1 flex-wrap">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-foreground">
                  A: {shortOption(prediction.option_a_label)}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-foreground">
                  B: {shortOption(prediction.option_b_label)}
                </span>
              </div>

              <div className="mt-1.5 flex justify-end">
                <span className="text-xs text-primary font-medium inline-flex items-center gap-1">
                  Открыть
                  <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              haptic.selection();
              onOpenAll();
            }}
            className="h-10 rounded-xl px-3 text-sm font-medium bg-secondary text-foreground inline-flex items-center justify-center gap-1.5"
          >
            <Clock3 className="w-3.5 h-3.5" />
            Перейти
          </button>
          <button
            onClick={() => {
              haptic.impact("medium");
              onCreatePrediction();
            }}
            className="h-10 rounded-xl px-3 text-sm font-semibold bg-secondary text-primary inline-flex items-center justify-center gap-1.5 active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            Создать событие
          </button>
        </div>

        {createHint ? <p className="text-xs text-muted-foreground text-center">{createHint}</p> : null}
      </div>
    </motion.section>
  );
};
