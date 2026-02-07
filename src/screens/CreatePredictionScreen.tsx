import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { haptic } from "@/lib/telegram";
import { toast } from "@/hooks/use-toast";
import { useCreatePredictionPoll } from "@/hooks/usePredictions";
import { useSquads } from "@/hooks/useSquads";
import { PredictionCreationEligibility } from "@/types/prediction";

interface CreatePredictionScreenProps {
  onBack: () => void;
  onCreated: (pollId: string) => void;
  eligibility: PredictionCreationEligibility | null;
}

const toDateTimeLocalValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getDefaultDeadline = () => {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setSeconds(0, 0);
  return toDateTimeLocalValue(date);
};

export const CreatePredictionScreen = ({ onBack, onCreated, eligibility }: CreatePredictionScreenProps) => {
  const createPrediction = useCreatePredictionPoll();
  const { data: squads = [] } = useSquads();

  const [title, setTitle] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [deadlineAt, setDeadlineAt] = useState(getDefaultDeadline);
  const [stakeEnabled, setStakeEnabled] = useState(true);
  const [voteEnabled, setVoteEnabled] = useState(true);
  const [selectedSquadId, setSelectedSquadId] = useState<string>("");

  const isAdmin = Boolean(eligibility?.is_admin);
  const fallbackSquadId = eligibility?.squad_id || "";
  const effectiveSquadId = isAdmin ? (selectedSquadId || fallbackSquadId) : fallbackSquadId;
  const selectedSquadName = useMemo(() => {
    if (!effectiveSquadId) {
      return eligibility?.squad_title || "Выбери сквад";
    }
    const match = squads.find((squad) => squad.id === effectiveSquadId);
    return match?.title || eligibility?.squad_title || "Сквад";
  }, [effectiveSquadId, eligibility?.squad_title, squads]);
  const monthlyLimit = eligibility?.monthly_limit ?? 5;
  const remaining = eligibility?.remaining_this_month ?? monthlyLimit;

  useEffect(() => {
    if (eligibility?.squad_id) {
      setSelectedSquadId(eligibility.squad_id);
      return;
    }
    if (isAdmin && squads.length > 0) {
      setSelectedSquadId((prev) => prev || squads[0].id);
    }
  }, [eligibility?.squad_id, isAdmin, squads]);

  const canSubmit = useMemo(() => {
    return (
      Boolean(title.trim()) &&
      Boolean(optionA.trim()) &&
      Boolean(optionB.trim()) &&
      Boolean(effectiveSquadId) &&
      Boolean(deadlineAt) &&
      (stakeEnabled || voteEnabled) &&
      !createPrediction.isPending
    );
  }, [title, optionA, optionB, effectiveSquadId, deadlineAt, stakeEnabled, voteEnabled, createPrediction.isPending]);

  const handleSubmit = async () => {
    if (!(eligibility?.eligible ?? false)) {
      toast({
        title: "Доступ ограничен",
        description: "Сначала выполните требования создания события.",
      });
      return;
    }

    if (!effectiveSquadId) {
      toast({
        title: "Выбери сквад",
        description: "Для создания события нужно выбрать команду.",
      });
      return;
    }

    if (!stakeEnabled && !voteEnabled) {
      toast({
        title: "Выберите режим",
        description: "Включите хотя бы один режим участия: ставка или голос.",
      });
      return;
    }

    const parsedDeadline = new Date(deadlineAt);
    if (Number.isNaN(parsedDeadline.getTime())) {
      toast({
        title: "Некорректный дедлайн",
        description: "Укажите корректную дату и время закрытия ставок.",
      });
      return;
    }

    try {
      haptic.impact("medium");

      const result = await createPrediction.mutateAsync({
        title: title.trim(),
        option_a_label: optionA.trim(),
        option_b_label: optionB.trim(),
        squad_id: effectiveSquadId,
        cover_image_url: coverImageUrl.trim() || undefined,
        deadline_at: parsedDeadline.toISOString(),
        stake_enabled: stakeEnabled,
        vote_enabled: voteEnabled,
      });

      const isPendingModeration = result.next_status === "pending";
      toast({
        title: isPendingModeration ? "Отправлено на модерацию" : "Событие опубликовано",
        description: isPendingModeration
          ? "После одобрения администратором событие появится в ленте."
          : "Событие сразу доступно в прод.",
      });
      onCreated(result.poll_id || "");
    } catch (error: any) {
      const message = error?.message || "Не удалось создать событие";
      toast({
        title: "Ошибка",
        description: message,
      });
    }
  };

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
          <h1 className="text-lg font-semibold text-foreground">Создать событие</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          Сквад {selectedSquadName} · Осталось {remaining}/{monthlyLimit}
        </div>

        <div className="tg-section p-4 space-y-3">
          {isAdmin ? (
            <div>
              <label className="text-xs text-muted-foreground">Сквад (админ-режим)</label>
              <Select value={effectiveSquadId || undefined} onValueChange={setSelectedSquadId}>
                <SelectTrigger className="mt-1 bg-secondary border-0">
                  <SelectValue placeholder="Выбери сквад" />
                </SelectTrigger>
                <SelectContent>
                  {squads.map((squad) => (
                    <SelectItem key={squad.id} value={squad.id}>
                      {squad.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div>
            <label className="text-xs text-muted-foreground">Заголовок</label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              placeholder="Короткий, мемный заголовок"
              className="mt-1 bg-secondary border-0"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Исход A</label>
            <Input
              value={optionA}
              onChange={(event) => setOptionA(event.target.value)}
              maxLength={80}
              placeholder="Например: Выиграют сегодня"
              className="mt-1 bg-secondary border-0"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Исход B</label>
            <Input
              value={optionB}
              onChange={(event) => setOptionB(event.target.value)}
              maxLength={80}
              placeholder="Например: Перенесут на завтра"
              className="mt-1 bg-secondary border-0"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Обложка (URL)</label>
            <Input
              value={coverImageUrl}
              onChange={(event) => setCoverImageUrl(event.target.value)}
              placeholder="https://..."
              className="mt-1 bg-secondary border-0"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <CalendarClock className="w-3.5 h-3.5" />
              Ставки до
            </label>
            <Input
              type="datetime-local"
              value={deadlineAt}
              onChange={(event) => setDeadlineAt(event.target.value)}
              className="mt-1 bg-secondary border-0"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Режимы участия</p>
            <div className="rounded-lg bg-secondary p-3 flex items-center justify-between">
              <span className="text-sm text-foreground">Ставка</span>
              <Switch checked={stakeEnabled} onCheckedChange={setStakeEnabled} />
            </div>
            <div className="rounded-lg bg-secondary p-3 flex items-center justify-between">
              <span className="text-sm text-foreground">Голос (репутация)</span>
              <Switch checked={voteEnabled} onCheckedChange={setVoteEnabled} />
            </div>
          </div>

          <button onClick={handleSubmit} disabled={!canSubmit} className="tg-button disabled:opacity-60">
            {createPrediction.isPending ? "Создаём..." : "Создать событие"}
          </button>
        </div>
      </div>
    </motion.div>
  );
};
