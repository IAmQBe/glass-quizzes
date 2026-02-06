import { useMemo, useState } from "react";
import { AlertTriangle, Check, ExternalLink, Eye, EyeOff, Loader2, ShieldCheck, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { haptic } from "@/lib/telegram";
import { toast } from "@/hooks/use-toast";
import { useModeratePredictionPoll, usePredictionPolls } from "@/hooks/usePredictions";
import {
  PredictionModerationAction,
  PredictionOption,
  PredictionPoll,
  PredictionStatus,
  getPredictionPoolTotal,
  predictionStatusLabel,
} from "@/types/prediction";

type PredictionFilter = "pending" | "open" | "under_review" | "locked" | "resolved" | "rejected" | "cancelled";

interface PredictionModerationTabProps {
  onOpenPrediction?: (predictionId: string) => void;
}

const FILTERS: Array<{ id: PredictionFilter; label: string }> = [
  { id: "pending", label: "Pending" },
  { id: "open", label: "Open" },
  { id: "under_review", label: "Review" },
  { id: "locked", label: "Locked" },
  { id: "resolved", label: "Resolved" },
  { id: "rejected", label: "Rejected" },
  { id: "cancelled", label: "Cancelled" },
];

const isHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const formatPopcorn = (value: number) => `${Math.round(value).toLocaleString("ru-RU")} 🍿`;

const isFilterMatch = (status: PredictionStatus, filter: PredictionFilter) => {
  if (filter === "locked") {
    return status === "locked" || status === "pending_resolution";
  }
  return status === filter;
};

const resolveReadyStatuses: PredictionStatus[] = ["locked", "pending_resolution", "under_review"];
const cancellableStatuses: PredictionStatus[] = ["pending", "open", "locked", "pending_resolution", "under_review"];

export const PredictionModerationTab = ({ onOpenPrediction }: PredictionModerationTabProps) => {
  const { data: predictions = [], isLoading } = usePredictionPolls();
  const moderatePrediction = useModeratePredictionPoll();

  const [statusFilter, setStatusFilter] = useState<PredictionFilter>("pending");
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [outcomes, setOutcomes] = useState<Record<string, PredictionOption>>({});

  const filteredPredictions = useMemo(() => {
    return predictions
      .filter((poll) => isFilterMatch(poll.status, statusFilter))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [predictions, statusFilter]);

  const runAction = async (
    poll: PredictionPoll,
    action: PredictionModerationAction,
    extras?: Partial<{ rejection_reason: string; proof_url: string; resolved_option: PredictionOption }>
  ) => {
    try {
      haptic.selection();
      await moderatePrediction.mutateAsync({
        poll_id: poll.id,
        action,
        ...extras,
      });
      toast({ title: "Обновлено", description: "Действие модерации выполнено" });
    } catch (error: any) {
      toast({
        title: "Ошибка модерации",
        description: error?.message || "Не удалось выполнить действие",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (poll: PredictionPoll) => {
    const reason = rejectReasons[poll.id]?.trim() || "";
    if (!reason) {
      toast({ title: "Нужна причина", description: "Укажите причину отклонения", variant: "destructive" });
      return;
    }

    await runAction(poll, "reject", { rejection_reason: reason });
  };

  const handleResolve = async (poll: PredictionPoll) => {
    const outcome = outcomes[poll.id] || "A";
    const proofUrl = (proofUrls[poll.id] || poll.proof_url || "").trim();

    if (!isHttpUrl(proofUrl)) {
      toast({
        title: "Некорректный proof URL",
        description: "Укажите валидную ссылку с http/https",
        variant: "destructive",
      });
      return;
    }

    await runAction(poll, "resolve", {
      resolved_option: outcome,
      proof_url: proofUrl,
    });
  };

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              haptic.selection();
              setStatusFilter(item.id);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
              statusFilter === item.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filteredPredictions.length === 0 ? (
        <div className="tg-section p-6 text-center">
          <p className="text-muted-foreground">Нет прогнозов для этого фильтра</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPredictions.map((poll) => {
            const selectedOutcome = outcomes[poll.id] || "A";
            const rejectReason = rejectReasons[poll.id] ?? "";
            const proofUrl = proofUrls[poll.id] ?? poll.proof_url ?? "";

            return (
              <div key={poll.id} className="tg-section p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground leading-snug line-clamp-2">{poll.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{poll.squad_title}</p>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-secondary text-muted-foreground whitespace-nowrap">
                    {predictionStatusLabel[poll.status]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <p>Пул: {formatPopcorn(getPredictionPoolTotal(poll))}</p>
                  <p>Участников: {poll.participant_count}</p>
                  <p>Репортов: {poll.report_count}</p>
                  <p>ID: {poll.id.slice(0, 8)}…</p>
                </div>

                {poll.rejection_reason && (
                  <div className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                    Причина отклонения: {poll.rejection_reason}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {onOpenPrediction && (
                    <button
                      onClick={() => onOpenPrediction(poll.id)}
                      className="rounded-lg bg-secondary text-foreground px-3 py-2 text-xs inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Открыть детально
                    </button>
                  )}

                  <button
                    onClick={() => void runAction(poll, "toggle_hidden")}
                    disabled={moderatePrediction.isPending}
                    className="rounded-lg bg-secondary text-foreground px-3 py-2 text-xs inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    {poll.is_hidden ? (
                      <>
                        <Eye className="w-3.5 h-3.5" /> Unhide
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" /> Hide
                      </>
                    )}
                  </button>
                </div>

                {poll.status === "pending" && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => void runAction(poll, "approve")}
                        disabled={moderatePrediction.isPending}
                        className="flex-1 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 py-2 text-xs font-medium inline-flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => void handleReject(poll)}
                        disabled={moderatePrediction.isPending}
                        className="flex-1 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 py-2 text-xs font-medium inline-flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                    <Input
                      value={rejectReason}
                      onChange={(e) => setRejectReasons((prev) => ({ ...prev, [poll.id]: e.target.value }))}
                      placeholder="Причина отклонения"
                      className="bg-secondary border-0"
                    />
                  </div>
                )}

                {poll.status === "rejected" && (
                  <button
                    onClick={() => void runAction(poll, "approve")}
                    disabled={moderatePrediction.isPending}
                    className="w-full rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 py-2 text-xs font-medium inline-flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" /> Publish (Approve)
                  </button>
                )}

                {poll.status === "open" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => void runAction(poll, "close_stakes")}
                      disabled={moderatePrediction.isPending}
                      className="rounded-lg bg-secondary text-foreground py-2 text-xs font-medium disabled:opacity-50"
                    >
                      Закрыть ставки
                    </button>
                    <button
                      onClick={() => void runAction(poll, "set_under_review")}
                      disabled={moderatePrediction.isPending}
                      className="rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 py-2 text-xs font-medium inline-flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> Under review
                    </button>
                  </div>
                )}

                {(poll.status === "locked" || poll.status === "under_review") && (
                  <button
                    onClick={() => void runAction(poll, "set_pending_resolution")}
                    disabled={moderatePrediction.isPending}
                    className="w-full rounded-lg bg-secondary text-foreground py-2 text-xs font-medium disabled:opacity-50"
                  >
                    В pending resolution
                  </button>
                )}

                {poll.status === "locked" && (
                  <button
                    onClick={() => void runAction(poll, "set_under_review")}
                    disabled={moderatePrediction.isPending}
                    className="w-full rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 py-2 text-xs font-medium inline-flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Under review
                  </button>
                )}

                {resolveReadyStatuses.includes(poll.status) && (
                  <div className="space-y-2 rounded-lg bg-secondary p-3">
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Resolve
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setOutcomes((prev) => ({ ...prev, [poll.id]: "A" }))}
                        className={`rounded-lg px-3 py-2 text-xs ${
                          selectedOutcome === "A" ? "bg-primary text-primary-foreground" : "bg-background"
                        }`}
                      >
                        Исход A
                      </button>
                      <button
                        onClick={() => setOutcomes((prev) => ({ ...prev, [poll.id]: "B" }))}
                        className={`rounded-lg px-3 py-2 text-xs ${
                          selectedOutcome === "B" ? "bg-primary text-primary-foreground" : "bg-background"
                        }`}
                      >
                        Исход B
                      </button>
                    </div>
                    <Input
                      value={proofUrl}
                      onChange={(e) => setProofUrls((prev) => ({ ...prev, [poll.id]: e.target.value }))}
                      placeholder="https://proof-link"
                      className="bg-background border-0"
                    />
                    <button
                      onClick={() => void handleResolve(poll)}
                      disabled={moderatePrediction.isPending}
                      className="w-full rounded-lg bg-primary text-primary-foreground py-2 text-xs font-medium disabled:opacity-50"
                    >
                      Resolve
                    </button>
                  </div>
                )}

                {cancellableStatuses.includes(poll.status) && (
                  <button
                    onClick={() => void runAction(poll, "cancel")}
                    disabled={moderatePrediction.isPending}
                    className="w-full rounded-lg bg-destructive text-destructive-foreground py-2 text-xs font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};
