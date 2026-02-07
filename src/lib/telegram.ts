// Telegram WebApp SDK integration
// This file handles all Telegram-specific functionality

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  is_premium?: boolean;
  language_code?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    start_param?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
    accent_text_color?: string;
  };
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  disableVerticalSwipes?: () => void;
  enableVerticalSwipes?: () => void;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    show: () => void;
    hide: () => void;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    enable: () => void;
    disable: () => void;
  };
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  sendData: (data: string) => void;
  openLink: (url: string) => void;
  openTelegramLink: (url: string) => void;
  switchInlineQuery: (query: string, chatTypes?: string[]) => void;
  showPopup: (params: { title?: string; message: string; buttons?: { type?: string; text: string; id?: string }[] }, callback?: (id: string) => void) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  openInvoice?: (url: string, callback?: (status: 'paid' | 'cancelled' | 'failed' | string) => void) => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
}

export const BOT_USERNAME = 'QuipoBot';

// Get Telegram WebApp instance
export const getTelegram = (): TelegramWebApp | null => {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
};

export const openInvoiceAsync = async (invoiceLink: string): Promise<'paid' | 'cancelled' | 'failed' | string> => {
  const tg = getTelegram();
  if (!tg?.openInvoice) {
    throw new Error('openInvoice is unavailable (must be opened inside Telegram)');
  }

  return await new Promise((resolve) => {
    tg.openInvoice?.(invoiceLink, (status) => resolve(status));
  });
};

// Check if running inside Telegram
export const isTelegramWebApp = (): boolean => {
  return getTelegram() !== null;
};

// Get current user
export const getTelegramUser = (): TelegramUser | null => {
  const tg = getTelegram();
  return tg?.initDataUnsafe?.user || null;
};

// Get user data for profile sync
export const getTelegramUserData = () => {
  const user = getTelegramUser();
  if (!user) return null;

  return {
    telegram_id: user.id,
    username: user.username || null,
    first_name: user.first_name,
    last_name: user.last_name || null,
    has_telegram_premium: user.is_premium || false,
  };
};

const TELEGRAM_HOSTS = new Set(['t.me', 'telegram.me', 'www.t.me', 'www.telegram.me']);

const trimSlash = (value: string): string => value.replace(/^\/+|\/+$/g, '');
const isTelegramUsername = (value: string): boolean => /^[a-zA-Z0-9_]{3,}$/.test(value);
const splitTelegramPath = (path: string): string[] => path.split('/').filter(Boolean);

type TelegramLinkKind = 'username' | 'invite' | 'other';

const detectTelegramLinkKind = (url: string): TelegramLinkKind => {
  try {
    const parsed = new URL(url);
    if (!TELEGRAM_HOSTS.has(parsed.hostname.toLowerCase())) {
      return 'other';
    }

    const [first = ''] = splitTelegramPath(parsed.pathname);
    if (!first) return 'other';
    if (first.startsWith('+') || first.toLowerCase() === 'joinchat') return 'invite';
    if (isTelegramUsername(first)) return 'username';
    return 'other';
  } catch {
    return 'other';
  }
};

const isDesktopTelegramPlatform = (platform: string | null | undefined): boolean => {
  const value = (platform || '').toLowerCase();
  return value === 'tdesktop' || value === 'macos';
};

const toTelegramDeepLink = (url: string): string | null => {
  if (url.toLowerCase().startsWith('tg://')) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (!TELEGRAM_HOSTS.has(parsed.hostname.toLowerCase())) return null;

    const segments = splitTelegramPath(parsed.pathname);
    const [first = '', second = ''] = segments;
    if (!first) return null;

    // Chat invite links:
    // - https://t.me/+<hash>
    // - https://t.me/joinchat/<hash>
    if (first.startsWith('+')) {
      const hash = first.slice(1);
      return hash ? `tg://join?invite=${encodeURIComponent(hash)}` : null;
    }
    if (first.toLowerCase() === 'joinchat' && second) {
      return `tg://join?invite=${encodeURIComponent(second)}`;
    }

    // Public username links:
    if (isTelegramUsername(first)) {
      return `tg://resolve?domain=${encodeURIComponent(first)}`;
    }

    return null;
  } catch {
    return null;
  }
};

const parseTelegramResolveDomain = (value: string): string | null => {
  if (!value.toLowerCase().startsWith('tg://resolve')) return null;
  const [, query = ''] = value.split('?');
  const params = new URLSearchParams(query);
  const domain = params.get('domain');
  return domain ? trimSlash(domain) : null;
};

export const normalizeTelegramUsername = (rawValue: string | null | undefined): string | null => {
  if (!rawValue) return null;

  const value = rawValue.trim();
  if (!value) return null;

  const resolveDomain = parseTelegramResolveDomain(value);
  if (resolveDomain) {
    const normalized = resolveDomain.replace(/^@+/, '');
    return isTelegramUsername(normalized) ? normalized : null;
  }

  if (value.toLowerCase().startsWith('http://') || value.toLowerCase().startsWith('https://')) {
    try {
      const parsed = new URL(value);
      if (!TELEGRAM_HOSTS.has(parsed.hostname.toLowerCase())) return null;
      const firstPathPart = trimSlash(parsed.pathname).split('/')[0];
      const domain = firstPathPart || parsed.searchParams.get('domain') || '';
      const normalized = domain.replace(/^@+/, '');
      return normalized && isTelegramUsername(normalized) ? normalized : null;
    } catch {
      return null;
    }
  }

  if (value.toLowerCase().startsWith('t.me/') || value.toLowerCase().startsWith('telegram.me/')) {
    const path = value.split('/').slice(1).join('/');
    const firstPathPart = trimSlash(path).split('/')[0];
    const normalized = firstPathPart.replace(/^@+/, '');
    return normalized && isTelegramUsername(normalized) ? normalized : null;
  }

  const normalized = trimSlash(value).replace(/^@+/, '');
  return normalized && isTelegramUsername(normalized) ? normalized : null;
};

export const normalizeTelegramLink = (rawValue: string | null | undefined): string | null => {
  if (!rawValue) return null;
  const value = rawValue.trim();
  if (!value) return null;

  const resolveDomain = parseTelegramResolveDomain(value);
  if (resolveDomain) {
    return `https://t.me/${encodeURIComponent(resolveDomain.replace(/^@+/, ''))}`;
  }

  if (value.toLowerCase().startsWith('http://') || value.toLowerCase().startsWith('https://')) {
    try {
      const parsed = new URL(value);
      if (!TELEGRAM_HOSTS.has(parsed.hostname.toLowerCase())) return null;
      const pathSegments = splitTelegramPath(parsed.pathname);
      if (pathSegments.length === 0) return null;
      const path = parsed.pathname.startsWith('/') ? parsed.pathname : `/${parsed.pathname}`;
      return `https://t.me${path}${parsed.search}${parsed.hash}`;
    } catch {
      return null;
    }
  }

  if (value.toLowerCase().startsWith('t.me/') || value.toLowerCase().startsWith('telegram.me/')) {
    const normalized = value.replace(/^https?:\/\//i, '');
    const slashIndex = normalized.indexOf('/');
    const rawPath = slashIndex >= 0 ? normalized.slice(slashIndex + 1) : '';
    if (!rawPath || splitTelegramPath(rawPath).length === 0) return null;
    return `https://${normalized}`;
  }

  if (value.startsWith('@') || /^[a-zA-Z0-9_]{3,}$/.test(value)) {
    const username = normalizeTelegramUsername(value);
    return username ? `https://t.me/${encodeURIComponent(username)}` : null;
  }

  return null;
};

export const resolveSquadTelegramUrl = ({
  username,
  inviteLink,
  botUsername = BOT_USERNAME,
}: {
  username?: string | null;
  inviteLink?: string | null;
  botUsername?: string;
}): string | null => {
  const normalizedBot = normalizeTelegramUsername(botUsername)?.toLowerCase() || '';
  const normalizedUsername = normalizeTelegramUsername(username);

  if (normalizedUsername && normalizedUsername.toLowerCase() !== normalizedBot) {
    return `https://t.me/${encodeURIComponent(normalizedUsername)}`;
  }

  const normalizedInviteLink = normalizeTelegramLink(inviteLink);
  if (normalizedInviteLink) {
    const inviteUsername = normalizeTelegramUsername(normalizedInviteLink);
    if (inviteUsername && inviteUsername.toLowerCase() === normalizedBot) {
      return null;
    }
    return normalizedInviteLink;
  }

  return null;
};

export const openTelegramTarget = (url: string | null | undefined): boolean => {
  if (!url) return false;

  const tg = getTelegram();
  try {
    const linkKind = detectTelegramLinkKind(url);
    const desktopPlatform = isDesktopTelegramPlatform(tg?.platform);

    // Telegram Desktop can be picky: try native tg:// deep links first.
    if (desktopPlatform && (linkKind === 'username' || linkKind === 'invite')) {
      const deepLink = toTelegramDeepLink(url);
      if (deepLink) {
        if (tg?.openTelegramLink) {
          try {
            // WebApp docs say https://t.me/, but Desktop handles tg:// links well in practice.
            tg.openTelegramLink(deepLink);
            return true;
          } catch {
            // Fallback below.
          }
        }
        if (tg?.openLink) {
          tg.openLink(deepLink);
          return true;
        }
        if (typeof window !== 'undefined') {
          window.open(deepLink, '_blank', 'noopener,noreferrer');
          return true;
        }
      }
    }

    if (linkKind === 'username' && tg?.openTelegramLink) {
      tg.openTelegramLink(url);
      return true;
    }

    if (linkKind === 'invite' && tg?.openTelegramLink) {
      tg.openTelegramLink(url);
      return true;
    }

    if (tg?.openLink) {
      tg.openLink(url);
      return true;
    }

    if (tg?.openTelegramLink && (url.startsWith('https://t.me/') || url.startsWith('http://t.me/') || url.startsWith('tg://'))) {
      tg.openTelegramLink(url);
      return true;
    }

    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    }
  } catch (error) {
    console.error('[Telegram] Failed to open URL:', url, error);
  }

  return false;
};

export const buildBotStartUrl = (startParam: string, botUsername: string = BOT_USERNAME): string => {
  const normalizedBot = normalizeTelegramUsername(botUsername) || BOT_USERNAME;
  return `https://t.me/${normalizedBot}?start=${encodeURIComponent(startParam)}`;
};

export const buildReferralStartParam = (referralCodeOrTelegramId: string | number): string => {
  const raw = String(referralCodeOrTelegramId ?? '').trim();
  if (!raw) return 'ref_';
  return /^\d+$/.test(raw) ? `ref_${raw}` : `refc_${raw}`;
};

export const buildReferralUrl = (
  referralCodeOrTelegramId: string | number,
  botUsername: string = BOT_USERNAME
): string => {
  const startParam = buildReferralStartParam(referralCodeOrTelegramId);
  return buildBotStartUrl(startParam, botUsername);
};

export const parseReferralStartParam = (
  startParam: string | null | undefined
): { referrerTelegramId: number | null; referralCode: string | null } => {
  if (!startParam) {
    return { referrerTelegramId: null, referralCode: null };
  }

  const value = startParam.trim();
  if (!value) {
    return { referrerTelegramId: null, referralCode: null };
  }

  const refIdMatch = value.match(/(?:^|[_:])ref_(\d+)(?:$|[_:])/i);
  if (refIdMatch) {
    return { referrerTelegramId: parseInt(refIdMatch[1], 10), referralCode: null };
  }

  const compactRefMatch = value.match(/(?:^|[_:])ref(\d+)(?:$|[_:])/i);
  if (compactRefMatch) {
    return { referrerTelegramId: parseInt(compactRefMatch[1], 10), referralCode: null };
  }

  const refCodeMatch = value.match(/(?:^|[_:])refc_([a-zA-Z0-9_-]{4,128})(?:$|[_:])/i);
  if (refCodeMatch) {
    return { referrerTelegramId: null, referralCode: refCodeMatch[1] };
  }

  if (/^\d{5,}$/.test(value)) {
    return { referrerTelegramId: parseInt(value, 10), referralCode: null };
  }

  if (/^[a-zA-Z0-9_-]{6,128}$/.test(value)) {
    const blockedPrefixes = ['quest_', 'test_', 'share_', 'qshare_', 'live_', 'poll', 'moderate_', 'preview_'];
    const lower = value.toLowerCase();
    if (!blockedPrefixes.some((prefix) => lower.startsWith(prefix))) {
      return { referrerTelegramId: null, referralCode: value };
    }
  }

  const inlineParts = value.split(/[_:]/);
  const lastInlinePart = inlineParts[inlineParts.length - 1];
  if (/^\d{5,}$/.test(lastInlinePart)) {
    return { referrerTelegramId: parseInt(lastInlinePart, 10), referralCode: null };
  }

  return { referrerTelegramId: null, referralCode: null };
};

// Haptic feedback
export const haptic = {
  impact: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') => {
    getTelegram()?.HapticFeedback?.impactOccurred(style);
  },
  notification: (type: 'error' | 'success' | 'warning') => {
    getTelegram()?.HapticFeedback?.notificationOccurred(type);
  },
  selection: () => {
    getTelegram()?.HapticFeedback?.selectionChanged();
  },
};

// Share quiz result: use switchInlineQuery for 1-click sharing
export const shareQuizResult = (
  quizId: string,
  quizTitle: string,
  score: number,
  totalQuestions: number,
  verdict?: string
) => {
  const tg = window.Telegram?.WebApp;
  const userId = tg?.initDataUnsafe?.user?.id;

  // Format: quiz_result:quizId:score:total:title:refUserId (inline handler expects this)
  const titlePart = quizTitle.slice(0, 20).replace(/:/g, ' ');
  // Include user ID as referrer for tracking
  const inlineQuery = userId
    ? `quiz_result:${quizId}:${score}:${totalQuestions}:${encodeURIComponent(titlePart)}:${userId}`
    : `quiz_result:${quizId}:${score}:${totalQuestions}:${encodeURIComponent(titlePart)}`;

  console.log('[Share Quiz] Attempting switchInlineQuery:', inlineQuery);

  if (tg?.switchInlineQuery) {
    try {
      tg.switchInlineQuery(inlineQuery, ['users', 'groups', 'channels']);
      console.log('[Share Quiz] switchInlineQuery called successfully');
    } catch (err) {
      console.error('[Share Quiz] switchInlineQuery error:', err);
      fallbackShare(quizId, titlePart, 'quiz', userId);
    }
  } else {
    console.log('[Share Quiz] switchInlineQuery not available, using fallback');
    fallbackShare(quizId, titlePart, 'quiz', userId);
  }
};

// Legacy share (keep for backward compatibility)
export const shareResult = (score: number, percentile: number, verdict: string) => {
  const tg = getTelegram();
  if (tg) {
    const shareText = `🧠 My score: ${score}/100 (Top ${percentile}%)\n${verdict}\n\nCan you beat me?`;
    tg.switchInlineQuery(shareText, ['users', 'groups', 'channels']);
  }
};

// Challenge a friend
export const challengeFriend = () => {
  const tg = getTelegram();
  if (tg) {
    tg.switchInlineQuery('Challenge me! 🎯', ['users']);
  }
};

// Share personality test result: use switchInlineQuery for 1-click sharing
// Opens chat selector directly, sends rich card with image + title + description + CTA
// NOTE: Telegram limits inline query to 256 chars, so we only pass testId + title + userId
// The bot fetches description and imageUrl from DB
export const sharePersonalityTestResult = (
  resultTitle: string,
  description: string,
  testId: string,
  testTitle?: string,
  imageUrl?: string
) => {
  const tg = window.Telegram?.WebApp;
  const userId = tg?.initDataUnsafe?.user?.id;

  // Format: test_result:testId:resultTitle:refUserId
  // Keep it SHORT (<256 chars) - Telegram limit!
  const titlePart = resultTitle.slice(0, 25).replace(/:/g, ' ').trim();

  // Build compact query
  const parts = ['test_result', testId, encodeURIComponent(titlePart)];
  if (userId) parts.push(String(userId));
  const inlineQuery = parts.join(':');

  console.log('[Share] inline query length:', inlineQuery.length, 'query:', inlineQuery);

  if (tg?.switchInlineQuery) {
    try {
      tg.switchInlineQuery(inlineQuery, ['users', 'groups', 'channels']);
    } catch (err) {
      console.error('[Share] switchInlineQuery failed:', err);
      fallbackShare(testId, titlePart, 'test', userId);
    }
  } else {
    fallbackShare(testId, titlePart, 'test', userId);
  }
};

const sanitizeTitleForStartParam = (title?: string, maxLength: number = 25) => {
  if (!title) return '';
  return title.slice(0, maxLength).replace(/:/g, ' ').trim();
};

const buildShareStartParam = (type: 'test' | 'quiz', id: string, title?: string, refUserId?: number) => {
  const refPart = refUserId ? `_ref${refUserId}` : '';
  if (type === 'test') {
    const titlePart = sanitizeTitleForStartParam(title);
    return `share_${id}_${titlePart}${refPart}`;
  }
  return `qshare_${id}${refPart}`;
};

const buildContentShareUrl = (type: 'test' | 'quiz', id: string, title?: string, refUserId?: number) => {
  const startParam = buildShareStartParam(type, id, title, refUserId);
  return buildBotStartUrl(startParam, BOT_USERNAME);
};

const openShareDialog = (text: string, url: string) => {
  const tg = getTelegram();
  if (tg) {
    // Telegram Desktop WebApp has known issues with opening `t.me/share/url` via SDK methods.
    // Prefer inline mode there (user picks chat, then sends text+link).
    if (isDesktopTelegramPlatform(tg.platform) && tg.switchInlineQuery) {
      tg.switchInlineQuery(`${text}\n\n${url}`, ['users', 'groups', 'channels']);
      return;
    }

    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    if (!openTelegramTarget(shareUrl)) {
      tg.switchInlineQuery(`${text}\n\n${url}`, ['users', 'groups', 'channels']);
    }
    return;
  }

  if (navigator.share) {
    navigator.share({ text, url });
  } else {
    navigator.clipboard.writeText(`${text}\n\n${url}`);
  }
};

const buildInviteText = (type: 'test' | 'quiz', title: string, description?: string | null) => {
  const typeLabel = type === 'quiz' ? 'квиза' : 'теста';
  const base = `Предлагаю тебе присоединиться к прохождению ${typeLabel}: ${title}`;
  const desc = description?.trim();
  return desc ? `${base}\n${desc}` : base;
};

export const shareQuizInvite = (quizId: string, title: string, description?: string | null) => {
  const tg = getTelegram();
  const userId = tg?.initDataUnsafe?.user?.id;
  const inlineQuery = userId ? `quiz_invite:${quizId}:${userId}` : `quiz_invite:${quizId}`;

  if (tg?.switchInlineQuery) {
    try {
      tg.switchInlineQuery(inlineQuery, ['users', 'groups', 'channels']);
      return;
    } catch (err) {
      console.error('[Share Quiz Invite] switchInlineQuery failed:', err);
    }
  }

  // Fallback: plain text + deep link
  const text = buildInviteText('quiz', title, description);
  const url = buildContentShareUrl('quiz', quizId, undefined, userId);
  openShareDialog(text, url);
};

export const sharePersonalityTestInvite = (testId: string, title: string, description?: string | null) => {
  const tg = getTelegram();
  const userId = tg?.initDataUnsafe?.user?.id;
  const inlineQuery = userId ? `test_invite:${testId}:${userId}` : `test_invite:${testId}`;

  if (tg?.switchInlineQuery) {
    try {
      tg.switchInlineQuery(inlineQuery, ['users', 'groups', 'channels']);
      return;
    } catch (err) {
      console.error('[Share Test Invite] switchInlineQuery failed:', err);
    }
  }

  // Fallback: plain text + deep link
  const text = buildInviteText('test', title, description);
  const url = buildContentShareUrl('test', testId, title, userId);
  openShareDialog(text, url);
};

// Fallback when switchInlineQuery doesn't work
function fallbackShare(id: string, title: string, type: 'test' | 'quiz', refUserId?: number) {
  const url = buildContentShareUrl(type, id, title, refUserId);
  openTelegramTarget(url);
}

// Share referral link to Telegram chat
export const shareReferralLink = (referralCodeOrTelegramId: string | number, botUsername: string = BOT_USERNAME) => {
  const tg = getTelegram();
  const referralUrl = buildReferralUrl(referralCodeOrTelegramId, botUsername);
  const shareText = `🧠 Присоединяйся к Quipo!\n\nПроходи тесты, соревнуйся с друзьями и узнай себя лучше!`;

  if (tg) {
    // Telegram Desktop WebApp: prefer inline mode instead of `t.me/share/url`.
    if (isDesktopTelegramPlatform(tg.platform) && tg.switchInlineQuery) {
      tg.switchInlineQuery(`${shareText}\n\n${referralUrl}`, ['users', 'groups', 'channels']);
      return;
    }

    // Use share URL which opens Telegram's share dialog
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent(shareText)}`;

    if (!openTelegramTarget(shareUrl)) {
      // Fallback to switchInlineQuery
      tg.switchInlineQuery(`${shareText}\n\n${referralUrl}`, ['users', 'groups', 'channels']);
    }
  } else {
    // Fallback for non-Telegram environment
    if (navigator.share) {
      navigator.share({
        title: 'Quipo - Quiz & Tests',
        text: shareText,
        url: referralUrl,
      });
    } else {
      navigator.clipboard.writeText(referralUrl);
    }
  }
};


// Initialize Telegram WebApp
export const initTelegramApp = () => {
  const tg = getTelegram();
  if (tg) {
    // Tell Telegram the app is ready
    tg.ready();

    // Expand to full height
    tg.expand();

    // Disable vertical swipe to close (lock the Mini App)
    if (typeof tg.disableVerticalSwipes === 'function') {
      tg.disableVerticalSwipes();
    }

    // Enable closing confirmation (optional safety)
    if (typeof tg.enableClosingConfirmation === 'function') {
      tg.enableClosingConfirmation();
    }

    // NOTE: Theme is managed by useTheme hook only
    // We don't apply Telegram themeParams because they override CSS and break theme switching
    // This prevents conflicts between initTelegramApp and useTheme

    return true;
  }

  return false;
};

// Get Telegram color scheme (for useTheme)
export const getTelegramColorScheme = (): 'light' | 'dark' => {
  const tg = getTelegram();
  return tg?.colorScheme === 'dark' ? 'dark' : 'light';
};

// Main Button helpers
export const mainButton = {
  show: (text: string, onClick: () => void) => {
    const tg = getTelegram();
    if (tg) {
      tg.MainButton.setText(text);
      tg.MainButton.onClick(onClick);
      tg.MainButton.show();
    }
  },
  hide: () => {
    getTelegram()?.MainButton?.hide();
  },
  setText: (text: string) => {
    getTelegram()?.MainButton?.setText(text);
  },
};

// Back Button helpers
let activeBackButtonHandler: (() => void) | null = null;

export const backButton = {
  show: (onClick: () => void) => {
    const tg = getTelegram();
    if (tg) {
      // Telegram's onClick can add multiple handlers. Always replace the previous one.
      if (activeBackButtonHandler) {
        try {
          tg.BackButton.offClick(activeBackButtonHandler);
        } catch {
          // Ignore SDK oddities; worst case we still show back button.
        }
      }
      activeBackButtonHandler = onClick;
      tg.BackButton.onClick(onClick);
      tg.BackButton.show();
    }
  },
  hide: () => {
    const tg = getTelegram();
    if (!tg) return;

    if (activeBackButtonHandler) {
      try {
        tg.BackButton.offClick(activeBackButtonHandler);
      } catch {
        // Best-effort cleanup.
      } finally {
        activeBackButtonHandler = null;
      }
    }
    tg.BackButton.hide();
  },
};
