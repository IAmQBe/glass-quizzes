import { useMemo, useState } from "react";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { openInvoiceAsync } from "@/lib/telegram";
import {
  ApiError,
  type AiContentType,
  type AiPersonalityTestVariant,
  type AiQuizVariant,
  type AiQuotaSnapshot,
  useAiCreateInvoice,
  useAiGenerate,
  useAiQuota,
} from "@/hooks/useAiGeneration";

const FREE_LIMIT = 3;

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: "Скопировано" });
  } catch {
    toast({ title: "Не удалось скопировать" });
  }
};

const formatKeywords = (keywords: string[] | undefined | null) => {
  const list = (keywords || []).map((k) => String(k).trim()).filter(Boolean);
  return list.join(", ");
};

const quotaLine = (q: AiQuotaSnapshot | null | undefined) => {
  const quizRemaining = typeof q?.free_quiz_remaining === "number" ? q.free_quiz_remaining : null;
  const testRemaining = typeof q?.free_test_remaining === "number" ? q.free_test_remaining : null;
  const paidRemaining = typeof q?.paid_credits_remaining === "number"
    ? q.paid_credits_remaining
    : (typeof q?.paid_credits === "number" ? q.paid_credits : null);

  const quizText = quizRemaining === null ? "—" : String(Math.max(quizRemaining, 0));
  const testText = testRemaining === null ? "—" : String(Math.max(testRemaining, 0));
  const paidText = paidRemaining === null ? "—" : String(Math.max(paidRemaining, 0));

  return `Бесплатно осталось: квесты ${quizText}/${FREE_LIMIT}, тесты ${testText}/${FREE_LIMIT}, кредиты ${paidText}`;
};

export const AiGenerateDialog = ({
  open,
  onOpenChange,
  contentType,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: AiContentType;
  onApply: (variant: AiQuizVariant | AiPersonalityTestVariant) => void;
}) => {
  const quotaQuery = useAiQuota({ enabled: open });
  const generate = useAiGenerate();
  const createInvoice = useAiCreateInvoice();

  const [prompt, setPrompt] = useState("");
  const [questionCount, setQuestionCount] = useState(contentType === "quiz" ? 10 : 8);
  const [resultsCount, setResultsCount] = useState(4);
  const [variants, setVariants] = useState<Array<AiQuizVariant | AiPersonalityTestVariant>>([]);
  const [localQuota, setLocalQuota] = useState<AiQuotaSnapshot | null>(null);
  const [paywall, setPaywall] = useState<{ price_stars: number } | null>(null);

  const activeQuota = localQuota || quotaQuery.data || null;

  const canGenerate = useMemo(() => {
    return Boolean(prompt.trim()) && !generate.isPending;
  }, [prompt, generate.isPending]);

  const handleGenerate = async () => {
    setPaywall(null);
    setVariants([]);

    try {
      const res = await generate.mutateAsync({
        contentType,
        prompt: prompt.trim(),
        options: contentType === "quiz"
          ? { question_count: questionCount }
          : { question_count: questionCount, results_count: resultsCount },
      });

      setVariants(res.variants as any);
      setLocalQuota(res.quota);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 402) {
        const price = e.payload?.price_stars;
        setLocalQuota(e.payload?.quota || null);
        setPaywall({ price_stars: typeof price === "number" ? price : 100 });
        toast({ title: "Лимит исчерпан", description: "Нужно купить кредит для генерации" });
        return;
      }

      const msg = e?.message || "Не удалось сгенерировать";
      toast({ title: "Ошибка", description: msg });
    }
  };

  const handlePay = async () => {
    try {
      const { invoiceLink } = await createInvoice.mutateAsync();
      const status = await openInvoiceAsync(invoiceLink);

      if (status === "paid") {
        toast({ title: "Оплата успешна", description: "Кредит будет начислен в боте" });
        quotaQuery.refetch();
      } else if (status === "cancelled") {
        toast({ title: "Оплата отменена" });
      } else if (status === "failed") {
        toast({ title: "Оплата не прошла" });
      } else {
        // Unknown/legacy status.
        toast({ title: "Статус оплаты", description: String(status) });
      }
    } catch (e: any) {
      toast({
        title: "Не удалось открыть оплату",
        description: e?.message || "Оплата доступна только внутри Telegram",
      });
    }
  };

  const title = contentType === "quiz" ? "Создать квиз с AI" : "Создать тест с AI";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl p-5 max-h-[85vh] overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Опиши тему, персонажей и стиль. Мы сгенерируем 3 варианта, ты выберешь лучший.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            {quotaLine(activeQuota)}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Промпт</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Например: сделай квиз про Гарри Поттера, 10 вопросов, сложность средняя..."
              className="min-h-[90px]"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {contentType === "quiz" ? (
              <>
                {[5, 8, 10, 12].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant={questionCount === n ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setQuestionCount(n)}
                  >
                    {n} вопросов
                  </Button>
                ))}
              </>
            ) : (
              <>
                {[6, 8, 10].map((n) => (
                  <Button
                    key={`q_${n}`}
                    type="button"
                    variant={questionCount === n ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setQuestionCount(n)}
                  >
                    {n} вопросов
                  </Button>
                ))}
                {[2, 4, 6].map((n) => (
                  <Button
                    key={`r_${n}`}
                    type="button"
                    variant={resultsCount === n ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setResultsCount(n)}
                  >
                    {n} результатов
                  </Button>
                ))}
              </>
            )}
          </div>

          <Button
            type="button"
            className="w-full"
            onClick={handleGenerate}
            disabled={!canGenerate}
          >
            {generate.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Генерация...
              </>
            ) : (
              "Сгенерировать 3 варианта"
            )}
          </Button>

          {paywall ? (
            <div className="p-3 rounded-xl border border-border bg-card space-y-2">
              <p className="text-sm text-foreground">
                Бесплатный лимит исчерпан. Купи 1 кредит, чтобы продолжить.
              </p>
              <Button
                type="button"
                className="w-full"
                onClick={handlePay}
                disabled={createInvoice.isPending}
              >
                {createInvoice.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Открываем оплату...
                  </>
                ) : (
                  `Оплатить ${paywall.price_stars} Stars`
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Оплата доступна только внутри Telegram Mini App.
              </p>
            </div>
          ) : null}

          {variants.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Варианты</h3>

              <div className="space-y-2">
                {variants.map((v, idx) => {
                  const isQuiz = contentType === "quiz";
                  const qCount = isQuiz ? (v as AiQuizVariant).questions?.length : (v as AiPersonalityTestVariant).questions?.length;
                  const rCount = isQuiz ? null : (v as AiPersonalityTestVariant).results?.length;
                  const keywords = formatKeywords((v as any).cover_image_keywords);

                  return (
                    <div key={idx} className="p-3 rounded-xl border border-border bg-card space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground line-clamp-1">
                            {(v as any).title}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {(v as any).description}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            onApply(v);
                            onOpenChange(false);
                          }}
                        >
                          Использовать
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{qCount} вопросов</span>
                        {typeof rCount === "number" ? <span>{rCount} результатов</span> : null}
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground">Подсказка для обложки</p>
                          <p className="text-xs text-muted-foreground break-words">{keywords || "—"}</p>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          onClick={() => copyToClipboard(keywords || "")}
                          disabled={!keywords}
                          title="Скопировать"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
