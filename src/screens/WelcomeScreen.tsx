import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { GlassButton } from "@/components/GlassButton";
import { Sparkles, Clock, Users } from "lucide-react";

interface WelcomeScreenProps {
  onStart: () => void;
}

export const WelcomeScreen = ({ onStart }: WelcomeScreenProps) => {
  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.6 }}
        className="text-center mb-8"
      >
        <motion.div
          className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center glass-card animate-pulse-glow"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        >
          <Sparkles className="w-10 h-10 text-primary" />
        </motion.div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          How strong is your mind?
        </h1>
        <p className="text-muted-foreground text-sm">
          Discover where you stand
        </p>
      </motion.div>

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="w-full max-w-sm"
      >
        <GlassCard className="p-6 mb-6">
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full glass-card flex items-center justify-center">
                <span className="text-xs font-medium text-foreground">5</span>
              </div>
              <span>questions</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full glass-card flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <span>60 sec</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full glass-card flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <span>public</span>
            </div>
          </div>

          <GlassButton
            variant="primary"
            size="lg"
            className="w-full"
            onClick={onStart}
          >
            Start test
          </GlassButton>
        </GlassCard>

        <motion.button
          className="block mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          How it works
        </motion.button>
      </motion.div>
    </motion.div>
  );
};
