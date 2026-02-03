import { motion } from "framer-motion";
import { Sparkles, Clock, Users } from "lucide-react";
import { haptic } from "@/lib/telegram";

interface WelcomeScreenProps {
  onStart: () => void;
}

export const WelcomeScreen = ({ onStart }: WelcomeScreenProps) => {
  const handleStart = () => {
    haptic.impact('medium');
    onStart();
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center p-5 pb-24 safe-bottom"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Icon */}
      <motion.div
        className="tg-avatar w-20 h-20 mb-6"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
      >
        <Sparkles className="w-10 h-10 text-primary" />
      </motion.div>

      {/* Title */}
      <motion.div
        className="text-center mb-8"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h1 className="text-2xl font-bold text-foreground mb-2">
          How strong is your mind?
        </h1>
        <p className="text-muted-foreground">
          Discover where you stand
        </p>
      </motion.div>

      {/* Info Card */}
      <motion.div
        className="w-full max-w-sm mb-6"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="tg-section p-5">
          <div className="flex items-center justify-around mb-6">
            <div className="flex flex-col items-center gap-2">
              <div className="tg-avatar w-12 h-12">
                <span className="text-lg font-semibold text-primary">5</span>
              </div>
              <span className="text-xs text-muted-foreground">questions</span>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <div className="tg-avatar w-12 h-12">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">60 sec</span>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <div className="tg-avatar w-12 h-12">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">public</span>
            </div>
          </div>

          <button
            className="tg-button"
            onClick={handleStart}
          >
            Start test
          </button>
        </div>
      </motion.div>

      {/* How it works link */}
      <motion.button
        className="tg-button-text"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        onClick={() => haptic.selection()}
      >
        How it works
      </motion.button>
    </motion.div>
  );
};