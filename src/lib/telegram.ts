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
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
}

// Get Telegram WebApp instance
export const getTelegram = (): TelegramWebApp | null => {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
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

const BOT_USERNAME = 'QuipoBot';

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

const buildBotStartUrl = (type: 'test' | 'quiz', id: string, title?: string, refUserId?: number) => {
  const startParam = buildShareStartParam(type, id, title, refUserId);
  return `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(startParam)}`;
};

const openShareDialog = (text: string, url: string) => {
  const tg = getTelegram();
  if (tg) {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    if (tg.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else if (tg.openLink) {
      tg.openLink(shareUrl);
    } else {
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
  const text = buildInviteText('quiz', title, description);
  const url = buildBotStartUrl('quiz', quizId, undefined, userId);
  openShareDialog(text, url);
};

export const sharePersonalityTestInvite = (testId: string, title: string, description?: string | null) => {
  const tg = getTelegram();
  const userId = tg?.initDataUnsafe?.user?.id;
  const text = buildInviteText('test', title, description);
  const url = buildBotStartUrl('test', testId, title, userId);
  openShareDialog(text, url);
};

// Fallback when switchInlineQuery doesn't work
function fallbackShare(id: string, title: string, type: 'test' | 'quiz', refUserId?: number) {
  const url = buildBotStartUrl(type, id, title, refUserId);

  const tg = window.Telegram?.WebApp;
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(url);
  } else {
    window.open(url, '_blank');
  }
}

// Share referral link to Telegram chat
export const shareReferralLink = (referralCode: string, botUsername: string = 'QuipoBot') => {
  const tg = getTelegram();
  const referralUrl = `https://t.me/${botUsername}?start=ref_${referralCode}`;
  const shareText = `🧠 Присоединяйся к Quipo!\n\nПроходи тесты, соревнуйся с друзьями и узнай себя лучше!`;

  if (tg) {
    // Use share URL which opens Telegram's share dialog
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent(shareText)}`;

    // Try openTelegramLink first (works in Mini Apps)
    if (tg.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else if (tg.openLink) {
      tg.openLink(shareUrl);
    } else {
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
export const backButton = {
  show: (onClick: () => void) => {
    const tg = getTelegram();
    if (tg) {
      tg.BackButton.onClick(onClick);
      tg.BackButton.show();
    }
  },
  hide: () => {
    getTelegram()?.BackButton?.hide();
  },
};
