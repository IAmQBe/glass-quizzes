import { useCallback, useEffect, useMemo, useState } from "react";

export type RolePreviewMode = "real" | "admin" | "user";

type ForcedRole = "admin" | "user" | null;

const ROLE_PREVIEW_STORAGE_KEY = "role_preview_mode";
const ROLE_PREVIEW_EVENT = "role-preview-change";

const normalizeRolePreviewMode = (value: string | null | undefined): RolePreviewMode => {
  if (value === "admin" || value === "user" || value === "real") {
    return value;
  }
  return "real";
};

const readRolePreviewMode = (): RolePreviewMode => {
  if (typeof window === "undefined") return "real";
  try {
    return normalizeRolePreviewMode(window.localStorage.getItem(ROLE_PREVIEW_STORAGE_KEY));
  } catch {
    return "real";
  }
};

const toForcedRole = (mode: RolePreviewMode): ForcedRole => {
  if (mode === "admin") return "admin";
  if (mode === "user") return "user";
  return null;
};

export const useRolePreview = () => {
  const [rolePreviewMode, setRolePreviewModeState] = useState<RolePreviewMode>(() => readRolePreviewMode());

  useEffect(() => {
    setRolePreviewModeState(readRolePreviewMode());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== ROLE_PREVIEW_STORAGE_KEY) return;
      setRolePreviewModeState(normalizeRolePreviewMode(event.newValue));
    };

    const handleRolePreviewEvent = (event: Event) => {
      const customEvent = event as CustomEvent<RolePreviewMode>;
      setRolePreviewModeState(normalizeRolePreviewMode(customEvent.detail));
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(ROLE_PREVIEW_EVENT, handleRolePreviewEvent as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(ROLE_PREVIEW_EVENT, handleRolePreviewEvent as EventListener);
    };
  }, []);

  const setRolePreviewMode = useCallback((mode: RolePreviewMode) => {
    setRolePreviewModeState(mode);

    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(ROLE_PREVIEW_STORAGE_KEY, mode);
    } catch {
      // Ignore storage failures in constrained contexts.
    }

    window.dispatchEvent(new CustomEvent<RolePreviewMode>(ROLE_PREVIEW_EVENT, { detail: mode }));
  }, []);

  const forcedRole = useMemo(() => toForcedRole(rolePreviewMode), [rolePreviewMode]);

  return {
    rolePreviewMode,
    setRolePreviewMode,
    forcedRole,
    isRolePreviewActive: rolePreviewMode !== "real",
  };
};
