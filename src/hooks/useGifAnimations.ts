import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "gif_animations_enabled";

const getInitialValue = (): boolean => {
  if (typeof window === "undefined") return true;
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved !== "false";
};

const notifyChange = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("gif-animations-change"));
};

export const setGifAnimationsEnabled = (enabled: boolean) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  notifyChange();
};

export const useGifAnimations = () => {
  const [animationsEnabled, setAnimationsEnabledState] = useState<boolean>(getInitialValue);

  useEffect(() => {
    const handleChange = () => setAnimationsEnabledState(getInitialValue());
    window.addEventListener("gif-animations-change", handleChange);
    window.addEventListener("storage", handleChange);
    return () => {
      window.removeEventListener("gif-animations-change", handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, []);

  const setAnimationsEnabled = useCallback((enabled: boolean) => {
    setAnimationsEnabledState(enabled);
    setGifAnimationsEnabled(enabled);
  }, []);

  const toggleAnimations = useCallback(() => {
    setAnimationsEnabled(!animationsEnabled);
  }, [animationsEnabled, setAnimationsEnabled]);

  return { animationsEnabled, setAnimationsEnabled, toggleAnimations };
};
