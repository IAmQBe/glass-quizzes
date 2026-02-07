import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, ExternalLink, Eye, EyeOff, Loader2, Pencil, ShieldCheck, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { haptic } from "@/lib/telegram";
import { toast } from "@/hooks/use-toast";
import { useAdminDeletePredictionPoll, useAdminUpdatePredictionPoll, useModeratePredictionPoll, usePredictionPolls } from "@/hooks/usePredictions";
import {
  PredictionModerationAction,
  PredictionOption,
  PredictionPoll,
  PredictionStatus,
  getPredictionPoolTotal,
  predictionStatusLabel,
} from "@/types/prediction";

type PredictionFilter = "all" | "pending" | "open" | "under_review" | "locked" | "resolved" | "rejected" | "cancelled";

interface PredictionModerationTabProps {
  onOpenPrediction?: (predictionId: string) => void;
}

const FILTERS: Array<{ id: PredictionFilter; label: string }> = [
  { id: "all", label: "All" },
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
  if (filter === "all") {
    return true;
  }
  if (filter === "locked") {
    return status === "locked" || status === "pending_resolution";
  }
  return status === filter;
};

const resolveReadyStatuses: PredictionStatus[] = ["locked", "pending_resolution", "under_review"];
const cancellableStatuses: PredictionStatus[] = ["pending", "open", "locked", "pending_resolution", "under_review"];

type CreatorRecord = {
  id: string;
  first_name: string | null;
  username: string | null;
};

const toDateTimeLocalValue = (isoValue: string) => {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const PredictionModerationTab = ({ onOpenPrediction }: PredictionModerationTabProps) => {
  const { data: predictions = [], isLoading, error } = usePredictionPolls();
  const moderatePrediction = useModeratePredictionPoll();
  const updatePrediction = useAdminUpdatePredictionPoll();
  const deletePrediction = useAdminDeletePredictionPoll();

  const [statusFilter, setStatusFilter] = useState<PredictionFilter>("open");
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [outcomes, setOutcomes] = useState<Record<string, PredictionOption>>({});
  const [editingPollId, setEditingPollId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    title: "",
    option_a_label: "",
    option_b_label: "",
    cover_image_url: "",
    deadline_at_local: "",
    stake_enabled: true,
    vote_enabled: true,
  });

  const creatorIds = useMemo(() => {
    const ids = predictions.map((poll) => poll.created_by).filter(Boolean);
    return Array.from(new Set(ids));
  }, [predictions]);

  const { data: creatorsMap = {} } = useQuery({
    queryKey: ["admin", "prediction_creators", creatorIds.join(",")],
    enabled: creatorIds.length > 0,
    queryFn: async (): Promise<Record<string, CreatorRecord>> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, username")
        .in("id", creatorIds);

      if (error) throw error;
      const rows = (data || []) as CreatorRecord[];
      return rows.reduce<Record<string, CreatorRecord>>((acc, row) => {
        acc[row.id] = row;
        return acc;
      }, {});
    },
  });

  const getCreatorDisplay = (createdBy: string) => {
    if (!createdBy) return "Автор неизвестен";
    const creator = creatorsMap[createdBy];
    if (!creator) return `Автор ${createdBy.slice(0, 6)}`;
    return creator.first_name || creator.username || `Автор ${createdBy.slice(0, 6)}`;
  };

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    predictions.forEach((poll) => {
      counts[poll.status] = (counts[poll.status] || 0) + 1;
    });
    return counts;
  }, [predictions]);

  const getFilterCount = (filter: PredictionFilter) => {
    if (filter === "all") return predictions.length;
    if (filter === "locked") {
      return (filterCounts.locked || 0) + (filterCounts.pending_resolution || 0);
    }
    return filterCounts[filter] || 0;
  };

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

  const startEdit = (poll: PredictionPoll) => {
    setEditingPollId(poll.id);
    setEditDraft({
      title: poll.title || "",
      option_a_label: poll.option_a_label || "",
      option_b_label: poll.option_b_label || "",
      cover_image_url: poll.cover_image_url === "/placeholder.svg" ? "" : poll.cover_image_url || "",
      deadline_at_local: toDateTimeLocalValue(poll.deadline_at),
      stake_enabled: poll.stake_enabled ?? true,
      vote_enabled: poll.vote_enabled ?? true,
    });
  };

  const cancelEdit = () => {
    setEditingPollId(null);
  };

  const saveEdit = async (poll: PredictionPoll) => {
    const localDeadline = editDraft.deadline_at_local.trim();
    const deadlineIso = localDeadline ? new Date(localDeadline).toISOString() : null;

    try {
      haptic.selection();
      await updatePrediction.mutateAsync({
        poll_id: poll.id,
        title: editDraft.title,
        option_a_label: editDraft.option_a_label,
        option_b_label: editDraft.option_b_label,
        // Important: empty string means "clear", null means "keep existing"
        cover_image_url: editDraft.cover_image_url,
        deadline_at: deadlineIso,
        stake_enabled: editDraft.stake_enabled,
        vote_enabled: editDraft.vote_enabled,
      });
      toast({ title: "Событие обновлено" });
      setEditingPollId(null);
    } catch (error: any) {
      toast({
        title: "Не удалось обновить событие",
        description: error?.message || "Попробуйте еще раз",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (poll: PredictionPoll) => {
    haptic.notification("warning");
    if (!confirm("Удалить событие? Если есть участники/пул, событие будет отменено и скрыто.")) {
      return;
    }

    try {
      const result = await deletePrediction.mutateAsync(poll.id);
      if (result.operation === "deleted") {
        toast({ title: "Событие удалено" });
      } else {
        toast({ title: "Событие отменено и скрыто" });
      }
    } catch (error: any) {
      toast({
        title: "Не удалось удалить событие",
        description: error?.message || "Попробуйте еще раз",
        variant: "destructive",
      });
    }
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
            {item.label} ({getFilterCount(item.id)})
          </button>
        ))}
      </div>

      {error ? (
        <div className="tg-section p-4 text-sm text-destructive">
          Ошибка загрузки событий: {(error as any)?.message || "unknown"}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filteredPredictions.length === 0 ? (
        <div className="tg-section p-6 text-center">
          <p className="text-muted-foreground">Нет событий для этого фильтра</p>
          {predictions.length > 0 && statusFilter !== "all" && (
            <button
              onClick={() => {
                haptic.selection();
                setStatusFilter("all");
              }}
              className="mt-3 text-xs text-primary"
            >
              Показать все ({predictions.length})
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPredictions.map((poll) => {
            const selectedOutcome = outcomes[poll.id] || "A";
            const rejectReason = rejectReasons[poll.id] ?? "";
            const proofUrl = proofUrls[poll.id] ?? poll.proof_url ?? "";
            const isEditing = editingPollId === poll.id;

            return (
              <div key={poll.id} className="tg-section p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground leading-snug line-clamp-2">{poll.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{poll.squad_title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Автор: {getCreatorDisplay(poll.created_by)}
                    </p>
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
                    onClick={() => {
                      haptic.selection();
                      if (isEditing) {
                        cancelEdit();
                      } else {
                        startEdit(poll);
                      }
                    }}
                    disabled={updatePrediction.isPending || deletePrediction.isPending || moderatePrediction.isPending}
                    className="rounded-lg bg-secondary text-foreground px-3 py-2 text-xs inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {isEditing ? "Закрыть" : "Редактировать"}
                  </button>

                  <button
                    onClick={() => void handleDelete(poll)}
                    disabled={deletePrediction.isPending || updatePrediction.isPending || moderatePrediction.isPending}
                    className="rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-xs inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Удалить
                  </button>

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

                {isEditing && (
                  <div className="space-y-3 rounded-xl bg-secondary p-3">
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Заголовок</label>
                      <Input
                        value={editDraft.title}
                        onChange={(e) => setEditDraft((prev) => ({ ...prev, title: e.target.value }))}
                        className="bg-background border-0"
                        placeholder="Заголовок события"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Исход A</label>
                        <Input
                          value={editDraft.option_a_label}
                          onChange={(e) => setEditDraft((prev) => ({ ...prev, option_a_label: e.target.value }))}
                          className="bg-background border-0"
                          placeholder="Вариант A"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Исход B</label>
                        <Input
                          value={editDraft.option_b_label}
                          onChange={(e) => setEditDraft((prev) => ({ ...prev, option_b_label: e.target.value }))}
                          className="bg-background border-0"
                          placeholder="Вариант B"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Обложка (URL)</label>
                      <Input
                        value={editDraft.cover_image_url}
                        onChange={(e) => setEditDraft((prev) => ({ ...prev, cover_image_url: e.target.value }))}
                        className="bg-background border-0"
                        placeholder="https://..."
                      />
                      {editDraft.cover_image_url.trim() && isHttpUrl(editDraft.cover_image_url.trim()) && (
                        <img
                          src={editDraft.cover_image_url.trim()}
                          alt="cover preview"
                          className="w-full rounded-lg object-cover max-h-44"
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Дедлайн</label>
                      <Input
                        type="datetime-local"
                        value={editDraft.deadline_at_local}
                        onChange={(e) => setEditDraft((prev) => ({ ...prev, deadline_at_local: e.target.value }))}
                        className="bg-background border-0"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-background px-3 py-2 flex items-center justify-between">
                        <span className="text-sm text-foreground">Ставка</span>
                        <Switch
                          checked={editDraft.stake_enabled}
                          onCheckedChange={(checked) => setEditDraft((prev) => ({ ...prev, stake_enabled: checked }))}
                        />
                      </div>
                      <div className="rounded-lg bg-background px-3 py-2 flex items-center justify-between">
                        <span className="text-sm text-foreground">Голос</span>
                        <Switch
                          checked={editDraft.vote_enabled}
                          onCheckedChange={(checked) => setEditDraft((prev) => ({ ...prev, vote_enabled: checked }))}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => void saveEdit(poll)}
                        disabled={updatePrediction.isPending}
                        className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 text-xs font-medium disabled:opacity-50"
                      >
                        Сохранить
                      </button>
                      <button
                        onClick={() => cancelEdit()}
                        className="rounded-lg bg-background text-foreground px-3 py-2 text-xs"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

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
