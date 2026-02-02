import { motion } from "framer-motion";
import { UserStats } from "@/types/quiz";
import { ArrowLeft, Trophy, Target, Globe, Swords, ChevronRight, Lock } from "lucide-react";
import { haptic, getTelegramUser } from "@/lib/telegram";

interface ProfileScreenProps {
  stats: UserStats;
  onBack: () => void;
}

export const ProfileScreen = ({ stats, onBack }: ProfileScreenProps) => {
  const user = getTelegramUser();

  const handleBack = () => {
    haptic.selection();
    onBack();
  };

  const statItems = [
    { icon: Trophy, label: "Best score", value: stats.bestScore, color: "text-yellow-500" },
    { icon: Target, label: "Tests", value: stats.testsCompleted, color: "text-primary" },
    { icon: Globe, label: "Rank", value: `#${stats.globalRank.toLocaleString()}`, color: "text-green-500" },
    { icon: Swords, label: "Challenges", value: stats.activeChallenges, color: "text-purple-500" },
  ];

  const proFeatures = [
    { name: "Detailed analysis", locked: true },
    { name: "Question breakdown", locked: true },
    { name: "Hidden tests", locked: true },
  ];

  return (
    <motion.div
      className="min-h-screen flex flex-col p-5 safe-bottom"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <motion.div
        className="flex items-center mb-6"
        initial={{ y: -15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <button
          className="p-2 -ml-2 text-primary"
          onClick={handleBack}
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold text-foreground pr-8">
          Profile
        </h1>
      </motion.div>

      {/* Avatar & Name */}
      <motion.div
        className="flex flex-col items-center mb-8"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="tg-avatar w-20 h-20 mb-3">
          <span className="text-4xl">🧠</span>
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          {user?.first_name || 'Player'}
        </h2>
        {user?.username && (
          <p className="text-sm text-muted-foreground">@{user.username}</p>
        )}
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        className="grid grid-cols-4 gap-2 mb-6"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {statItems.map((item, index) => (
          <motion.div
            key={item.label}
            className="tg-stat"
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 + index * 0.05 }}
          >
            <item.icon className={`w-5 h-5 mx-auto mb-2 ${item.color}`} />
            <p className="text-lg font-bold text-foreground">{item.value}</p>
            <p className="text-[10px] text-muted-foreground">{item.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Pro Section */}
      <motion.div
        className="tg-section"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <div className="tg-header flex items-center gap-2">
          <Lock className="w-3 h-3" />
          Pro Features
        </div>
        
        {proFeatures.map((feature, index) => (
          <div key={feature.name}>
            <button 
              className="tg-cell w-full justify-between"
              onClick={() => haptic.selection()}
            >
              <span className="text-foreground">{feature.name}</span>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
            {index < proFeatures.length - 1 && <div className="tg-separator" />}
          </div>
        ))}
      </motion.div>

      {/* Unlock Button */}
      <motion.div
        className="mt-auto pt-6"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.45 }}
      >
        <button 
          className="tg-button"
          onClick={() => haptic.impact('medium')}
        >
          Unlock Pro
        </button>
      </motion.div>
    </motion.div>
  );
};