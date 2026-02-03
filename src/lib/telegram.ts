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
export const sharePersonalityTestResult = (
  resultTitle: string,
  description: string,
  testId: string,
  testTitle?: string
) => {
  const tg = window.Telegram?.WebApp;
  const userId = tg?.initDataUnsafe?.user?.id;

  // Format: test_result:testId:resultTitle:refUserId (inline handler expects this)
  const titlePart = resultTitle.slice(0, 30).replace(/:/g, ' ');
  // Include user ID as referrer for tracking
  const inlineQuery = userId
    ? `test_result:${testId}:${encodeURIComponent(titlePart)}:${userId}`
    : `test_result:${testId}:${encodeURIComponent(titlePart)}`;

  console.log('[Share] Attempting switchInlineQuery:', inlineQuery);

  if (tg?.switchInlineQuery) {
    try {
      // Opens chat selector directly - user picks chat, rich card is sent
      tg.switchInlineQuery(inlineQuery, ['users', 'groups', 'channels']);
      console.log('[Share] switchInlineQuery called successfully');
    } catch (err) {
      console.error('[Share] switchInlineQuery error:', err);
      // Fallback: open bot with share parameter
      fallbackShare(testId, titlePart, 'test', userId);
    }
  } else {
    console.log('[Share] switchInlineQuery not available, using fallback');
    fallbackShare(testId, titlePart, 'test', userId);
  }
};

// Fallback when switchInlineQuery doesn't work
function fallbackShare(id: string, title: string, type: 'test' | 'quiz', refUserId?: number) {
  const botUsername = 'QuipoBot';
  // Include referrer user ID in the start parameter
  const refPart = refUserId ? `_ref${refUserId}` : '';
  const startParam = type === 'test'
    ? `share_${id}_${title}${refPart}`
    : `qshare_${id}${refPart}`;
  const url = `https://t.me/${botUsername}?start=${encodeURIComponent(startParam)}`;

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