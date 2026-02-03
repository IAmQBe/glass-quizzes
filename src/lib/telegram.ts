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

// Share quiz result to chat
export const shareQuizResult = (
  quizId: string,
  quizTitle: string,
  score: number,
  totalQuestions: number,
  verdict?: string
) => {
  const tg = getTelegram();
  const botUsername = 'QuipoBot';
  const percentage = Math.round((score / totalQuestions) * 100);

  // Format: quiz_result:quizId:score:total:title - bot will parse this
  const shareQuery = `quiz_result:${quizId}:${score}:${totalQuestions}:${encodeURIComponent(quizTitle)}`;
  
  console.log('Sharing quiz result:', { quizId, score, totalQuestions, shareQuery, tgAvailable: !!tg });

  if (tg) {
    // Method 1: Try switchInlineQuery
    if (typeof tg.switchInlineQuery === 'function') {
      console.log('Using switchInlineQuery for quiz');
      tg.switchInlineQuery(shareQuery, ['users', 'groups', 'channels']);
      return;
    }
    
    // Method 2: Try opening share URL directly
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${botUsername}/app?startapp=quest_${quizId}`)}&text=${encodeURIComponent(`🧠 ${quizTitle}\n✅ Мой результат: ${score}/${totalQuestions} (${percentage}%)\nСможешь лучше? 👇`)}`;
    
    if (typeof tg.openTelegramLink === 'function') {
      tg.openTelegramLink(shareUrl);
      return;
    }
    
    if (typeof tg.openLink === 'function') {
      tg.openLink(shareUrl);
      return;
    }
  }
  
  // Fallback
  const shareUrl = `https://t.me/${botUsername}/app?startapp=quest_${quizId}`;
  if (navigator.share) {
    navigator.share({
      title: `🧠 ${quizTitle}`,
      text: `✅ Мой результат: ${score}/${totalQuestions} (${percentage}%)\nСможешь лучше?`,
      url: shareUrl,
    }).catch(() => {
      navigator.clipboard?.writeText(`🧠 ${quizTitle}\n✅ ${score}/${totalQuestions}\n${shareUrl}`);
    });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(`🧠 ${quizTitle}\n✅ ${score}/${totalQuestions}\n${shareUrl}`);
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

// Share personality test result
export const sharePersonalityTestResult = (
  resultTitle: string,
  description: string,
  testId: string,
  testTitle?: string
) => {
  const tg = getTelegram();
  const botUsername = 'QuipoBot';

  // Format: test_result:testId:resultTitle - bot will parse this  
  const shareQuery = `test_result:${testId}:${encodeURIComponent(resultTitle)}`;
  
  console.log('Sharing test result:', { resultTitle, testId, shareQuery, tgAvailable: !!tg });

  if (tg) {
    // Method 1: Try switchInlineQuery (opens chat picker with inline query)
    if (typeof tg.switchInlineQuery === 'function') {
      console.log('Using switchInlineQuery');
      tg.switchInlineQuery(shareQuery, ['users', 'groups', 'channels']);
      return;
    }
    
    // Method 2: Try opening share URL directly
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${botUsername}/app?startapp=test_${testId}`)}&text=${encodeURIComponent(`🎭 Я — ${resultTitle}!\nА ты кто? Пройди тест 👇`)}`;
    console.log('Using openTelegramLink:', shareUrl);
    
    if (typeof tg.openTelegramLink === 'function') {
      tg.openTelegramLink(shareUrl);
      return;
    }
    
    // Method 3: Open link externally
    if (typeof tg.openLink === 'function') {
      tg.openLink(shareUrl);
      return;
    }
  }
  
  // Fallback for web browser or if Telegram methods fail
  const shareUrl = `https://t.me/${botUsername}/app?startapp=test_${testId}_ref_share`;
  console.log('Using fallback share');
  
  if (navigator.share) {
    navigator.share({
      title: `🎭 Я — ${resultTitle}!`,
      text: description,
      url: shareUrl,
    }).catch(() => {
      // If share fails, copy to clipboard
      navigator.clipboard?.writeText(`🎭 Я — ${resultTitle}!\nПройди тест: ${shareUrl}`);
    });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(`🎭 Я — ${resultTitle}!\nПройди тест: ${shareUrl}`);
  }
};

// Share referral link to Telegram chat
export const shareReferralLink = (referralCode: string, botUsername: string = 'MindTestBot') => {
  const tg = getTelegram();
  const referralUrl = `https://t.me/${botUsername}?start=${referralCode}`;
  const shareText = `🧠 Присоединяйся к Mind Test!\n\nПроходи тесты, соревнуйся с друзьями и узнай себя лучше!\n\n${referralUrl}`;

  if (tg) {
    tg.switchInlineQuery(shareText, ['users', 'groups', 'channels']);
  } else {
    // Fallback for non-Telegram environment
    if (navigator.share) {
      navigator.share({
        title: 'Mind Test',
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