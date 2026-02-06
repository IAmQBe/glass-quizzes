import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Info, Link2, Share2, ShieldCheck, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { PopcornIcon } from "@/components/icons/PopcornIcon";
import { toast } from "@/hooks/use-toast";
import { useModeratePredictionPoll, useReportPredictionPoll } from "@/hooks/usePredictions";
import { getTelegram, haptic } from "@/lib/telegram";
import {
  PredictionMode,
  PredictionOption,
  PredictionPoll,
  getPredictionPoolTotal,
  predictionStatusLabel,
} from "@/types/prediction";

type DetailsTab = "participation" | "admin";

interface UserParticipation {
  mode: PredictionMode;
  option: PredictionOption;
  stake: number;
}

interface PredictionDetailsScreenProps {
  prediction: PredictionPoll;
  canManage: boolean;
  hasPredictionAccess: boolean;
  onBack: () => void;
  onPredictionChange: (nextPrediction: PredictionPoll) => void;
}

const BOT_USERNAME = "QuipoBot";
const QUICK_STAKES = [10, 50, 100, 250, 500];
const FEE_TOTAL = 0.07;
const REFUND_RATE = 0.15;
const STAKE_CAP_PER_PREDICTION = 500;
const REPUTATION_REWARD = 12;

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

const isHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const getDistribution = (prediction: PredictionPoll) => {
  const total = getPredictionPoolTotal(prediction);
  if (total <= 0) return { a: 0, b: 0 };
  return {
    a: prediction.pool_a / total,
    b: prediction.pool_b / total,
  };
};

export const PredictionDetailsScreen = ({
  prediction,
  canManage,
  hasPredictionAccess,
  onBack,
  onPredictionChange,
}: PredictionDetailsScreenProps) => {
  const [activeTab, setActiveTab] = useState<DetailsTab>("participation");
  const modeAvailability = useMemo(
    () => ({
      stake: prediction.stake_enabled !== false,
      vote: prediction.vote_enabled !== false,
    }),
    [prediction.stake_enabled, prediction.vote_enabled]
  );
  const [mode, setMode] = useState<PredictionMode>(modeAvailability.stake ? "stake" : "vote");
  const [selectedOption, setSelectedOption] = useState<PredictionOption>("A");
  const [stake, setStake] = useState(50);
  const [balance, setBalance] = useState(1250);
  const [reputation, setReputation] = useState(148);
  const [participation, setParticipation] = useState<UserParticipation | null>(null);
  const [adminOutcome, setAdminOutcome] = useState<PredictionOption>("A");
  const [adminProofUrl, setAdminProofUrl] = useState(prediction.proof_url || "");
  const [adminRejectReason, setAdminRejectReason] = useState(prediction.rejection_reason || "");
  const moderatePrediction = useModeratePredictionPoll();
  const reportPrediction = useReportPredictionPoll();

  useEffect(() => {
    if (mode === "stake" && !modeAvailability.stake && modeAvailability.vote) {
      setMode("vote");
    }
    if (mode === "vote" && !modeAvailability.vote && modeAvailability.stake) {
      setMode("stake");
    }
  }, [mode, modeAvailability]);

  const poolTotal = getPredictionPoolTotal(prediction);
  const distribution = getDistribution(prediction);
  const selectedPool = selectedOption === "A" ? prediction.pool_a : prediction.pool_b;

  const expectedStakePreview = useMemo(() => {
    if (stake <= 0 || selectedPool <= 0) {
      return { win: 0, loseRefund: 0 };
    }

    const effectivePool = poolTotal * (1 - REFUND_RATE);
    const payout = stake * ((effectivePool * (1 - FEE_TOTAL)) / selectedPool);
    const refund = stake * REFUND_RATE;

    return {
      win: payout + refund,
      loseRefund: refund,
    };
  }, [poolTotal, selectedPool, stake]);

  const patchPrediction = (patch: Partial<PredictionPoll>) => {
    onPredictionChange({
      ...prediction,
      ...patch,
      updated_at: new Date().toISOString(),
    });
  };

  const deepLink = `https://t.me/${BOT_USERNAME}/app?startapp=poll=${encodeURIComponent(prediction.id)}`;

  const handleShare = () => {
    haptic.selection();
    const tg = getTelegram();
    if (tg?.switchInlineQuery) {
      tg.switchInlineQuery(`poll:${prediction.id}`, ["users", "groups", "channels"]);
      return;
    }
    navigator.clipboard.writeText(`poll:${prediction.id}`);
    toast({ title: "Скопировано", description: "Inline query скопирован в буфер." });
  };

  const handleCopyLink = async () => {
    haptic.selection();
    await navigator.clipboard.writeText(deepLink);
    toast({ title: "Ссылка скопирована" });
  };

  const handleStake = () => {
    haptic.impact("medium");

    if (!modeAvailability.stake) {
      toast({
        title: "Режим недоступен",
        description: "В этом прогнозе отключены ставки.",
      });
      return;
    }

    if (!hasPredictionAccess) {
      toast({
        title: "Доступ ограничен",
        description: "Нужно пройти минимум 1 квиз для участия в ставках.",
      });
      return;
    }

    if (prediction.status !== "open") {
      toast({
        title: "Ставки закрыты",
        description: "Этот прогноз уже не принимает новые ставки.",
      });
      return;
    }

    if (participation) {
      toast({
        title: "Ты уже участвуешь",
        description: "В одном прогнозе можно выбрать только один формат участия.",
      });
      return;
    }

    if (stake <= 0) {
      toast({ title: "Укажи сумму", description: "Ставка должна быть больше 0." });
      return;
    }

    if (stake > STAKE_CAP_PER_PREDICTION) {
      toast({
        title: "Превышен лимит",
        description: `Максимум ${STAKE_CAP_PER_PREDICTION} 🍿 на один прогноз.`,
      });
      return;
    }

    if (stake > balance) {
      toast({
        title: "Недостаточно попкорнов",
        description: "Пополни баланс или выбери меньшую сумму.",
      });
      return;
    }

    setBalance((prev) => prev - stake);
    setParticipation({
      mode: "stake",
      option: selectedOption,
      stake,
    });

    patchPrediction({
      pool_a: selectedOption === "A" ? prediction.pool_a + stake : prediction.pool_a,
      pool_b: selectedOption === "B" ? prediction.pool_b + stake : prediction.pool_b,
      participant_count: prediction.participant_count + 1,
    });

    toast({
      title: "Ставка принята",
      description: `${formatPopcorn(stake)} заморожены до расчета.`,
    });
  };

  const handleVote = () => {
    haptic.selection();

    if (!modeAvailability.vote) {
      toast({
        title: "Режим недоступен",
        description: "В этом прогнозе отключены голоса за репутацию.",
      });
      return;
    }

    if (!hasPredictionAccess) {
      toast({
        title: "Доступ ограничен",
        description: "Нужно пройти минимум 1 квиз для участия.",
      });
      return;
    }

    if (prediction.status !== "open") {
      toast({
        title: "Голосование закрыто",
        description: "Прогноз уже закрыт для новых участников.",
      });
      return;
    }

    if (participation) {
      toast({
        title: "Ты уже участвуешь",
        description: "Нельзя одновременно ставить и голосовать отдельно.",
      });
      return;
    }

    setParticipation({
      mode: "vote",
      option: selectedOption,
      stake: 0,
    });
    patchPrediction({ participant_count: prediction.participant_count + 1 });
    toast({
      title: "Голос принят",
      description: `При победе исхода получишь +${REPUTATION_REWARD} репутации.`,
    });
  };

  const runModerationAction = async (
    action: Parameters<typeof moderatePrediction.mutateAsync>[0]["action"],
    extras?: Partial<Parameters<typeof moderatePrediction.mutateAsync>[0]>,
    successTitle = "Обновлено",
    successDescription?: string
  ) => {
    try {
      const result = await moderatePrediction.mutateAsync({
        poll_id: prediction.id,
        action,
        ...extras,
      });
      patchPrediction(result.updated_poll_patch);
      toast({ title: successTitle, description: successDescription });
    } catch (error: any) {
      toast({
        title: "Ошибка модерации",
        description: error?.message || "Не удалось выполнить действие",
        variant: "destructive",
      });
    }
  };

  const handleCloseStakes = () => {
    if (prediction.status !== "open") return;
    void runModerationAction("close_stakes", undefined, "Ставки закрыты");
  };

  const handleApprove = () => {
    if (!["pending", "rejected"].includes(prediction.status)) return;
    void runModerationAction("approve", undefined, "Прогноз опубликован");
  };

  const handleReject = () => {
    const reason = adminRejectReason.trim();
    if (!reason) {
      toast({
        title: "Причина обязательна",
        description: "Для отклонения укажи причину.",
        variant: "destructive",
      });
      return;
    }
    void runModerationAction(
      "reject",
      { rejection_reason: reason },
      "Прогноз отклонен",
      "Автор увидит причину отклонения."
    );
  };

  const handleSetUnderReview = () => {
    if (!["open", "locked", "pending_resolution"].includes(prediction.status)) return;
    void runModerationAction("set_under_review", undefined, "Отправлено на проверку");
  };

  const handleSetPendingResolution = () => {
    if (!["locked", "under_review"].includes(prediction.status)) return;
    void runModerationAction("set_pending_resolution", undefined, "Ожидает резолва");
  };

  const handleResolve = () => {
    if (!["locked", "pending_resolution", "under_review"].includes(prediction.status)) {
      toast({
        title: "Сейчас резолв недоступен",
        description: "Сначала переведи прогноз в locked/pending_resolution.",
      });
      return;
    }

    if (!isHttpUrl(adminProofUrl)) {
      toast({
        title: "Нужна ссылка-доказательство",
        description: "Заполни валидный proof URL перед резолвом.",
      });
      return;
    }

    void runModerationAction(
      "resolve",
      {
        resolved_option: adminOutcome,
        proof_url: adminProofUrl.trim(),
      },
      "Результат подтвержден"
    );
  };

  const handleCancel = () => {
    const shouldCancel = window.confirm("Отменить прогноз?");
    if (!shouldCancel) return;

    void runModerationAction("cancel", undefined, "Прогноз отменен");
  };

  const handleToggleHidden = () => {
    void runModerationAction(
      "toggle_hidden",
      undefined,
      prediction.is_hidden ? "Прогноз снова виден" : "Прогноз скрыт"
    );
  };

  const handleReport = async () => {
    try {
      const result = await reportPrediction.mutateAsync({ pollId: prediction.id });
      patchPrediction(result.updated_poll_patch);
      toast({
        title: "Репорт отправлен",
        description: result.transitioned_to_under_review
          ? "Прогноз автоматически отправлен на проверку."
          : "Спасибо, жалоба зафиксирована.",
      });
    } catch (error: any) {
      const code = error?.code;
      if (code === "already_reported") {
        toast({ title: "Уже отправлено", description: "Ты уже жаловался на этот прогноз." });
        return;
      }
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось отправить репорт",
        variant: "destructive",
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
            className="p-2 -ml-2 text-primary"
            onClick={() => {
              haptic.selection();
              onBack();
            }}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Прогноз</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4 space-y-3">
        {canManage && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveTab("participation")}
              className={`rounded-xl py-2 text-sm font-medium ${
                activeTab === "participation"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground"
              }`}
            >
              Участие
            </button>
            <button
              onClick={() => setActiveTab("admin")}
              className={`rounded-xl py-2 text-sm font-medium ${
                activeTab === "admin" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
              }`}
            >
              Admin
            </button>
          </div>
        )}

        <div className="tg-section overflow-hidden">
          <img src={prediction.cover_image_url} alt={prediction.title} className="w-full h-44 object-cover" />
          <div className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground leading-snug">{prediction.title}</h2>
              <span className="text-[10px] px-2 py-1 rounded-full bg-secondary text-muted-foreground shrink-0">
                {predictionStatusLabel[prediction.status]}
              </span>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>Ставки до: {formatTimeLeft(prediction.deadline_at)}</p>
              <p>
                Пул: {formatPopcorn(poolTotal)} · Участников: {prediction.participant_count}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleShare}
                className="rounded-lg bg-secondary text-foreground text-sm py-2 inline-flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Поделиться
              </button>
              <button
                onClick={handleCopyLink}
                className="rounded-lg bg-secondary text-foreground text-sm py-2 inline-flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Скопировать ссылку
              </button>
            </div>
            <button
              onClick={() => void handleReport()}
              disabled={reportPrediction.isPending}
              className="w-full rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm py-2 inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Info className="w-4 h-4" />
              Пожаловаться
            </button>
            {prediction.rejection_reason && (
              <div className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                Причина отклонения: {prediction.rejection_reason}
              </div>
            )}
            {(prediction.moderated_at || prediction.submitted_at) && (
              <div className="text-[11px] text-muted-foreground space-y-0.5">
                {prediction.submitted_at && <p>Отправлен: {new Date(prediction.submitted_at).toLocaleString("ru-RU")}</p>}
                {prediction.moderated_at && <p>Промодерирован: {new Date(prediction.moderated_at).toLocaleString("ru-RU")}</p>}
              </div>
            )}
            <div className="pt-1">
              <Sheet>
                <SheetTrigger asChild>
                  <button className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" /> Игровые попкорны, без вывода
                  </button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Правила прогнозов</SheetTitle>
                    <SheetDescription>Коротко о механике, лимитах и модерации.</SheetDescription>
                  </SheetHeader>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="rounded-xl bg-secondary p-3">
                      <p className="font-medium text-foreground">Экономика</p>
                      <p className="text-muted-foreground mt-1">
                        Победители делят общий пул пропорционально ставкам. Для всех участников сохраняется
                        частичный возврат {Math.round(REFUND_RATE * 100)}% ставки.
                      </p>
                    </div>
                    <div className="rounded-xl bg-secondary p-3">
                      <p className="font-medium text-foreground">Лимиты и анти-абуз</p>
                      <p className="text-muted-foreground mt-1">
                        Лимит ставки на один прогноз: {STAKE_CAP_PER_PREDICTION} 🍿. Для участия нужен прогрев
                        аккаунта (минимум 1 квиз или другой валидный сигнал).
                      </p>
                    </div>
                    <div className="rounded-xl bg-secondary p-3">
                      <p className="font-medium text-foreground">Модерация</p>
                      <p className="text-muted-foreground mt-1">
                        Прогнозы с большим числом репортов отправляются на проверку. Резолв возможен только с
                        proof URL.
                      </p>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>

        {activeTab === "participation" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border px-3 py-2 text-xs inline-flex items-center gap-2">
              <ShieldCheck className={`w-3.5 h-3.5 ${hasPredictionAccess ? "text-green-500" : "text-amber-500"}`} />
              <span className="text-muted-foreground">
                {hasPredictionAccess ? "Доступ разрешен" : "Нужно пройти 1 квиз"}
              </span>
            </div>

            {modeAvailability.stake && modeAvailability.vote ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode("stake")}
                  className={`rounded-xl py-2.5 text-sm font-medium ${
                    mode === "stake" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                  }`}
                >
                  Ставка
                </button>
                <button
                  onClick={() => setMode("vote")}
                  className={`rounded-xl py-2.5 text-sm font-medium ${
                    mode === "vote" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                  }`}
                >
                  Голос (репутация)
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground">
                Режим участия: {modeAvailability.stake ? "Ставка" : "Голос (репутация)"}
              </div>
            )}

            <div className="space-y-2">
              {(
                [
                  { option: "A", label: prediction.option_a_label, ratio: distribution.a, amount: prediction.pool_a },
                  { option: "B", label: prediction.option_b_label, ratio: distribution.b, amount: prediction.pool_b },
                ] as const
              ).map((item) => (
                <button
                  key={item.option}
                  onClick={() => setSelectedOption(item.option)}
                  className={`w-full rounded-xl border p-3 text-left ${
                    selectedOption === item.option
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    {selectedOption === item.option && (
                      <span className="text-xs text-muted-foreground">
                        {formatPopcorn(item.amount)} ({Math.round(item.ratio * 100)}%)
                      </span>
                    )}
                  </div>
                  {selectedOption === item.option && (
                    <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${Math.max(8, item.ratio * 100)}%` }} />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {mode === "stake" ? (
              <div className="space-y-2">
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {QUICK_STAKES.map((value) => (
                    <button
                      key={value}
                      onClick={() => setStake(value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                        stake === value
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {value} 🍿
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  min={0}
                  max={STAKE_CAP_PER_PREDICTION}
                  value={stake}
                  onChange={(e) => setStake(Math.max(0, Number(e.target.value) || 0))}
                  className="bg-secondary border-0"
                />
                <button onClick={handleStake} className="tg-button">
                  Поставить 🍿
                </button>

                <div className="rounded-xl border border-border p-3 text-xs space-y-1">
                  <p className="text-foreground font-medium">
                    Если победит твой исход: получишь примерно ~{formatPopcorn(expectedStakePreview.win)}
                  </p>
                  <p className="text-muted-foreground">
                    Если проиграешь: вернем {Math.round(REFUND_RATE * 100)}% ставки (
                    {formatPopcorn(expectedStakePreview.loseRefund)}).
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button onClick={handleVote} className="tg-button">
                  Проголосовать
                </button>
                <p className="text-xs text-muted-foreground">
                  За победу выбранного исхода: +{REPUTATION_REWARD} репутации.
                </p>
              </div>
            )}

            <div className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1">
                <PopcornIcon className="w-3.5 h-3.5 text-orange-500" />
                Баланс: <span className="text-foreground font-medium">{formatPopcorn(balance)}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                Репутация: <span className="text-foreground font-medium">{reputation}</span>
              </span>
            </div>

            {participation && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-xs">
                <p className="text-foreground font-medium">
                  Участие зафиксировано: {participation.mode === "stake" ? "ставка" : "голос"} на вариант{" "}
                  {participation.option}
                </p>
                {participation.mode === "stake" && (
                  <p className="text-muted-foreground mt-1">
                    Заморожено: {formatPopcorn(participation.stake)} до расчета.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {canManage && activeTab === "admin" && (
          <div className="tg-section p-4 space-y-3">
            <h3 className="font-semibold text-foreground">Управление прогнозом</h3>

            <div className="text-xs text-muted-foreground">
              Статус: <span className="text-foreground">{predictionStatusLabel[prediction.status]}</span>
            </div>

            {["pending", "rejected"].includes(prediction.status) && (
              <div className="space-y-2">
                <button
                  onClick={handleApprove}
                  disabled={moderatePrediction.isPending}
                  className="w-full rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Approve (Publish)
                </button>

                {prediction.status === "pending" && (
                  <>
                    <Input
                      value={adminRejectReason}
                      onChange={(e) => setAdminRejectReason(e.target.value)}
                      placeholder="Причина отклонения"
                      className="bg-secondary border-0"
                    />
                    <button
                      onClick={handleReject}
                      disabled={moderatePrediction.isPending}
                      className="w-full rounded-lg bg-destructive text-destructive-foreground py-2 text-sm font-medium disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            )}

            <button
              onClick={handleCloseStakes}
              disabled={prediction.status !== "open" || moderatePrediction.isPending}
              className="w-full rounded-lg bg-secondary text-foreground py-2 text-sm disabled:opacity-50"
            >
              Закрыть ставки
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleSetUnderReview}
                disabled={!["open", "locked", "pending_resolution"].includes(prediction.status) || moderatePrediction.isPending}
                className="rounded-lg px-3 py-2 text-sm bg-amber-500/10 text-amber-600 dark:text-amber-400 disabled:opacity-50"
              >
                Under review
              </button>
              <button
                onClick={handleSetPendingResolution}
                disabled={!["locked", "under_review"].includes(prediction.status) || moderatePrediction.isPending}
                className="rounded-lg px-3 py-2 text-sm bg-secondary text-foreground disabled:opacity-50"
              >
                Pending resolution
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAdminOutcome("A")}
                className={`rounded-lg px-3 py-2 text-sm ${
                  adminOutcome === "A" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                }`}
              >
                Исход A
              </button>
              <button
                onClick={() => setAdminOutcome("B")}
                className={`rounded-lg px-3 py-2 text-sm ${
                  adminOutcome === "B" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                }`}
              >
                Исход B
              </button>
            </div>

            <Input
              value={adminProofUrl}
              onChange={(e) => setAdminProofUrl(e.target.value)}
              placeholder="Ссылка-доказательство (proof_url)"
              className="bg-secondary border-0"
            />

            <button
              onClick={handleResolve}
              disabled={!["locked", "pending_resolution", "under_review"].includes(prediction.status) || moderatePrediction.isPending}
              className="w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium disabled:opacity-50"
            >
              Resolve
            </button>

            <button
              onClick={handleCancel}
              disabled={!["pending", "open", "locked", "pending_resolution", "under_review"].includes(prediction.status) || moderatePrediction.isPending}
              className="w-full rounded-lg bg-destructive text-destructive-foreground py-2 text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>

            <div className="rounded-lg bg-secondary p-3 text-xs space-y-2">
              <p className="text-muted-foreground">Reports count: {prediction.report_count}</p>
              {prediction.rejection_reason && (
                <p className="text-destructive">Reject reason: {prediction.rejection_reason}</p>
              )}
              <button
                onClick={handleToggleHidden}
                disabled={moderatePrediction.isPending}
                className="text-primary font-medium inline-flex items-center gap-1 disabled:opacity-50"
              >
                <Link2 className="w-3.5 h-3.5" />
                {prediction.is_hidden ? "Unhide" : "Hide"}
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
