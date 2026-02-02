import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { GlassButton } from "@/components/GlassButton";
import { UserStats } from "@/types/quiz";
import { ArrowLeft, Trophy, Target, Globe, Swords, ChevronRight, Lock } from "lucide-react";
import { QuizScreen } from "@/hooks/useQuiz";

interface ProfileScreenProps {
  stats: UserStats;
  onBack: () => void;
}

export const ProfileScreen = ({ stats, onBack }: ProfileScreenProps) => {
  const statItems = [
    { 
      icon: Trophy, 
      label: "Best score", 
      value: stats.bestScore,
      color: "text-yellow-400"
    },
    { 
      icon: Target, 
      label: "Tests completed", 
      value: stats.testsCompleted,
      color: "text-primary"
    },
    { 
      icon: Globe, 
      label: "Global rank", 
      value: `#${stats.globalRank.toLocaleString()}`,
      color: "text-green-400"
    },
    { 
      icon: Swords, 
      label: "Active challenges", 
      value: stats.activeChallenges,
      color: "text-accent"
    },
  ];

  const proFeatures = [
    "Detailed analysis",
    "Question breakdown",
    "Hidden tests",
  ];

  return (
    <motion.div
      className="min-h-screen flex flex-col p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <motion.div
        className="flex items-center mb-8"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <GlassButton
          variant="secondary"
          size="sm"
          className="p-2"
          onClick={onBack}
        >
          <ArrowLeft className="w-5 h-5" />
        </GlassButton>
        <h1 className="flex-1 text-center text-lg font-semibold text-foreground pr-10">
          Your Profile
        </h1>
      </motion.div>

      {/* Avatar */}
      <motion.div
        className="flex justify-center mb-8"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring" }}
      >
        <div className="w-24 h-24 rounded-full glass-card flex items-center justify-center glow-md">
          <span className="text-4xl">🧠</span>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        className="grid grid-cols-2 gap-3 mb-8"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {statItems.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 + index * 0.05 }}
          >
            <GlassCard className="p-4 text-center">
              <item.icon className={`w-6 h-6 mx-auto mb-2 ${item.color}`} />
              <p className="text-2xl font-bold text-foreground mb-1">
                {item.value}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.label}
              </p>
            </GlassCard>
          </motion.div>
        ))}
      </motion.div>

      {/* Pro Section */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Pro features</span>
          </div>
          
          <div className="space-y-3">
            {proFeatures.map((feature, index) => (
              <div
                key={feature}
                className="flex items-center justify-between text-muted-foreground"
              >
                <span className="text-sm">{feature}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            ))}
          </div>

          <GlassButton
            variant="primary"
            size="sm"
            className="w-full mt-4"
          >
            Unlock Pro
          </GlassButton>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
};
