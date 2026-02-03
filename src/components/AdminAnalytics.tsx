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
  Zap,
  Eye,
  Play
} from "lucide-react";
import { PopcornIcon } from "@/components/icons/PopcornIcon";
import { BookmarkIcon } from "@/components/icons/BookmarkIcon";
import { supabase } from "@/integrations/supabase/client";
import {
  useDAU,
  useWAU,
  useMAU,
  useTotalShares,
  useAvgCompletionTime,
  useQuizFunnel,
  useTopQuizzesByCompletions,
  useUserSources,
} from "@/hooks/useAnalytics";

interface TopQuiz {
  quiz_id: string;
  title: string;
  completions: number;
  shares: number;
}

// Basic stats still from direct queries
const useBasicStats = () => {
  return useQuery({
    queryKey: ["admin", "analytics", "basic"],
    queryFn: async () => {
      const [users, quizzes, attempts] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("quizzes").select("*", { count: "exact", head: true }).eq("is_published", true),
        supabase.from("quiz_results").select("*", { count: "exact", head: true }),
      ]);

      return {
        totalUsers: users.count || 0,
        totalQuizzes: quizzes.count || 0,
        totalAttempts: attempts.count || 0,
      };
    },
    staleTime: 1000 * 60 * 5,
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
  // Basic stats
  const { data: basicStats, isLoading: basicLoading } = useBasicStats();
  
  // Real-time analytics from RPC functions
  const { data: dau = 0 } = useDAU();
  const { data: wau = 0 } = useWAU();
  const { data: mau = 0 } = useMAU();
  const { data: totalShares = 0 } = useTotalShares();
  const { data: avgTime = 60 } = useAvgCompletionTime();
  const { data: funnel } = useQuizFunnel();
  const { data: topQuizzes = [] } = useTopQuizzesByCompletions(5);
  const { data: sources = [] } = useUserSources(30);

  if (basicLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Calculate funnel stages
  const funnelStages = [
    { 
      stage: "Просмотрели", 
      count: funnel?.viewed || 0, 
      percentage: 100,
      icon: Eye 
    },
    { 
      stage: "Начали", 
      count: funnel?.started || 0, 
      percentage: funnel?.viewed ? Math.round((funnel.started / funnel.viewed) * 100) : 0,
      icon: Play 
    },
    { 
      stage: "Завершили", 
      count: funnel?.completed || 0, 
      percentage: funnel?.started ? Math.round((funnel.completed / funnel.started) * 100) : 0,
      icon: Target 
    },
    { 
      stage: "Поделились", 
      count: funnel?.shared || 0, 
      percentage: funnel?.completed ? Math.round((funnel.shared / funnel.completed) * 100) : 0,
      icon: Share2 
    },
  ];

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
          value={basicStats?.totalUsers?.toLocaleString() || 0} 
        />
        <StatCard 
          icon={HelpCircle} 
          label="Квизов" 
          value={basicStats?.totalQuizzes || 0}
          color="text-purple-500"
        />
        <StatCard 
          icon={Target} 
          label="Прохождений" 
          value={basicStats?.totalAttempts?.toLocaleString() || 0}
          color="text-green-500"
        />
        <StatCard 
          icon={Share2} 
          label="Шеров" 
          value={totalShares.toLocaleString()}
          color="text-blue-500"
        />
      </motion.div>

      {/* DAU / WAU / MAU */}
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
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-secondary rounded-xl">
            <p className="text-2xl font-bold text-foreground">{dau}</p>
            <p className="text-xs text-muted-foreground">DAU</p>
          </div>
          <div className="text-center p-3 bg-secondary rounded-xl">
            <p className="text-2xl font-bold text-foreground">{wau}</p>
            <p className="text-xs text-muted-foreground">WAU</p>
          </div>
          <div className="text-center p-3 bg-secondary rounded-xl">
            <p className="text-2xl font-bold text-foreground">{mau}</p>
            <p className="text-xs text-muted-foreground">MAU</p>
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
        
        <div className="space-y-3">
          {funnelStages.map((stage, index) => (
            <div key={stage.stage}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-foreground flex items-center gap-1.5">
                  <stage.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  {stage.stage}
                </span>
                <span className="text-muted-foreground">
                  {stage.count} ({stage.percentage}%)
                </span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(stage.percentage, 100)}%` }}
                  transition={{ delay: 0.2 + index * 0.1, duration: 0.5 }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* User Sources */}
      {sources.length > 0 && (
        <motion.div
          className="tg-section p-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.18 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Источники (30 дней)</h3>
          </div>
          
          <div className="space-y-2">
            {sources.slice(0, 5).map((source) => (
              <div 
                key={source.source}
                className="flex items-center justify-between p-2 bg-secondary rounded-lg"
              >
                <span className="text-sm text-foreground capitalize">{source.source}</span>
                <span className="text-sm text-muted-foreground">
                  {source.user_count} ({source.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Top Quizzes */}
      <motion.div
        className="tg-section p-4"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Топ квизы (по прохождениям)</h3>
        </div>
        
        {topQuizzes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Пока нет данных о прохождениях
          </p>
        ) : (
          <div className="space-y-3">
            {topQuizzes.map((quiz: TopQuiz, index: number) => (
              <div 
                key={quiz.quiz_id} 
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
                      <Target className="w-3 h-3" />
                      {quiz.completions}
                    </span>
                    <span className="flex items-center gap-1">
                      <Share2 className="w-3 h-3" />
                      {quiz.shares}
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
            {avgTime}s
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
            {basicStats?.totalAttempts === 0 
              ? "Ещё ни одного прохождения. Время запускать рекламу... или просто подождать"
              : totalShares === 0
              ? "Ноль шеров — видимо, все стесняются своих результатов"
              : `Каждый ${Math.ceil((basicStats?.totalAttempts || 1) / Math.max(totalShares, 1))}-й пользователь делится результатом`
            }
          </p>
        </div>
      </motion.div>
    </div>
  );
};
