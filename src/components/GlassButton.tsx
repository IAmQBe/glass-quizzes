import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassButtonProps extends HTMLMotionProps<"button"> {
  variant?: "default" | "primary" | "secondary";
  size?: "sm" | "md" | "lg";
}

export const GlassButton = ({
  children,
  className,
  variant = "default",
  size = "md",
  ...props
}: GlassButtonProps) => {
  const variants = {
    default: "glass-button",
    primary: "glass-button-primary",
    secondary: "glass-button opacity-70 hover:opacity-100",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  return (
    <motion.button
      className={cn(variants[variant], sizes[size], "text-foreground", className)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      {...props}
    >
      {children}
    </motion.button>
  );
};
