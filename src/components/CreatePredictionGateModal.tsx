import { CheckCircle2, Circle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PredictionCreationEligibility, PredictionSquadMonthlyQuota } from "@/types/prediction";

interface CreatePredictionGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eligibility: PredictionCreationEligibility | null;
  quota?: PredictionSquadMonthlyQuota | null;
  onGoToTests: () => void;
  onCreateSquad: () => void;
  onOpenMySquad: () => void;
}

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const ChecklistItem = ({ done, label }: { done: boolean; label: string }) => (
  <li className="flex items-start gap-2 text-sm">
    {done ? (
      <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
    ) : (
      <Circle className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
    )}
    <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
  </li>
);

export const CreatePredictionGateModal = ({
  open,
  onOpenChange,
  eligibility,
  quota,
  onGoToTests,
  onCreateSquad,
  onOpenMySquad,
}: CreatePredictionGateModalProps) => {
  const requiredCount = eligibility?.required_completed_count ?? 3;
  const completedCount = eligibility?.completed_count ?? 0;
  const hasProgress = completedCount >= requiredCount;
  const hasSquad = eligibility?.has_squad ?? false;
  const isCaptain = (eligibility?.is_squad_captain ?? false) || (eligibility?.is_admin ?? false);
  const monthlyLimit = eligibility?.monthly_limit ?? quota?.monthly_limit ?? 5;
  const remaining = eligibility?.remaining_this_month ?? quota?.remaining_this_month ?? monthlyLimit;
  const cooldownHoursLeft = eligibility?.cooldown_hours_left ?? 0;
  const resetDateText = quota?.resets_at ? formatDateTime(quota.resets_at) : "в начале следующего месяца";

  let ctaLabel = "Понятно";
  let ctaAction = () => onOpenChange(false);
  let helperText = "";

  if (!hasProgress) {
    ctaLabel = "Перейти";
    ctaAction = () => {
      onOpenChange(false);
      onGoToTests();
    };
  } else if (!hasSquad) {
    ctaLabel = "Создать команду";
    ctaAction = () => {
      onOpenChange(false);
      onCreateSquad();
    };
  } else if (!isCaptain) {
    ctaLabel = "Открыть мою команду";
    ctaAction = () => {
      onOpenChange(false);
      onOpenMySquad();
    };
  } else if ((eligibility?.blocking_reason_code ?? null) === "month_limit") {
    ctaLabel = "Понятно";
    helperText = `Лимит обновится ${resetDateText}`;
  } else if ((eligibility?.blocking_reason_code ?? null) === "cooldown") {
    ctaLabel = "Понятно";
    helperText = `Новый прогноз через ${cooldownHoursLeft}ч`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-5">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base">Почти готово к созданию прогноза</DialogTitle>
          <DialogDescription>
            Вам нужно: пройти {requiredCount} квеста/теста, создать свою команду и публиковать прогнозы от лица
            команды.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          <ChecklistItem done={hasProgress} label={`Пройти тесты/квесты: ${completedCount}/${requiredCount}`} />
          <ChecklistItem done={hasSquad} label="Создать или выбрать свою команду" />
          <ChecklistItem done={isCaptain} label="Быть капитаном команды" />
          <ChecklistItem done={remaining > 0} label={`Лимит команды: осталось ${remaining}/${monthlyLimit} в этом месяце`} />
          {cooldownHoursLeft > 0 && <ChecklistItem done={false} label={`Cooldown: ${cooldownHoursLeft}ч`} />}
        </ul>

        <div className="space-y-2">
          <Button onClick={ctaAction} className="w-full">
            {ctaLabel}
          </Button>
          {helperText ? <p className="text-xs text-muted-foreground text-center">{helperText}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
