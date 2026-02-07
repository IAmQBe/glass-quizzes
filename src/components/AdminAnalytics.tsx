import { type ElementType, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  GitBranch,
  Loader2,
  Share2,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  type AdminFunnelStage,
  type DateRange,
  buildDateRangeFromPreset,
  useAdminEventHealth,
  useAdminOverview,
  useAdminPredictions,
  useAdminQuizFunnel,
  useAdminScreenTransitions,
  useAdminSources,
  useAdminTasks,
  useAdminTestsFunnel,
  useAdminTimeseries,
  useAdminTopQuizzes,
  useAdminTopTests,
} from "@/hooks/useAnalytics";

type AdminSubTab = "overview" | "content" | "acquisition" | "operations";

const PRESET_OPTIONS: Array<{ preset: "7d" | "30d" | "90d"; label: string }> = [
  { preset: "7d", label: "7 дн" },
  { preset: "30d", label: "30 дн" },
  { preset: "90d", label: "90 дн" },
];

const activityChartConfig = {
  dau: {
    label: "DAU",
    color: "hsl(var(--primary))",
  },
  quiz_completes: {
    label: "Quiz completes",
    color: "#16a34a",
  },
  test_completes: {
    label: "Test completes",
    color: "#f97316",
  },
} as const;

const contentChartConfig = {
  completes: {
    label: "Completions",
    color: "hsl(var(--primary))",
  },
  shares: {
    label: "Shares",
    color: "#0ea5e9",
  },
} as const;

const formatNumber = (value: number) => value.toLocaleString("ru-RU");

const formatPercent = (value: number, digits = 1) => `${value.toFixed(digits)}%`;

const formatSeconds = (value: number) => {
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded) || rounded <= 0) return "-";
  return `${rounded}s`;
};

const formatDateLabel = (value: string) => {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
};

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toFunnelMap = (rows: AdminFunnelStage[]) => {
  return rows.reduce<Record<string, AdminFunnelStage>>((acc, row) => {
    acc[row.stage] = row;
    return acc;
  }, {});
};

const TabError = ({ message }: { message: string }) => (
  <div className="tg-section p-4 text-sm text-red-500 flex items-center gap-2">
    <AlertTriangle className="w-4 h-4" />
    {message}
  </div>
);

const TabEmpty = ({ message }: { message: string }) => (
  <div className="tg-section p-6 text-center text-sm text-muted-foreground">{message}</div>
);

const TabLoading = () => (
  <div className="flex justify-center py-12">
    <Loader2 className="w-8 h-8 text-primary animate-spin" />
  </div>
);

const StatCard = ({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: ElementType;
  label: string;
  value: string;
  hint?: string;
}) => (
  <div className="tg-section p-4">
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </div>
    </div>
  </div>
);

export const AdminAnalytics = () => {
  const [activeTab, setActiveTab] = useState<AdminSubTab>("overview");
  const [range, setRange] = useState<DateRange>(() => buildDateRangeFromPreset("30d"));
  const [customFrom, setCustomFrom] = useState(range.from);
  const [customTo, setCustomTo] = useState(range.to);

  const overviewQuery = useAdminOverview(range, true);
  const timeseriesQuery = useAdminTimeseries(range, activeTab === "overview");
  const quizFunnelQuery = useAdminQuizFunnel(range, activeTab === "overview");
  const testsFunnelQuery = useAdminTestsFunnel(range, activeTab === "overview");

  const topQuizzesQuery = useAdminTopQuizzes(range, 8, activeTab === "content" || activeTab === "overview");
  const topTestsQuery = useAdminTopTests(range, 8, activeTab === "content" || activeTab === "overview");

  const sourcesQuery = useAdminSources(range, activeTab === "acquisition");
  const transitionsQuery = useAdminScreenTransitions(range, 12, activeTab === "acquisition");

  const predictionsQuery = useAdminPredictions(range, activeTab === "operations");
  const tasksQuery = useAdminTasks(range, 12, activeTab === "operations");
  const eventHealthQuery = useAdminEventHealth(range, activeTab === "operations");

  const overview = overviewQuery.data;
  const totalCompletes = (overview?.quiz_completes || 0) + (overview?.test_completes || 0);
  const totalShares = (overview?.quiz_shares || 0) + (overview?.test_shares || 0);

  const quizFunnelMap = useMemo(() => toFunnelMap(quizFunnelQuery.data || []), [quizFunnelQuery.data]);
  const testsFunnelMap = useMemo(() => toFunnelMap(testsFunnelQuery.data || []), [testsFunnelQuery.data]);

  const handlePreset = (preset: "7d" | "30d" | "90d") => {
    const next = buildDateRangeFromPreset(preset);
    setRange(next);
    setCustomFrom(next.from);
    setCustomTo(next.to);
  };

  const applyCustomRange = () => {
    if (!customFrom || !customTo) return;
    if (customFrom <= customTo) {
      setRange({ from: customFrom, to: customTo, preset: "custom" });
      return;
    }
    setRange({ from: customTo, to: customFrom, preset: "custom" });
  };

  const topQuizzesChartData = (topQuizzesQuery.data || []).slice(0, 5).map((row) => ({
    name: row.title.length > 18 ? `${row.title.slice(0, 18)}…` : row.title,
    completes: row.completes,
    shares: row.shares,
  }));

  return (
    <div className="space-y-4">
      <div className="tg-section p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-foreground">Analytics+</h3>
          <div className="text-xs text-muted-foreground">
            {range.from} - {range.to}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESET_OPTIONS.map((option) => (
            <button
              key={option.preset}
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                range.preset === option.preset
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-foreground border-border"
              }`}
              onClick={() => handlePreset(option.preset)}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
              range.preset === "custom"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary text-foreground border-border"
            }`}
            onClick={applyCustomRange}
          >
            Custom
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            value={customFrom}
            onChange={(event) => setCustomFrom(event.target.value)}
            className="h-9 text-xs"
          />
          <Input
            type="date"
            value={customTo}
            onChange={(event) => setCustomTo(event.target.value)}
            className="h-9 text-xs"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AdminSubTab)}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="content" className="text-xs">Content</TabsTrigger>
          <TabsTrigger value="acquisition" className="text-xs">Acquisition</TabsTrigger>
          <TabsTrigger value="operations" className="text-xs">Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {!overview && overviewQuery.isLoading ? (
            <TabLoading />
          ) : overviewQuery.error || quizFunnelQuery.error || testsFunnelQuery.error ? (
            <TabError message="Не удалось загрузить overview данные" />
          ) : !overview ? (
            <TabEmpty message="Нет данных для выбранного периода" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={Users}
                  label="Пользователей"
                  value={formatNumber(overview.total_users)}
                  hint={`Новых: ${formatNumber(overview.new_users)}`}
                />
                <StatCard icon={BarChart3} label="Квизы (опубл.)" value={formatNumber(overview.published_quizzes)} />
                <StatCard icon={Sparkles} label="Тесты (опубл.)" value={formatNumber(overview.published_tests)} />
                <StatCard
                  icon={CheckCircle2}
                  label="Прохождений"
                  value={formatNumber(totalCompletes)}
                  hint={`Квизы: ${formatNumber(overview.quiz_completes)} · Тесты: ${formatNumber(overview.test_completes)}`}
                />
                <StatCard
                  icon={Share2}
                  label="Шеров"
                  value={formatNumber(totalShares)}
                  hint={`Квизы: ${formatNumber(overview.quiz_shares)} · Тесты: ${formatNumber(overview.test_shares)}`}
                />
                <StatCard icon={GitBranch} label="Рефералы" value={formatNumber(overview.referrals)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={Activity} label="DAU" value={formatNumber(overview.dau)} />
                <StatCard icon={Users} label="WAU" value={formatNumber(overview.wau)} />
                <StatCard icon={BarChart3} label="MAU" value={formatNumber(overview.mau)} />
                <StatCard
                  icon={Target}
                  label="Stickiness"
                  value={formatPercent(overview.stickiness_pct)}
                  hint="DAU / MAU"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={Clock3}
                  label="Среднее время квиза"
                  value={formatSeconds(overview.avg_quiz_time_seconds)}
                  hint={overview.avg_quiz_score_pct > 0 ? `Avg score: ${formatPercent(overview.avg_quiz_score_pct)}` : undefined}
                />
                <StatCard
                  icon={Clock3}
                  label="Среднее время теста"
                  value={formatSeconds(overview.avg_test_time_seconds)}
                />
                <StatCard icon={ShieldAlert} label="Reports" value={formatNumber(overview.prediction_reports)} />
                <StatCard icon={Zap} label="Task completions" value={formatNumber(overview.task_completions)} />
              </div>

              {timeseriesQuery.isLoading ? (
                <TabLoading />
              ) : timeseriesQuery.error ? (
                <TabError message="Не удалось загрузить таймсерию" />
              ) : (timeseriesQuery.data || []).length === 0 ? (
                <TabEmpty message="Нет событий для графика активности" />
              ) : (
                <div className="tg-section p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-medium text-foreground">Ежедневная активность</h4>
                  </div>
                  <ChartContainer config={activityChartConfig} className="h-[260px] w-full aspect-auto">
                    <LineChart data={timeseriesQuery.data} margin={{ left: 0, right: 12, top: 8 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="metric_date"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatDateLabel}
                        minTickGap={20}
                      />
                      <YAxis tickLine={false} axisLine={false} width={32} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="dau" stroke="var(--color-dau)" strokeWidth={2} dot={false} />
                      <Line
                        type="monotone"
                        dataKey="quiz_completes"
                        stroke="var(--color-quiz_completes)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="test_completes"
                        stroke="var(--color-test_completes)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ChartContainer>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="tg-section p-4 space-y-3">
                  <h4 className="text-sm font-medium text-foreground">Quiz funnel</h4>
                  {(["viewed", "started", "completed", "shared"] as const).map((stage) => {
                    const item = quizFunnelMap[stage];
                    const percentage = item ? item.conversion_from_first : 0;
                    return (
                      <div key={`quiz-${stage}`}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="capitalize">{stage}</span>
                          <span className="text-muted-foreground">
                            {formatNumber(item?.users || 0)} ({formatPercent(percentage)})
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="tg-section p-4 space-y-3">
                  <h4 className="text-sm font-medium text-foreground">Tests funnel</h4>
                  {(["viewed", "started", "completed", "shared"] as const).map((stage) => {
                    const item = testsFunnelMap[stage];
                    const percentage = item ? item.conversion_from_first : 0;
                    return (
                      <div key={`test-${stage}`}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="capitalize">{stage}</span>
                          <span className="text-muted-foreground">
                            {formatNumber(item?.users || 0)} ({formatPercent(percentage)})
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500" style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(topQuizzesQuery.data || []).length > 0 ? (
                  <div className="tg-section p-4">
                    <h4 className="text-sm font-medium text-foreground mb-3">Топ квизы (по прохождениям)</h4>
                    <div className="space-y-2">
                      {(topQuizzesQuery.data || []).slice(0, 5).map((quiz, index) => (
                        <div key={quiz.quiz_id || `${quiz.title}-${index}`} className="p-3 bg-secondary rounded-lg">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{index + 1}. {quiz.title}</p>
                            <span className="text-xs text-muted-foreground">{formatNumber(quiz.completes)}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                            <span>Starts: {formatNumber(quiz.starts)}</span>
                            <span>Shares: {formatNumber(quiz.shares)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <TabEmpty message="Пока нет данных по квизам" />
                )}

                {(topTestsQuery.data || []).length > 0 ? (
                  <div className="tg-section p-4">
                    <h4 className="text-sm font-medium text-foreground mb-3">Топ тесты (по прохождениям)</h4>
                    <div className="space-y-2">
                      {(topTestsQuery.data || []).slice(0, 5).map((test, index) => (
                        <div key={test.test_id || `${test.title}-${index}`} className="p-3 bg-secondary rounded-lg">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{index + 1}. {test.title}</p>
                            <span className="text-xs text-muted-foreground">{formatNumber(test.completes)}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                            <span>Starts: {formatNumber(test.starts)}</span>
                            <span>Shares: {formatNumber(test.shares)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <TabEmpty message="Пока нет данных по тестам" />
                )}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          {topQuizzesQuery.isLoading || topTestsQuery.isLoading ? (
            <TabLoading />
          ) : topQuizzesQuery.error || topTestsQuery.error ? (
            <TabError message="Не удалось загрузить контент-метрики" />
          ) : (
            <>
              {(topQuizzesQuery.data || []).length > 0 ? (
                <div className="tg-section p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-medium text-foreground">Top quizzes</h4>
                  </div>
                  <div className="space-y-2">
                    {(topQuizzesQuery.data || []).map((quiz, index) => (
                      <div key={quiz.quiz_id || `${quiz.title}-${index}`} className="p-3 bg-secondary rounded-lg">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{index + 1}. {quiz.title}</p>
                          <span className="text-xs text-muted-foreground">{formatNumber(quiz.completes)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                          <span>Starts: {formatNumber(quiz.starts)}</span>
                          <span>Shares: {formatNumber(quiz.shares)}</span>
                          <span>Completion: {formatPercent(quiz.completion_rate)}</span>
                          <span>Engagement: {formatPercent(quiz.share_rate)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <TabEmpty message="Нет данных по квизам" />
              )}

              {topQuizzesChartData.length > 0 && (
                <div className="tg-section p-4">
                  <h4 className="text-sm font-medium text-foreground mb-3">Quiz completions vs shares</h4>
                  <ChartContainer config={contentChartConfig} className="h-[250px] w-full aspect-auto">
                    <BarChart data={topQuizzesChartData} margin={{ left: 0, right: 12, top: 8 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} height={54} angle={-20} textAnchor="end" />
                      <YAxis tickLine={false} axisLine={false} width={32} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="completes" fill="var(--color-completes)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="shares" fill="var(--color-shares)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </div>
              )}

              {(topTestsQuery.data || []).length > 0 ? (
                <div className="tg-section p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-medium text-foreground">Top personality tests</h4>
                  </div>
                  <div className="space-y-2">
                    {(topTestsQuery.data || []).map((test, index) => (
                      <div key={test.test_id || `${test.title}-${index}`} className="p-3 bg-secondary rounded-lg">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{index + 1}. {test.title}</p>
                          <span className="text-xs text-muted-foreground">{formatNumber(test.completes)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                          <span>Starts: {formatNumber(test.starts)}</span>
                          <span>Shares: {formatNumber(test.shares)}</span>
                          <span>Completion: {formatPercent(test.completion_rate)}</span>
                          <span>Engagement: {formatPercent(test.share_rate)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <TabEmpty message="Нет данных по тестам" />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="acquisition" className="space-y-4">
          {sourcesQuery.isLoading || transitionsQuery.isLoading || overviewQuery.isLoading ? (
            <TabLoading />
          ) : sourcesQuery.error || transitionsQuery.error || overviewQuery.error ? (
            <TabError message="Не удалось загрузить acquisition метрики" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={Users} label="Новые пользователи" value={formatNumber(overview?.new_users || 0)} />
                <StatCard icon={GitBranch} label="Рефералы" value={formatNumber(overview?.referrals || 0)} />
              </div>

              {(sourcesQuery.data || []).length > 0 ? (
                <div className="tg-section p-4">
                  <h4 className="text-sm font-medium text-foreground mb-3">Source breakdown</h4>
                  <div className="space-y-2">
                    {(sourcesQuery.data || []).map((source) => (
                      <div key={source.source} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-foreground">{source.source}</span>
                          <span className="text-muted-foreground">
                            {formatNumber(source.user_count)} ({formatPercent(source.percentage)})
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${Math.min(100, Math.max(0, source.percentage))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <TabEmpty message="Нет данных по источникам" />
              )}

              {(transitionsQuery.data || []).length > 0 ? (
                <div className="tg-section p-4">
                  <h4 className="text-sm font-medium text-foreground mb-3">Screen transitions</h4>
                  <div className="space-y-2 text-xs">
                    {(transitionsQuery.data || []).map((transition, index) => (
                      <div key={`${transition.from_screen}-${transition.to_screen}-${index}`} className="p-3 bg-secondary rounded-lg">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-foreground">
                            {transition.from_screen} → {transition.to_screen}
                          </span>
                          <span className="text-muted-foreground">{formatNumber(transition.transitions)}</span>
                        </div>
                        <div className="text-muted-foreground mt-1">
                          unique users: {formatNumber(transition.unique_users)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <TabEmpty message="Нет данных по screen transitions" />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          {predictionsQuery.isLoading || tasksQuery.isLoading || eventHealthQuery.isLoading ? (
            <TabLoading />
          ) : predictionsQuery.error || tasksQuery.error || eventHealthQuery.error ? (
            <TabError message="Не удалось загрузить operational метрики" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={ShieldAlert} label="Pending" value={formatNumber(predictionsQuery.data?.pending_total || 0)} />
                <StatCard icon={Clock3} label="Under review" value={formatNumber(predictionsQuery.data?.under_review_total || 0)} />
                <StatCard icon={CheckCircle2} label="Resolved" value={formatNumber(predictionsQuery.data?.resolved_total || 0)} />
                <StatCard icon={Database} label="Reports (range)" value={formatNumber(predictionsQuery.data?.reports_created_in_range || 0)} />
              </div>

              <div className="tg-section p-4">
                <h4 className="text-sm font-medium text-foreground mb-2">Prediction moderation SLA</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    Avg to moderation: <span className="text-foreground">{(predictionsQuery.data?.avg_time_to_moderation_hours || 0).toFixed(1)}h</span>
                  </div>
                  <div>
                    Avg to resolution: <span className="text-foreground">{(predictionsQuery.data?.avg_time_to_resolution_hours || 0).toFixed(1)}h</span>
                  </div>
                </div>
              </div>

              {(tasksQuery.data || []).length > 0 ? (
                <div className="tg-section p-4">
                  <h4 className="text-sm font-medium text-foreground mb-3">Tasks completion</h4>
                  <div className="space-y-2 text-xs">
                    {(tasksQuery.data || []).map((task) => (
                      <div key={task.task_id} className="p-3 bg-secondary rounded-lg">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-foreground">{task.title}</span>
                          <span className="text-muted-foreground">{formatNumber(task.completions)}</span>
                        </div>
                        <div className="text-muted-foreground mt-1">
                          users: {formatNumber(task.unique_users)} | rate: {formatPercent(task.completion_rate)} | last: {formatDateTime(task.last_completed_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <TabEmpty message="Нет данных по заданиям" />
              )}

              {(eventHealthQuery.data || []).length > 0 ? (
                <div className="tg-section p-4">
                  <h4 className="text-sm font-medium text-foreground mb-3">Event health</h4>
                  <div className="space-y-2 text-xs">
                    {(eventHealthQuery.data || []).map((eventRow) => (
                      <div key={eventRow.event_type} className="p-3 bg-secondary rounded-lg">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-foreground">{eventRow.event_type}</span>
                          <span className="text-muted-foreground">{formatNumber(eventRow.event_count)}</span>
                        </div>
                        <div className="text-muted-foreground mt-1">
                          users: {formatNumber(eventRow.unique_users)} | with user_id: {formatPercent(eventRow.with_user_id_pct)} | last: {formatDateTime(eventRow.last_seen_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <TabEmpty message="Нет данных health по событиям" />
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
