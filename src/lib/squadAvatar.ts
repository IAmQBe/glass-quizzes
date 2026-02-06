export const normalizeTelegramUsername = (username: string | null | undefined): string | null => {
  const normalized = (username ?? "").trim().replace(/^@+/, "");
  return normalized || null;
};

export const buildTelegramSquadUserpicUrl = (username: string | null | undefined): string | null => {
  const normalized = normalizeTelegramUsername(username);
  if (!normalized) return null;
  return `https://t.me/i/userpic/320/${encodeURIComponent(normalized)}.jpg`;
};

export const getSquadAvatarCandidates = (
  avatarUrl: string | null | undefined,
  username: string | null | undefined
): string[] => {
  const candidates = [avatarUrl?.trim() || null, buildTelegramSquadUserpicUrl(username)].filter(
    (item): item is string => Boolean(item)
  );

  return Array.from(new Set(candidates));
};
