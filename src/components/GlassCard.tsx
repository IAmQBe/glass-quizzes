import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  variant?: "default" | "option" | "compare";
  selected?: boolean;
  winner?: boolean;
}

export const GlassCard = ({
  children,
  className,
  variant = "default",
  selected = false,
  winner,
  ...props
}: GlassCardProps) => {
  const variants = {
    default: "glass-card",
    option: cn("glass-option", selected && "selected"),
    compare: cn("compare-card", winner === true && "winner", winner === false && "loser"),
  };

  return (
    <motion.div
      className={cn(variants[variant], className)}
      whileHover={{ scale: variant === "option" ? 1.02 : 1 }}
      whileTap={{ scale: variant === "option" ? 0.98 : 1 }}
      {...props}
    >
      {children}
    </motion.div>
  );
};
