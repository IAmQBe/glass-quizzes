import { useState, useEffect, useCallback } from "react";

type Theme = "light" | "dark" | "system";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("theme") as Theme) || "system";
  });

  const getSystemTheme = useCallback((): "light" | "dark" => {
    if (typeof window === "undefined") return "light";
    
    // Check Telegram theme first
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.colorScheme) {
      return tg.colorScheme === "dark" ? "dark" : "light";
    }
    
    // Fallback to system preference
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }, []);

  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  useEffect(() => {
    const root = document.documentElement;
    
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [resolvedTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const root = document.documentElement;
      if (getSystemTheme() === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme, getSystemTheme]);

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    isDark: resolvedTheme === "dark",
  };
}
