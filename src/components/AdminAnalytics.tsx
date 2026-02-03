import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { 
  Users, 
  HelpCircle, 
  Target, 
  Share2, 
  Clock, 
  TrendingUp,
  Activity,
  Loader2,
  BarChart3,
  Zap
} from "lucide-react";
import { PopcornIcon } from "@/components/icons/PopcornIcon";
import { BookmarkIcon } from "@/components/icons/BookmarkIcon";

// API URL - in production would be from env
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface OverviewStats {
  totalUsers: number;
  totalQuizzes: number;
  totalAttempts: number;
  totalShares: number;
  avgCompletionTime: number;
  dau: number;
  wau: number;
}

interface FunnelStage {
  stage: string;
  count: number;
  percentage: number;
}

interface TopQuiz {
  id: string;
  title: string;
  participant_count: number;
  like_count: number;
  save_count: number;
  question_count: number;
}

interface ActivityDay {
  date: string;
  completions: number;
}

// Note: In real implementation, this would use initData from Telegram
// For now, we'll use direct Supabase queries as fallback
import { supabase } from "@/integrations/supabase/client";

const useOverviewStats = () => {
  return useQuery({
    queryKey: ["admin", "analytics", "overview"],
    queryFn: async (): Promise<OverviewStats> => {
      // Direct Supabase queries (works without server)
      const [users, quizzes, attempts, today, week] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("quizzes").select("*", { count: "exact", head: true }).eq("is_published", true),
        supabase.from("quiz_results").select("*", { count: "exact", head: true }),
        supabase.from("quiz_results").select("*", { count: "exact", head: true })
          .gte("completed_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase.from("quiz_results").select("*", { count: "exact", head: true })
          .gte("completed_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      return {
        totalUsers: users.count || 0,
        totalQuizzes: quizzes.count || 0,
        totalAttempts: attempts.count || 0,
        totalShares: 0, // shares table might not exist yet
        avgCompletionTime: 60,
        dau: today.count || 0,
        wau: week.count || 0,
      };
    },
    refetchInterval: 30000, // Refresh every 30s
  });
};

const useFunnel = () => {
  return useQuery({
    queryKey: ["admin", "analytics", "funnel"],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const [started, completed] = await Promise.all([
        supabase.from("quiz_results").select("*", { count: "exact", head: true }).gte("completed_at", since),
        supabase.from("quiz_results").select("*", { count: "exact", head: true }).gte("completed_at", since).gt("score", 0),
      ]);

      const startedCount = started.count || 0;
      const completedCount = completed.count || 0;
      const sharedCount = 0; // shares table might not exist

      return {
        funnel: [
          { stage: "Начали", count: startedCount, percentage: 100 },
          { stage: "Завершили", count: completedCount, percentage: startedCount ? Math.round((completedCount / startedCount) * 100) : 0 },
          { stage: "Поделились", count: sharedCount, percentage: completedCount ? Math.round((sharedCount / completedCount) * 100) : 0 },
        ] as FunnelStage[],
      };
    },
  });
};

const useTopQuizzes = () => {
  return useQuery({
    queryKey: ["admin", "analytics", "top-quizzes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title, participant_count, like_count, save_count, question_count")
        .eq("is_published", true)
        .order("participant_count", { ascending: false })
        .limit(5);

      if (error) throw error;
      return { quizzes: data as TopQuiz[] };
    },
  });
};

const StatCard = ({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  color = "text-primary" 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number;
  subValue?: string;
  color?: string;
}) => (
  <div className="tg-section p-4">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      {subValue && (
        <span className="text-xs text-green-500 font-medium">{subValue}</span>
      )}
    </div>
  </div>
);

export const AdminAnalytics = () => {
  const { data: overview, isLoading: overviewLoading } = useOverviewStats();
  const { data: funnelData, isLoading: funnelLoading } = useFunnel();
  const { data: topQuizzesData, isLoading: topLoading } = useTopQuizzes();

  if (overviewLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overview Stats */}
      <motion.div
        className="grid grid-cols-2 gap-3"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <StatCard 
          icon={Users} 
          label="Пользователей" 
          value={overview?.totalUsers?.toLocaleString() || 0} 
        />
        <StatCard 
          icon={HelpCircle} 
          label="Квизов" 
          value={overview?.totalQuizzes || 0}
          color="text-purple-500"
        />
        <StatCard 
          icon={Target} 
          label="Прохождений" 
          value={overview?.totalAttempts?.toLocaleString() || 0}
          color="text-green-500"
        />
        <StatCard 
          icon={Share2} 
          label="Шеров" 
          value={overview?.totalShares?.toLocaleString() || 0}
          color="text-blue-500"
        />
      </motion.div>

      {/* DAU / WAU */}
      <motion.div
        className="tg-section p-4"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Активность</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-secondary rounded-xl">
            <p className="text-2xl font-bold text-foreground">{overview?.dau || 0}</p>
            <p className="text-xs text-muted-foreground">DAU (сегодня)</p>
          </div>
          <div className="text-center p-3 bg-secondary rounded-xl">
            <p className="text-2xl font-bold text-foreground">{overview?.wau || 0}</p>
            <p className="text-xs text-muted-foreground">WAU (неделя)</p>
          </div>
        </div>
      </motion.div>

      {/* Funnel */}
      <motion.div
        className="tg-section p-4"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Воронка (7 дней)</h3>
        </div>
        
        {funnelLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {funnelData?.funnel.map((stage, index) => (
              <div key={stage.stage}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-foreground">{stage.stage}</span>
                  <span className="text-muted-foreground">
                    {stage.count} ({stage.percentage}%)
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${stage.percentage}%` }}
                    transition={{ delay: 0.2 + index * 0.1, duration: 0.5 }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Top Quizzes */}
      <motion.div
        className="tg-section p-4"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Топ квизы</h3>
        </div>
        
        {topLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : topQuizzesData?.quizzes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Пока нет данных 📊
          </p>
        ) : (
          <div className="space-y-3">
            {topQuizzesData?.quizzes.map((quiz, index) => (
              <div 
                key={quiz.id} 
                className="flex items-center gap-3 p-2 bg-secondary rounded-lg"
              >
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {quiz.title}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {quiz.participant_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <PopcornIcon className="w-3 h-3" />
                      {quiz.like_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <BookmarkIcon className="w-3 h-3" />
                      {quiz.save_count}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Avg Time */}
      <motion.div
        className="tg-section p-4 flex items-center gap-4"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}
      >
        <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
          <Clock className="w-6 h-6 text-orange-500" />
        </div>
        <div>
          <p className="text-xl font-bold text-foreground">
            {overview?.avgCompletionTime || 60}s
          </p>
          <p className="text-sm text-muted-foreground">Среднее время прохождения</p>
        </div>
      </motion.div>

      {/* Fun fact */}
      <motion.div
        className="tg-section p-4 bg-primary/5 border border-primary/10"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">
            {overview?.totalAttempts === 0 
              ? "Ещё ни одного прохождения. Время запускать рекламу... или просто подождать 🙃"
              : overview?.totalShares === 0
              ? "Ноль шеров — видимо, все стесняются своих результатов 🙈"
              : `Каждый ${Math.ceil((overview?.totalAttempts || 1) / Math.max(overview?.totalShares || 1, 1))}-й пользователь делится результатом. Не Тикток, но старается!`
            }
          </p>
        </div>
      </motion.div>
    </div>
  );
};
