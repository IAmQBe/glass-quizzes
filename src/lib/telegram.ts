// Telegram WebApp SDK integration
// This file handles all Telegram-specific functionality

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    };
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
export const getTelegramUser = () => {
  const tg = getTelegram();
  return tg?.initDataUnsafe?.user || null;
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

// Share result to chat
export const shareResult = (score: number, percentile: number, verdict: string) => {
  const tg = getTelegram();
  if (tg) {
    // Use switchInlineQuery for sharing
    const shareText = `🧠 My score: ${score}/100 (Top ${percentile}%)\n${verdict}\n\nCan you beat me?`;
    
    // Try to share via inline mode or open a share link
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

// Initialize Telegram WebApp
export const initTelegramApp = () => {
  const tg = getTelegram();
  if (tg) {
    // Tell Telegram the app is ready
    tg.ready();
    
    // Expand to full height
    tg.expand();
    
    // Apply color scheme
    if (tg.colorScheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Set header and background colors
    if (tg.themeParams.bg_color) {
      tg.setHeaderColor(tg.themeParams.bg_color);
      tg.setBackgroundColor(tg.themeParams.secondary_bg_color || tg.themeParams.bg_color);
    }
    
    return true;
  }
  return false;
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