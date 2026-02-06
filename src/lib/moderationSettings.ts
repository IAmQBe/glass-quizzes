import { supabase } from "@/integrations/supabase/client";

export const MODERATION_SETTINGS_KEY = "moderation_settings";
export const DEFAULT_MANUAL_MODERATION_ENABLED = true;

const parseBooleanValue = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
};

export const parseManualModerationEnabled = (value: unknown): boolean => {
  const directValue = parseBooleanValue(value);
  if (directValue !== null) return directValue;

  if (!value || typeof value !== "object") {
    return DEFAULT_MANUAL_MODERATION_ENABLED;
  }

  const settings = value as Record<string, unknown>;
  const direct = parseBooleanValue(settings.manual_moderation_enabled);
  if (direct !== null) return direct;

  const legacy = parseBooleanValue(settings.enabled);
  if (legacy !== null) return legacy;

  return DEFAULT_MANUAL_MODERATION_ENABLED;
};

export const buildModerationSettingsValue = (enabled: boolean) => ({
  manual_moderation_enabled: enabled,
});

export const loadManualModerationEnabled = async (): Promise<boolean> => {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", MODERATION_SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    console.warn("Failed to load moderation settings, using default:", error.message);
    return DEFAULT_MANUAL_MODERATION_ENABLED;
  }

  return parseManualModerationEnabled(data?.value);
};
