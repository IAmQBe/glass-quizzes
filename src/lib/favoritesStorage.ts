import { getTelegramUser } from "@/lib/telegram";

type FavoriteKind = "quiz" | "test";

interface LocalFavoritesState {
  quizzes: Record<string, string>;
  tests: Record<string, string>;
}

const LOCAL_FAVORITES_PREFIX = "favorites_local_v1";

const getLocalStorageKey = (): string | null => {
  const tgUser = getTelegramUser();
  if (!tgUser?.id) return null;
  return `${LOCAL_FAVORITES_PREFIX}_${tgUser.id}`;
};

const defaultState = (): LocalFavoritesState => ({
  quizzes: {},
  tests: {},
});

const readState = (): LocalFavoritesState => {
  if (typeof window === "undefined") return defaultState();

  const key = getLocalStorageKey();
  if (!key) return defaultState();

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);

    return {
      quizzes: parsed?.quizzes && typeof parsed.quizzes === "object" ? parsed.quizzes : {},
      tests: parsed?.tests && typeof parsed.tests === "object" ? parsed.tests : {},
    };
  } catch {
    return defaultState();
  }
};

const writeState = (state: LocalFavoritesState): boolean => {
  if (typeof window === "undefined") return false;

  const key = getLocalStorageKey();
  if (!key) return false;

  try {
    window.localStorage.setItem(key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
};

const getStoreRef = (state: LocalFavoritesState, kind: FavoriteKind): Record<string, string> =>
  kind === "quiz" ? state.quizzes : state.tests;

export const getLocalFavoriteTimestampMap = (kind: FavoriteKind): Record<string, string> => {
  const state = readState();
  const source = getStoreRef(state, kind);
  return { ...source };
};

export const getLocalFavoriteIds = (kind: FavoriteKind): Set<string> => {
  return new Set(Object.keys(getLocalFavoriteTimestampMap(kind)));
};

export const setLocalFavorite = (kind: FavoriteKind, entityId: string, isFavorite: boolean): boolean => {
  if (!entityId) return false;

  const state = readState();
  const store = getStoreRef(state, kind);

  if (isFavorite) {
    store[entityId] = store[entityId] || new Date().toISOString();
  } else {
    delete store[entityId];
  }

  return writeState(state);
};
