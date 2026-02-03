import { useState, useEffect, useCallback, useLayoutEffect } from "react";

type Theme = "light" | "dark";

// Apply theme to DOM immediately (before paint)
const applyThemeToDOM = (theme: "light" | "dark") => {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

// Get initial theme from localStorage or default to light
const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem("theme") as Theme | null;
  return saved === "dark" ? "dark" : "light";
};

// Apply theme IMMEDIATELY on script load (before React)
if (typeof window !== "undefined") {
  applyThemeToDOM(getInitialTheme());
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    applyThemeToDOM(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  }, [theme, setTheme]);

  // Sync theme on mount (in case localStorage changed)
  useLayoutEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === "dark",
  };
}
