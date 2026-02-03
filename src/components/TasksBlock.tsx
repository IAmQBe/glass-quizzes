import { motion } from "framer-motion";
import { Check, ChevronRight, Gift, ExternalLink } from "lucide-react";
import { PopcornIcon } from "@/components/icons/PopcornIcon";
import { useTasks, useCompletedTasks, useCompleteTask } from "@/hooks/useTasks";
import { haptic, getTelegram } from "@/lib/telegram";
import { Skeleton } from "@/components/ui/skeleton";

export const TasksBlock = () => {
  const { data: tasks = [], isLoading } = useTasks();
  const { data: completedIds = new Set() } = useCompletedTasks();
  const completeTask = useCompleteTask();

  const handleTaskClick = (task: any) => {
    haptic.impact('light');
    
    // If already completed, just show checkmark
    if (completedIds.has(task.id)) return;

    // Open link if present
    if (task.action_url) {
      const tg = getTelegram();
      if (tg && task.action_url.startsWith('https://t.me/')) {
        tg.openTelegramLink(task.action_url);
      } else if (tg) {
        tg.openLink(task.action_url);
      } else {
        window.open(task.action_url, '_blank');
      }
    }

    // Mark as completed
    completeTask.mutate(task.id);
  };

  if (isLoading) {
    return (
      <div className="tg-section p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="w-5 h-5 rounded" />
          <Skeleton className="w-24 h-4" />
        </div>
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="tg-section p-4">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="w-5 h-5 text-primary" />
        <span className="font-semibold text-foreground">Задания</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {completedIds.size}/{tasks.length}
        </span>
      </div>

      <div className="space-y-2">
        {tasks.map((task, index) => {
          const isCompleted = completedIds.has(task.id);
          
          return (
            <motion.button
              key={task.id}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                isCompleted 
                  ? "bg-green-50 dark:bg-green-900/20" 
                  : "bg-secondary hover:bg-secondary/80"
              }`}
              onClick={() => handleTaskClick(task)}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              disabled={completeTask.isPending}
            >
              {/* Icon */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                isCompleted 
                  ? "bg-green-100 dark:bg-green-800" 
                  : "bg-primary/10"
              }`}>
                {isCompleted ? (
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : (
                  task.icon
                )}
              </div>

              {/* Content */}
              <div className="flex-1 text-left min-w-0">
                <p className={`font-medium truncate ${
                  isCompleted ? "text-muted-foreground line-through" : "text-foreground"
                }`}>
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {task.description}
                  </p>
                )}
              </div>

              {/* Reward */}
              <div className="flex items-center gap-1 shrink-0">
                {!isCompleted && (
                  <>
                    <span className="text-sm font-semibold text-primary">
                      +{task.reward_amount}
                    </span>
                    <PopcornIcon className="w-4 h-4 text-primary" />
                  </>
                )}
                {task.action_url && !isCompleted && (
                  <ExternalLink className="w-4 h-4 text-muted-foreground ml-1" />
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
