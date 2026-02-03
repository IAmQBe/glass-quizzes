# Mind Test Design System

> Telegram Mini App Quiz Game — Native iOS "Liquid Glass" Style

## 🎨 Design Philosophy

This app follows the **native Telegram iOS aesthetic** with these core principles:
- Clean, minimal interface with generous whitespace
- Soft shadows and subtle depth
- Smooth animations and haptic feedback
- Full light/dark theme support synchronized with Telegram
- Mobile-first design (max-width: 430px)

---

## 🎯 Color System

### Semantic Tokens

All colors use CSS custom properties mapped to Tailwind classes. **Never use hardcoded colors.**

| Token | Tailwind Class | Light Mode | Dark Mode | Usage |
|-------|---------------|------------|-----------|-------|
| `--background` | `bg-background` | `hsl(210 20% 96%)` | `hsl(210 11% 11%)` | Page background |
| `--foreground` | `text-foreground` | `hsl(0 0% 0%)` | `hsl(0 0% 100%)` | Primary text |
| `--card` | `bg-card` | `hsl(0 0% 100%)` | `hsl(210 11% 15%)` | Card backgrounds |
| `--card-foreground` | `text-card-foreground` | `hsl(0 0% 0%)` | `hsl(0 0% 100%)` | Card text |
| `--primary` | `bg-primary` | `hsl(211 100% 50%)` | `hsl(211 89% 63%)` | Telegram blue |
| `--primary-foreground` | `text-primary-foreground` | `hsl(0 0% 100%)` | `hsl(0 0% 100%)` | Text on primary |
| `--secondary` | `bg-secondary` | `hsl(210 20% 96%)` | `hsl(210 11% 11%)` | Secondary bg |
| `--muted` | `bg-muted` | `hsl(210 20% 96%)` | `hsl(210 11% 11%)` | Muted areas |
| `--muted-foreground` | `text-muted-foreground` | `hsl(0 0% 50%)` | `hsl(210 8% 56%)` | Hint text |
| `--destructive` | `bg-destructive` | `hsl(0 79% 55%)` | `hsl(0 79% 55%)` | Error/delete |
| `--border` | `border-border` | `hsl(0 0% 90%)` | `hsl(210 11% 22%)` | Borders |

### State Colors (with dark mode)

```tsx
// ✅ Success
className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"

// ⚠️ Warning
className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200"

// ❌ Error
className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"

// ℹ️ Info
className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"
```

### Telegram Theme Variables

The app uses Telegram's native theme parameters:

```css
--tg-theme-bg-color          /* Main background */
--tg-theme-secondary-bg-color /* Secondary background */
--tg-theme-text-color        /* Primary text */
--tg-theme-hint-color        /* Hint/subtitle text */
--tg-theme-link-color        /* Links */
--tg-theme-button-color      /* Button background */
--tg-theme-button-text-color /* Button text */
--tg-theme-accent-text-color /* Accent text */
--tg-theme-destructive-text-color /* Destructive actions */
--tg-theme-section-bg-color  /* Section/card background */
--tg-theme-separator-color   /* Dividers */
```

---

## 📝 Typography

### Font Stack
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
```

### Text Styles

| Style | Classes | Usage |
|-------|---------|-------|
| Heading 1 | `text-2xl font-bold` | Page titles |
| Heading 2 | `text-xl font-semibold` | Section titles |
| Heading 3 | `text-lg font-semibold` | Card titles |
| Body | `text-base` | Regular text |
| Small | `text-sm` | Secondary info |
| Caption | `text-xs text-muted-foreground` | Hints, timestamps |

### Typography Rules
- ❌ Avoid UPPERCASE text
- ✅ Use sentence case for buttons and labels
- ✅ Use `font-medium` or `font-semibold` for emphasis

---

## 📦 Components

### Cards / Sections

```tsx
// Standard card
<div className="bg-card rounded-2xl p-4">
  {/* content */}
</div>

// Using tg-section class
<div className="tg-section p-4">
  {/* content */}
</div>

// Card with shadow (Card component)
import { Card } from "@/components/ui/card";
<Card className="p-4">
  {/* content */}
</Card>
```

### Buttons

```tsx
import { Button } from "@/components/ui/button";

// Primary (Telegram blue)
<Button className="w-full">Continue</Button>

// Secondary
<Button variant="secondary" className="w-full">Cancel</Button>

// Ghost
<Button variant="ghost" size="icon">
  <Settings className="h-5 w-5" />
</Button>

// Destructive
<Button variant="destructive">Delete</Button>

// Challenge button (orange gradient)
<Button className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 rounded-xl shadow-lg">
  ⚔️ Challenge
</Button>
```

### List Items (Cells)

```tsx
// Standard cell
<div className="tg-cell">
  <div className="flex-1">
    <p className="font-medium">Title</p>
    <p className="text-sm text-muted-foreground">Subtitle</p>
  </div>
  <ChevronRight className="h-5 w-5 text-muted-foreground" />
</div>

// With icon
<div className="flex items-center gap-3 p-4 bg-card rounded-xl">
  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
    <Star className="h-5 w-5 text-primary" />
  </div>
  <div className="flex-1">
    <p className="font-medium">Achievement</p>
    <p className="text-sm text-muted-foreground">Description</p>
  </div>
</div>
```

### Input Fields

```tsx
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

<Input 
  placeholder="Enter text..."
  className="bg-secondary"
/>

<Textarea 
  placeholder="Description..."
  className="bg-secondary min-h-[100px]"
/>
```

### Switches / Toggles

```tsx
import { Switch } from "@/components/ui/switch";

<div className="flex items-center justify-between p-4 bg-card rounded-xl">
  <div>
    <p className="font-medium">Enable notifications</p>
    <p className="text-sm text-muted-foreground">Get updates</p>
  </div>
  <Switch checked={enabled} onCheckedChange={setEnabled} />
</div>
```

### Tabs

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

<Tabs defaultValue="tab1" className="w-full">
  <TabsList className="grid w-full grid-cols-2 bg-secondary">
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>
```

### Badges

```tsx
import { Badge } from "@/components/ui/badge";

<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Error</Badge>

// Custom colored badge
<Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200">
  +10 🍿
</Badge>
```

---

## 🎭 Custom Icons

### PopcornIcon (Likes)
```tsx
import { PopcornIcon } from "@/components/icons/PopcornIcon";

<PopcornIcon className="w-5 h-5" filled={isLiked} />
```

### BookmarkIcon (Saves)
```tsx
import { BookmarkIcon } from "@/components/icons/BookmarkIcon";

<BookmarkIcon className="w-5 h-5" filled={isSaved} />
```

---

## 🌓 Theme System

### Theme Hook
```tsx
import { useTheme } from "@/hooks/useTheme";

const { theme, setTheme, isDark } = useTheme();

// Toggle theme
<Button 
  variant="ghost" 
  size="icon"
  onClick={() => setTheme(isDark ? 'light' : 'dark')}
>
  {isDark ? <Sun /> : <Moon />}
</Button>
```

### Dark Mode Classes
Always provide dark mode variants for colored elements:

```tsx
// Background colors
className="bg-green-100 dark:bg-green-900/30"

// Text colors
className="text-green-800 dark:text-green-200"

// Borders
className="border-green-200 dark:border-green-800"
```

---

## ✨ Animations

### Framer Motion
```tsx
import { motion } from "framer-motion";

// Fade in + slide up
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>

// Scale on tap
<motion.button
  whileTap={{ scale: 0.98 }}
>

// Staggered list
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};
```

### Tailwind Animations (from config)
```tsx
className="animate-fade-in"      // Fade in
className="animate-slide-up"     // Slide up + fade
className="animate-pulse-glow"   // Pulsing glow effect
```

---

## 📱 Telegram Integration

### WebApp Access
```tsx
const tg = window.Telegram?.WebApp;

// User info
const user = tg?.initDataUnsafe?.user;
const userId = user?.id;
const username = user?.username;
const firstName = user?.first_name;

// Theme
const colorScheme = tg?.colorScheme; // 'light' | 'dark'

// Haptic feedback
tg?.HapticFeedback?.impactOccurred("light");   // light, medium, heavy
tg?.HapticFeedback?.notificationOccurred("success"); // success, warning, error
tg?.HapticFeedback?.selectionChanged();
```

### Telegram Utilities
```tsx
import { 
  hapticFeedback, 
  openTelegramLink, 
  shareReferralLink 
} from "@/lib/telegram";

// Haptic
hapticFeedback("medium");

// Open link in Telegram
openTelegramLink("https://t.me/channel");

// Share referral
shareReferralLink("ABC123"); // Opens share dialog
```

---

## 📐 Layout & Spacing

### Container
```tsx
// Main container (mobile-first, max 430px)
<div className="container mx-auto px-4 py-6">
```

### Spacing Scale
| Class | Size | Usage |
|-------|------|-------|
| `gap-1` / `space-y-1` | 4px | Tight spacing |
| `gap-2` / `space-y-2` | 8px | Compact spacing |
| `gap-3` / `space-y-3` | 12px | Default spacing |
| `gap-4` / `space-y-4` | 16px | Section spacing |
| `gap-6` / `space-y-6` | 24px | Large spacing |

### Border Radius
```tsx
rounded-lg   // 14px (--radius)
rounded-xl   // 18px
rounded-2xl  // 22px
rounded-full // 9999px (circles, pills)
```

---

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui base components
│   ├── icons/           # Custom icon components
│   │   ├── PopcornIcon.tsx
│   │   └── BookmarkIcon.tsx
│   ├── BannerCarousel.tsx
│   ├── BottomNav.tsx
│   ├── QuizCard.tsx
│   ├── TasksBlock.tsx
│   └── ...
├── screens/             # Full page screens
│   ├── ProfileScreen.tsx
│   ├── QuizScreen.tsx
│   ├── LeaderboardScreen.tsx
│   └── ...
├── pages/               # Router pages
│   ├── Index.tsx
│   └── NotFound.tsx
├── hooks/               # Custom React hooks
│   ├── useTheme.ts
│   ├── useProfile.ts
│   ├── useTasks.ts
│   └── ...
├── lib/                 # Utilities
│   ├── telegram.ts
│   └── utils.ts
├── integrations/
│   └── supabase/
│       ├── client.ts    # Supabase client (auto-generated)
│       └── types.ts     # Database types (auto-generated)
├── index.css            # Global styles & CSS variables
└── App.tsx              # Main app component
```

---

## ✅ Checklist for New Components

1. ☐ Use semantic color tokens (`bg-card`, `text-foreground`, etc.)
2. ☐ Include dark mode variants for colored elements
3. ☐ Use shadcn/ui components where applicable
4. ☐ Add framer-motion animations for entrances
5. ☐ Include haptic feedback for interactions
6. ☐ Follow mobile-first responsive design
7. ☐ Use proper TypeScript types
8. ☐ Import from `@/` path aliases
