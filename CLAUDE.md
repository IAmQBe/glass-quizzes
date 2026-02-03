# Glass Quizzes - Project Documentation

> **Single source of truth** — все архитектурные решения, изменения API/схемы БД фиксируются здесь.

---

## 🗺️ PROJECT MAP (Карта проекта)

### Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                    TELEGRAM MINI APP                            │
├─────────────────────────────────────────────────────────────────┤
│  User opens Mini App via:                                       │
│  - Direct link (t.me/QuipoBot/app)                              │
│  - Inline button in chat                                        │
│  - Bot /start command                                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vite + React)                      │
│                    VITE_MINI_APP_URL (твой Netlify URL)          │
├─────────────────────────────────────────────────────────────────┤
│  Entry: src/main.tsx → App.tsx → pages/Index.tsx                │
│                                                                 │
│  Screens:            Components:          Hooks:                │
│  ├── Home            ├── BottomNav        ├── useQuizzes        │
│  ├── QuizScreen      ├── QuizCard         ├── useBanners        │
│  ├── ResultScreen    ├── BannerCarousel   ├── useTheme ⚠️       │
│  ├── ProfileScreen   ├── TasksBlock       ├── usePvp            │
│  ├── AdminPanel      ├── ui/* (shadcn)    ├── useTasks          │
│  └── PvpLobbyScreen  └── icons/*          └── useAuth           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE (PostgreSQL + RLS)                  │
│                    wyiwdhtefbnjdrdbgaas.supabase.co             │
├─────────────────────────────────────────────────────────────────┤
│  Tables:                                                        │
│  ├── profiles         ← User data (telegram_id)                 │
│  ├── quizzes          ← Quiz metadata                           │
│  ├── questions        ← Questions with options JSONB            │
│  ├── quiz_results     ← Completed attempts                      │
│  ├── banners          ← Promotional banners                     │
│  ├── tasks            ← Admin tasks with rewards                │
│  ├── pvp_rooms        ← Real-time PvP                           │
│  └── verdicts         ← Score→verdict mapping                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER (Node.js + TypeScript)                │
│                    server/src/index.ts (port 3001)              │
├─────────────────────────────────────────────────────────────────┤
│  Bot: grammY                  API: Hono                         │
│  ├── /start command           ├── GET /api/quizzes              │
│  ├── Inline mode              ├── POST /api/attempts            │
│  └── Webhook handler          └── Admin routes                  │
└─────────────────────────────────────────────────────────────────┘
```

### Точки входа

| Entry Point | File | Description |
|-------------|------|-------------|
| **Frontend** | `src/main.tsx` | React app bootstrap |
| **App Root** | `src/App.tsx` | React Query + Router setup |
| **Main Page** | `src/pages/Index.tsx` | Screen manager, state machine |
| **Server** | `server/src/index.ts` | Hono API + grammY bot |
| **Bot** | `server/src/bot/index.ts` | Telegram bot handlers |
| **Styles** | `src/index.css` | CSS variables + tg-* classes |

### Поток данных

```
User action → React state → useQuery/useMutation → Supabase RLS → PostgreSQL
                                ↓
                         React Query cache
                                ↓
                         UI update (optimistic)
```

---

## 🚀 КАК ЗАПУСТИТЬ

### 1. Локальный запуск Frontend
```bash
cd glass-quizzes
npm install
npm run dev                    # http://localhost:5173
```

### 2. Локальный запуск Server (Bot + API)
```bash
npm run server:install         # Install server deps
npm run server                 # http://localhost:3001
```

### 3. Локальная БД (опционально)
```bash
npm run db:up                  # Start PostgreSQL via Docker
npm run db:down                # Stop
npm run db:logs                # View logs
```

### 4. Тесты и линтер
```bash
npm run test                   # Vitest (run once)
npm run test:watch             # Watch mode
npm run lint                   # ESLint
```

### 5. Сборка и деплой
```bash
npm run build                  # Build to /dist
npx netlify link --id YOUR_SITE_ID   # один раз после переезда
npx netlify deploy --prod --dir=dist
```

### 6. После переезда на новый Netlify
1. Создай новый сайт в Netlify (или используй существующий).
2. В корне проекта: `npx netlify link --id <новый Site ID>`.
3. В `.env` поставь новый URL: `VITE_MINI_APP_URL=https://ТВОЙ-САЙТ.netlify.app`.
4. В BotFather: Menu Button URL и Mini App URL → тот же `https://ТВОЙ-САЙТ.netlify.app`.
5. Деплой: `npm run build && npx netlify deploy --prod --dir=dist`.
6. Перезапусти бота (он читает `VITE_MINI_APP_URL` из .env).

---

## ⚙️ КОНФИГИ И СЕКРЕТЫ

| File | Purpose |
|------|---------|
| `.env` | **Секреты** (gitignored) — создать из `.env.example` |
| `.env.example` | Шаблон переменных |
| `VITE_*` | Доступны во фронтенде |
| `SUPABASE_SERVICE_KEY` | Только для сервера (RLS bypass) |
| `ADMIN_TELEGRAM_IDS` | ID админов (server + frontend) |
| `VITE_ADMIN_TELEGRAM_IDS` | ID админов для фронта |

### Критические ENV переменные
```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
TELEGRAM_BOT_TOKEN=...
VITE_ADMIN_TELEGRAM_IDS=47284045
```

---

## 🎨 ДИЗАЙН-СИСТЕМА (КРИТИЧЕСКИ ВАЖНО!)

### ⚠️ Почему дизайн ломается

1. **Inline стили перезаписывают CSS классы** — НЕ использовать `style.setProperty()`
2. **`applyTelegramTheme()` УБРАН** — ломал переключение тем
3. **useTheme — ЕДИНСТВЕННЫЙ источник** для dark/light mode
4. **Hardcoded colors** — ЗАПРЕЩЕНЫ (`bg-white`, `text-black`)
5. **CSS var indirection УБРАН** — вместо `--background: var(--tg-theme-...)` используем прямые HSL значения

### Файлы дизайн-системы

| File | What it controls |
|------|------------------|
| `src/index.css` | CSS переменные `:root` и `.dark`, tg-* классы |
| `tailwind.config.ts` | Цвета, шрифты, анимации, радиусы |
| `.cursorrules` | AI rules для Cursor |
| `DESIGN_SYSTEM.md` | Полная документация |

### Как работает тема

```
1. При загрузке: useTheme.ts → getInitialTheme() → applyThemeToDOM() (ДО React)
2. При переключении: toggleTheme() → localStorage + classList.add/remove('dark')
3. CSS: :root = light (прямые HSL значения), .dark = dark (прямые HSL значения)
4. initTelegramApp() НЕ ТРОГАЕТ тему
5. body/root используют background-color: hsl(var(--background)) вместо Tailwind класса
```

### Правильные цвета (семантические токены)

```tsx
// ✅ ПРАВИЛЬНО
<div className="bg-background text-foreground">
<div className="bg-card text-card-foreground">
<div className="bg-secondary text-secondary-foreground">
<div className="text-muted-foreground">

// ❌ НЕПРАВИЛЬНО (сломает тему)
<div className="bg-white text-black">
<div className="bg-[#ffffff]">
```

### State colors (с dark mode)

```tsx
// Success
className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"

// Warning
className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200"

// Error
className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
```

### Custom tg-* классы

```tsx
.tg-section     // Card with shadow
.tg-cell        // List item (44px)
.tg-button      // Primary button
.tg-button-secondary
.tg-option      // Quiz answer
.tg-progress    // Progress bar
```

---

## 📦 ДОМЕННЫЕ СУЩНОСТИ

### Frontend Types (`src/types/quiz.ts`)
- `Question` — вопрос с опциями
- `QuizResult` — результат (score, percentile, verdict)
- `UserStats` — статистика пользователя
- `Friend` — друг для сравнения

### Database Tables (Supabase)
- `profiles` — пользователи (telegram_id)
- `quizzes` — квизы (title, is_published, like_count)
- `questions` — вопросы (options JSONB, correct_answer)
- `quiz_results` — результаты
- `banners` — баннеры
- `tasks` — задания с наградами
- `pvp_rooms` — PvP комнаты
- `verdicts` — вердикты по score

---

## ❌ ЧТО ОТСУТСТВУЕТ В РЕПОЗИТОРИИ

1. **Тестовые данные в Supabase** — нужно выполнить `supabase/seed_data.sql`
2. **Типы Supabase** — `src/integrations/supabase/types.ts` может быть устаревшим
3. **E2E тесты** — только unit test example
4. **CI/CD** — нет GitHub Actions
5. **Monitoring** — нет Sentry/PostHog интеграции
6. **Rate limiting** — не реализовано на сервере

---

## Project Overview

**Glass Quizzes** — Viral Quiz/Quest для Telegram с inline-вызовом в чатах и Mini App для прохождения.

- **Repo**: IAmQBe/glass-quizzes
- **UI Source**: Lovable.dev (Liquid Glass design — НЕ ПЕРЕПИСЫВАТЬ)
- **Deploy**: Netlify — URL из VITE_MINI_APP_URL (.env)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vite + React 18 + TypeScript |
| Routing | react-router-dom (SPA) |
| Styling | Tailwind CSS + shadcn/ui + custom `tg-*` classes |
| State | @tanstack/react-query |
| Database | Supabase (PostgreSQL + RLS) / Postgres local via Docker |
| Telegram Mini App | @telegram-apps/sdk-react |
| Telegram Bot | grammY (Node.js + TypeScript) |
| Auth | Telegram WebApp initData validation (server-side) |

## Folder Structure

```
glass-quizzes/
├── public/                  # Static assets
├── src/
│   ├── components/          # Reusable UI (BannerCarousel, QuizCard, ui/*)
│   ├── screens/             # Full-screen views (Welcome, Quiz, Result, Compare, Profile, Admin)
│   ├── hooks/               # React hooks (useQuiz, useQuizzes, useBanners, useAuth)
│   ├── pages/               # Route pages (Index, NotFound)
│   ├── integrations/        # External services (supabase/)
│   ├── lib/                 # Utilities (telegram.ts, utils.ts)
│   ├── data/                # Mock/sample data
│   ├── types/               # TypeScript types
│   └── test/                # Tests
├── server/                  # [NEW] Bot + API server
│   ├── bot/                 # Telegram bot (grammY)
│   ├── api/                 # API routes (Express/Hono)
│   └── lib/                 # Shared server utils
├── supabase/                # Supabase config + migrations
├── scripts/                 # Backup/deploy scripts
├── backups/                 # [gitignored] DB dumps, snapshots
├── CLAUDE.md                # This file
├── .env.example             # Environment template
└── docker-compose.yml       # Local Postgres for dev
```

## Existing Screens (Lovable UI)

1. **Home** (`pages/Index.tsx`) — banner carousel + leaderboard preview + quiz tabs (trending/all) + sorting + search
2. **OnboardingCarousel** — 5-slide intro (Mind Test, Соревнуйся, Создавай, Live квизы, Готов начать?) + swipe gestures
3. **QuizScreen** — 1 question per screen, progress bar, animated transitions
4. **ResultScreen** — score display + percentile + verdict emoji + share/challenge/retry/profile buttons
5. **CompareScreen** — You vs Friend cards with VS badge, waiting state if friend hasn't completed
6. **ProfileScreen** — avatar, stats grid, history tabs (completed/created/saved), admin button
7. **AdminPanel** — tabs (Quizzes/Banners/Stats), CRUD with publish/unpublish/delete
8. **LeaderboardScreen** — Top-3 podium + full leaderboard list with premium badges
9. **CreateQuizScreen** — 3-step wizard (info → questions → preview) with form validation
10. **LiveQuizScreen** — Real-time quiz hosting (lobby → playing → results)
11. **PvpLobbyScreen** — [NEW] PvP room creation/joining (menu → creating → waiting → joining)
12. **CreatorsScreen** — [NEW] Top quiz creators (Gallery tab in BottomNav)

## Existing UI Components

### Custom Telegram-style Classes (`index.css`)
| Class | Description |
|-------|-------------|
| `tg-section` | Glass card container with shadow |
| `tg-cell` | Row item (44px min-height) with active state |
| `tg-button` | Primary button (17px font, rounded-xl) |
| `tg-button-secondary` | Secondary button (bg-secondary, text-primary) |
| `tg-button-text` | Text-only button |
| `tg-option` | Quiz answer option (section + border on select) |
| `tg-progress` / `tg-progress-fill` | Progress bar |
| `tg-avatar` | Circle container for icons/avatars |
| `tg-score` | Large score number (6xl, primary color) |
| `tg-stat` | Stat card for grid layout |
| `tg-separator` | Horizontal line |
| `tg-header` | Section header (uppercase, small) |
| `tg-hint` | Hint text (muted) |
| `safe-bottom` / `safe-top` | Safe area padding |

### Reusable Components
| Component | Props | Description |
|-----------|-------|-------------|
| `BannerCarousel` | `banners[]` | Auto-swipe carousel with dots, swipe gestures |
| `QuizCard` | `id, title, ..., likeCount, saveCount, isLiked, isSaved, onLike, onSave` | Quiz card with like/save buttons |
| `QuizShowcase` | `quizzes[], isLoading, onQuizSelect, likeIds, saveIds, onToggleLike, onToggleSave` | Grid of QuizCards with interactions |
| `BottomNav` | `activeTab, onTabChange` | Bottom nav (Home, Gallery, Create, Top, Profile) — Create=center floating |
| `LeaderboardPreview` | `entries[], onViewAll` | Compact leaderboard widget for home |
| `OnboardingCarousel` | `onComplete` | 5-slide swipeable onboarding flow |
| `TasksBlock` | — | [NEW] Tasks list with rewards (popcorns), completed tracking |
| `AdminAnalytics` | — | Admin stats dashboard (overview, funnel, top quizzes) |
| `NavLink` | react-router NavLink wrapper | Adds activeClassName support |

### Custom Icons (`components/icons/`)
| Icon | Description |
|------|-------------|
| `PopcornIcon` | Like/popcorn icon for engagement |
| `BookmarkIcon` | Save/bookmark icon |

### shadcn/ui Components (`components/ui/`)
Full set: button, card, dialog, drawer, toast, tabs, form, input, select, checkbox, switch, progress, skeleton, avatar, badge, tooltip, popover, dropdown-menu, etc.

## Existing Hooks

| Hook | Returns | Description |
|------|---------|-------------|
| `usePublishedQuizzes()` | `{ data: Quiz[], isLoading }` | Fetch published quizzes with like/save counts |
| `useQuizWithQuestions(id)` | `{ data: { quiz, questions } }` | Fetch quiz + questions |
| `useMyQuizzes()` | `{ data: Quiz[] }` | Current user's quizzes |
| `useCreateQuiz()` | mutation | Create new quiz |
| `useSubmitQuizResult()` | mutation | Submit quiz result |
| `useBanners()` | `{ data: Banner[] }` | Fetch active banners |
| `useIsAdmin()` | `{ data: boolean }` | Check if current user is admin |
| `useQuiz()` | quiz state machine | Local quiz flow state (welcome→quiz→result) |
| `useFavorites()` | `{ data: Favorite[] }` | User's saved quizzes with details |
| `useFavoriteIds()` | `{ data: Set<string> }` | Set of saved quiz IDs |
| `useToggleFavorite()` | mutation | Add/remove from favorites |
| `useLikeIds()` | `{ data: Set<string> }` | Set of liked quiz IDs |
| `useToggleLike()` | mutation | Like/unlike quiz (optimistic update) |
| `useLiveQuiz()` | `{ ... }` | Live quiz state management (host/join/play) |
| `usePvp*` | various | [NEW] PvP challenges & rooms (create/join/subscribe/update) |
| `useTasks*` | various | [NEW] Tasks system (list/complete/admin CRUD) |
| `useProfile` | `{ data: Profile }` | [NEW] Current user profile with referral code |
| `useReferralCount` | `{ data: number }` | [NEW] Count of referred users |

## Existing Data/Types

### Types (`types/quiz.ts`)
- `Question` — `{ id, text, options[] }`
- `QuizResult` — `{ score, maxScore, percentile, verdict, verdictEmoji }`
- `UserStats` — `{ bestScore, testsCompleted, globalRank, activeChallenges }`
- `Friend` — `{ id, name, avatar?, score?, hasCompleted }`

### Mock Data (`data/quizData.ts`)
- `sampleQuestions[]` — 5 demo questions
- `verdicts[]` — score ranges → verdict text + emoji
- `getVerdict(score)` — lookup function
- `calculateResult(answers)` — scoring logic (currently mock)

## Telegram Integration (`lib/telegram.ts`)

| Function | Description |
|----------|-------------|
| `getTelegram()` | Get WebApp instance |
| `isTelegramWebApp()` | Check if in Telegram |
| `getTelegramUser()` | Get current user info |
| `haptic.impact/notification/selection()` | Haptic feedback |
| `shareResult(score, percentile, verdict)` | Share via switchInlineQuery |
| `challengeFriend()` | Challenge via switchInlineQuery |
| `initTelegramApp()` | Initialize: ready(), expand(), theme |
| `mainButton.show/hide/setText()` | MainButton control |
| `backButton.show/hide()` | BackButton control |

## Database Schema (Supabase)

### Core Tables
| Table | Key Fields | Description |
|-------|------------|-------------|
| `profiles` | id, telegram_id, username, first_name, has_telegram_premium, onboarding_completed | User profiles synced from Telegram |
| `quizzes` | id, title, created_by, like_count, save_count, rating, is_published | Quiz metadata with engagement metrics |
| `questions` | id, quiz_id, question_text, options JSONB, correct_answer, order_index | Quiz questions |
| `quiz_results` | id, quiz_id, user_id, score, percentile, answers JSONB | Completed quiz attempts |
| `banners` | id, title, image_url, link_url, link_type, display_order, is_active | Promotional banners |
| `user_roles` | id, user_id, role ENUM (admin/user) | Role-based access |

### Engagement Tables
| Table | Key Fields | Description |
|-------|------------|-------------|
| `quiz_likes` | quiz_id, user_id | Like/popcorn reactions |
| `favorites` | quiz_id, user_id | Saved/bookmarked quizzes |
| `quiz_ratings` | quiz_id, user_id, rating (1-5) | Star ratings |

### Live Quiz Tables
| Table | Key Fields | Description |
|-------|------------|-------------|
| `live_quizzes` | id, quiz_id, host_user_id, status, current_question, is_paid, price_stars | Live quiz sessions |
| `live_quiz_participants` | live_quiz_id, user_id, score, correct_answers, total_time_ms | Participants & scores |
| `live_quiz_answers` | live_quiz_id, user_id, question_index, answer_index, is_correct, time_ms | Individual answers |
| `live_quiz_reactions` | live_quiz_id, user_id, emoji | Real-time reactions |

### System Tables
| Table | Key Fields | Description |
|-------|------------|-------------|
| `leaderboard_seasons` | id, name, start_date, end_date, is_active | Seasonal leaderboards |
| `app_settings` | key, value JSONB | Global app configuration |

### PvP Tables (NEW)
| Table | Key Fields | Description |
|-------|------------|-------------|
| `challenges` | id, challenger_id, opponent_id, status, scores, winner_id, expires_at | 1v1 challenges |
| `pvp_rooms` | id, code, host_id, guest_id, status, scores, current_question | Real-time PvP rooms |

### Tasks Tables (NEW)
| Table | Key Fields | Description |
|-------|------------|-------------|
| `tasks` | id, title, description, reward_amount, task_type, action_url, icon, is_active | Admin-managed tasks |
| `user_tasks` | user_id, task_id, completed_at | Completed tasks tracking |

### Referral Tables (NEW)
| Table | Key Fields | Description |
|-------|------------|-------------|
| `referrals` | referrer_id, referred_id, created_at | Referral tracking |

### Still Needed (Milestone B)
- `verdicts` — score→verdict mapping per quiz
- `shares` — share event tracking for viral metrics
- Server-side `admins` whitelist (or use env)

## API Endpoints (Planned)

### Public
- `GET /api/quests` — published quizzes list
- `GET /api/quests/:slug` — quiz with questions
- `POST /api/attempts/start` — start attempt (requires initData)
- `POST /api/attempts/:id/complete` — submit answers, get result
- `POST /api/shares` — log share event

### Admin (protected)
- CRUD `/api/admin/quests`
- CRUD `/api/admin/questions`
- CRUD `/api/admin/verdicts`
- CRUD `/api/admin/banners`
- `GET /api/admin/stats`

## Decisions Log

| Date | Decision | Why | Where |
|------|----------|-----|-------|
| 2024-02-03 | Use grammY for bot | Modern, TypeScript-native, good inline support | `server/bot/` |
| 2024-02-03 | Keep Supabase for DB | Already integrated in UI, has RLS | `supabase/` |
| 2024-02-03 | Add Express/Hono API | For initData validation + bot webhooks | `server/api/` |
| 2024-02-03 | Verdicts separate table | Flexible score→verdict mapping per quiz | DB schema |
| 2024-02-03 | Synced remote UI updates | Onboarding, Leaderboard, Create, Live Quiz, Likes/Saves | Frontend |
| 2024-02-03 | Live Quiz via Supabase Realtime | Already have Supabase, RLS works, no extra infra | `live_quizzes` tables |
| 2024-02-03 | Admin Analytics first tab | Most useful for admins, metrics at glance | AdminPanel |
| 2024-02-03 | Direct Supabase for analytics | Works without server running, simpler setup | AdminAnalytics |
| 2024-02-03 | PvP Rooms with codes | Easy sharing, real-time via Supabase subscriptions | PvpLobbyScreen |
| 2024-02-03 | Tasks replace Leaderboard preview | More engaging, earn rewards | TasksBlock |
| 2024-02-03 | Referral system | Growth through referrals, profiles.referral_code | ProfileScreen |
| 2024-02-03 | Challenge cooldown (1h) | Prevent spam, can_challenge_user RPC function | usePvp |
| 2024-02-03 | Telegram themeParams sync | Fix UI colors in Mini App by syncing Telegram colors to CSS vars | `telegram.ts` |
| 2024-02-03 | disableVerticalSwipes | Prevent accidental close of Mini App | `initTelegramApp()` |
| 2024-02-03 | BottomNav backdrop-blur | Glass effect, prevent content overlap | BottomNav |
| 2024-02-03 | useTheme respects localStorage | User-selected theme persists, system=Telegram theme | useTheme |
| 2024-02-03 | Admin by Telegram ID | VITE_ADMIN_TELEGRAM_IDS env var, no DB table needed | useIsAdmin |
| 2024-02-03 | Anonymous Supabase auth | signInAnonymously() for DB operations without Telegram auth | Index.tsx |
| 2024-02-03 | Full Admin CRUD | Create quizzes, banners, tasks directly in AdminPanel | AdminPanel |
| 2024-02-03 | useTheme единственный источник | Убрал управление темой из initTelegramApp, оставил только в useTheme | useTheme.ts, telegram.ts |
| 2024-02-03 | Тема применяется до React | applyThemeToDOM() вызывается на уровне модуля | useTheme.ts |
| 2024-02-03 | Seed data SQL | Тестовые квизы, вопросы, вердикты, баннеры, таски | supabase/seed_data.sql |
| 2024-02-03 | Убрали applyTelegramTheme | Inline стили ломали переключение темы | telegram.ts |
| 2024-02-03 | Explicit CSS values | Убрали CSS var indirection, прямые HSL значения | index.css |
| 2024-02-03 | Profile stats compact | grid-cols-4 gap-1.5, text-base, whitespace-nowrap | ProfileScreen.tsx |
| 2024-02-03 | Rank без toLocaleString | Убрал пробелы в числе для компактности | ProfileScreen.tsx |
| 2024-02-03 | Quiz moderation system | status field (draft/pending/published/rejected), admin notifications via bot | migrations, API, bot |
| 2026-02-03 | Personality Tests feature | Тесты типа "Кто ты из Симпсонов", отличаются от квизов логикой подсчёта | personality_tests tables, hooks, screens |
| 2026-02-03 | result_points JSONB | Каждый ответ даёт очки к нескольким результатам, гибко | personality_test_answers.result_points |
| 2026-02-03 | Tabs Квизы/Тесты на главной | Переключение между типами контента, тесты = purple accent | Index.tsx contentType state |
| 2026-02-03 | Bot moderation notifications | Уведомления админам при создании контента с inline кнопками | notifications.ts, moderation.ts |
| 2026-02-03 | Inline test: prefix | Поиск только тестов через test: или тест: в inline mode | inline.ts |
| 2024-02-03 | Image upload for quizzes | Supabase Storage bucket 'quiz-images', useImageUpload hook | CreateQuizScreen |
| 2024-02-03 | Real leaderboard | RPC functions get_leaderboard_by_*, useLeaderboard hook | LeaderboardScreen |
| 2024-02-03 | Real user stats | RPC function get_user_stats, useUserStats hook | Index.tsx, ProfileScreen |
| 2024-02-03 | Bot moderation handlers | approve_quiz/reject_quiz callbacks, notifyAdmins, notifyAuthor | server/bot/ |
| 2024-02-03 | CreatorsScreen real data | Replaced mock data with useLeaderboard('popcorns') | CreatorsScreen |
| 2026-02-03 | Рандомизация вопросов | Вопросы перемешиваются при старте квиза/теста (Fisher-Yates shuffle) | Index.tsx, PersonalityTestScreen |
| 2026-02-03 | Inline шаринг с картинкой | InlineQueryResultPhoto для результатов тестов с image_url | inline.ts |
| 2026-02-03 | Profile tabs: Мои/История/Saved | "Мои" = созданное, "История" = пройденное (квизы + тесты), "Saved" = сохранённое | ProfileScreen |
| 2026-02-03 | useMyQuizResults hook | История пройденных квизов пользователя (quiz_results join quizzes) | useQuizzes.ts |
| 2026-02-03 | Challenge & Gallery "soon" | Неактивные кнопки с badge "soon", toast при нажатии | BottomNav, Index.tsx |
| 2026-02-03 | Banner edit in admin | Полное редактирование баннеров (title, image, link, is_active) | AdminPanel |
| 2026-02-03 | Banners RLS fix | DISABLE RLS для banners таблицы (admin check на уровне приложения) | migrations/fix_banners_rls.sql |
| 2026-02-03 | Deep link start_param | Парсинг startParam при открытии Mini App, автооткрытие теста/квиза | Index.tsx |
| 2026-02-03 | Inline cache_time=0 | Отключили кэширование inline results для персонализации (refUserId) | inline.ts |
| 2026-02-03 | Уникальные inline result IDs | Добавили userId в ID inline результатов для избежания конфликтов | inline.ts |
| 2026-02-03 | Bot auto-start | startBot() вызывается автоматически при запуске bot/index.ts | server/bot/index.ts |
| 2026-02-03 | MINI_APP_URL fix | Исправлен URL в .env (quipobot.netlify.app → endearing-taiyaki-03c7aa.netlify.app) | .env |
| 2026-02-03 | Inline result ID без дефисов | Telegram требует alphanumeric ID, убраны дефисы из UUID | inline.ts |
| 2026-02-03 | Quiz result sharing | shareQuizResult() для шаринга результатов квизов с картинкой | telegram.ts, ResultScreen |
| 2026-02-03 | quiz_result: inline query | Обработка результатов квизов в inline mode (quiz_result:id:score:total:title) | inline.ts |
| 2026-02-03 | Mini App Short Name "app" | Создан Mini App в BotFather с Short Name для прямых ссылок t.me/QuipoBot/app | BotFather |
| 2026-02-03 | Direct Mini App links | buildDeepLink() теперь генерирует t.me/QuipoBot/app?startapp=... | inline.ts |
| 2026-02-03 | Sharing fallbacks | sharePersonalityTestResult/shareQuizResult: switchInlineQuery → openTelegramLink → openLink → navigator.share | telegram.ts |
| 2026-02-03 | Smooth animations | Плавные анимации вопросов/ответов: duration 0.4s, easeOutQuad, последовательное появление | QuizScreen, PersonalityTestScreen |
| 2026-02-03 | Touch-friendly options | Убрали hover на тач-устройствах, добавили touch-manipulation, -webkit-tap-highlight-color: transparent | index.css |
| 2026-02-03 | Netlify переезд | Документация и .env.example без хардкода URL; после переезда: VITE_MINI_APP_URL + netlify link + BotFather | CLAUDE.md, .env.example |
| 2026-02-03 | 1-click sharing | Прямой switchInlineQuery из Mini App для шаринга результатов (без редиректа в бота) | telegram.ts |
| 2026-02-03 | New Netlify: zingy-quokka | Новый деплой на zingy-quokka-ea065f.netlify.app | .env, BotFather |
| 2026-02-03 | Share caption fix | Улучшена логика shortDesc: пропускаются фразы "Я —"/"Ты —", слишком короткие, и содержащие title | inline.ts |
| 2026-02-03 | Referral tracking on share | При переходе по share-ссылке новый пользователь записывается как реферал (ref_telegram_id в start_param) | useCurrentProfile.ts |
| 2026-02-03 | Quiz timer | Рабочий таймер в квизах с обратным отсчётом, красный при <10сек, auto-submit при истечении | QuizScreen.tsx |
| 2026-02-03 | Squads (Попкорн-команды) | Система команд на базе Telegram каналов/групп. Бот = админ → сквад активен | squads migration, useSquads.ts |
| 2026-02-03 | Squad weekly change | Смена сквада раз в неделю (can_change_squad RPC), join_squad/leave_squad функции | squads migration |
| 2026-02-03 | Creator info on cards | Отображение имени создателя и кликабельного сквада на QuizCard и PersonalityTestCard | QuizCard, PersonalityTestCard |
| 2026-02-03 | Quiz/Test editing | useUpdateQuiz, useIsQuizCreator для редактирования своих квизов | useQuizzes.ts |
| 2026-02-03 | Smooth banner animation | Плавная анимация смены баннеров: scale + opacity вместо x-translate | BannerCarousel.tsx |
| 2026-02-03 | Bot squad handler | my_chat_member event: создание/деактивация сквадов при добавлении/удалении бота как админа | bot/index.ts |
| 2026-02-03 | Squad UI screens | SquadScreen (detail), SquadListScreen (browse + search), CreateSquadGuide (step-by-step) | screens/ |
| 2026-02-03 | Leaderboard refactor | Только команды и создатели активны, остальные вкладки "soon" | LeaderboardScreen.tsx |
| 2026-02-03 | Squad block on home | Кнопки "Вступить" и "Создать команду" на главной | Index.tsx |
| 2026-02-03 | Completed tests display | Пройденные тесты показываются с бейджем "Пройден" и затемнением | PersonalityTestCard, useCompletedTestIds |
| 2026-02-03 | LEFT JOIN for creators | Исправлен запрос creator info (тесты с null created_by теперь показываются) | useQuizzes, usePersonalityTests |

## TODO / Backlog

### Milestone A: Baseline ✅
- [x] Create CLAUDE.md
- [x] Add backup scripts
- [x] Add .env.example
- [x] Add docker-compose.yml for local Postgres
- [x] First commit

### Milestone B: Bot + API Server ✅
- [x] Create `server/` folder structure (bot + api)
- [x] Set up grammY bot with TypeScript
- [x] Implement inline query handler (daily/random/profile/search)
- [x] Add initData validation middleware
- [x] Create verdicts + shares tables migration
- [x] Basic API endpoints (quizzes, auth, attempts, shares)

### Milestone C: UI Integration + Admin Analytics ✅
- [x] Admin Analytics Dashboard:
  - Total users, quizzes, attempts, shares
  - DAU/WAU metrics with auto-refresh
  - Avg quiz completion time
  - Funnel visualization (7 days)
  - Top quizzes by plays/likes/saves
  - Micro-humor based on stats
- [x] API endpoints for analytics (server/src/api/analytics.ts)
- [ ] Connect screens to real verdict data from DB
- [ ] Track attempts and shares in real-time

### Milestone D: Telegram Bot + Inline
- [ ] Set up grammY bot
- [ ] Inline query handler (daily/random/profile)
- [ ] InlineQueryResult with web_app button
- [ ] Deep link payload handling

### Milestone E: Admin Panel Enhancements
- [ ] Full CRUD forms for quizzes/questions/verdicts
- [ ] Banner management with drag-and-drop
- [ ] Stats dashboard (DAU, completions, funnel)
- [ ] Share card preview

### Milestone F: Hardening + Deploy
- [ ] Rate limiting
- [ ] Health checks
- [ ] Logging
- [ ] Deploy instructions

## Risks / Assumptions

- **Supabase free tier limits** — monitor usage, may need upgrade
- **Telegram API rate limits** — implement backoff for inline queries
- **initData validation** — must be server-side, never trust client

## Ops

### Backup Commands
```bash
npm run backup       # Dump Postgres to /backups
npm run snapshot     # Archive CLAUDE.md + schema + configs
npm run milestone    # backup + snapshot + git commit
```

### Local Development
```bash
docker-compose up -d   # Start local Postgres
npm install
npm run dev            # Start Vite dev server
```

### Environment Variables
See `.env.example` for required variables.

---

## Rules (обязательные)

### Дизайн и UI
1. **НЕ переписывать существующие компоненты** — только расширять/использовать
2. **Новые экраны** — строить из существующих `tg-*` классов и shadcn/ui
3. **Стиль** — Liquid Glass (прозрачность, blur, градиенты) уже в Tailwind конфиге
4. **Анимации** — использовать framer-motion как в существующих экранах
5. **Haptic feedback** — вызывать `haptic.*` на все интерактивные элементы
6. **BottomNav** — backdrop-blur + bg-background/80 для glass эффекта
7. **Mini App locked** — disableVerticalSwipes() предотвращает случайное закрытие

### Тема (ВАЖНО!)
1. **useTheme** — ЕДИНСТВЕННЫЙ источник правды для dark/light mode
2. **initTelegramApp** — НЕ трогает тему вообще (только ready/expand/disableSwipes)
3. **НЕ используем applyTelegramTheme** — inline стили ломают переключение тем
4. **localStorage["theme"]** — хранит выбор пользователя ("light" | "dark")
5. **По умолчанию** — светлая тема (light)
6. **При загрузке** — тема применяется ДО рендера React (в useTheme.ts на уровне модуля)
7. **toggleTheme()** — переключает между light и dark, сохраняет в localStorage
8. **CSS классы** — `:root` для light, `.dark` для dark — единственный источник цветов

### Код и архитектура
1. **Решения → CLAUDE.md → Код** — сначала запись, потом реализация
2. **Маленькие шаги** — каждый milestone = коммит
3. **Типизация** — строгий TypeScript, без `any`
4. **Хуки** — новая логика = новый хук в `hooks/`
5. **API** — все запросы через react-query

### База данных
1. **Supabase** — основная БД, миграции в `supabase/migrations/`
2. **RLS** — все таблицы защищены Row Level Security
3. **Типы** — после миграции обновить `integrations/supabase/types.ts`

### Telegram
1. **initData** — ВСЕГДА валидировать на сервере, НИКОГДА не доверять клиенту
2. **WebApp SDK** — использовать `lib/telegram.ts` обёртки
3. **Inline mode** — payload без персональных данных (только IDs, refs)

### Бэкапы и деплой
1. **Перед milestone** — `npm run backup` + `npm run snapshot`
2. **Секреты** — НИКОГДА в репо, только `.env.example`
3. **Docker** — локальная разработка через `docker-compose`

### Микроюмор (UI копирайтинг)
1. **Максимум 1 короткая шутка на экран**
2. **Лучше в**: empty states, loading, toast, error messages
3. **Стиль**: лёгкий, как у Aviasales (но не про самолёты)
4. **Без кринжа**: если сомневаешься — не шути

### Аналитика (Admin Dashboard)
1. **Метрики must-have**: DAU, WAU, total users/quizzes/attempts/shares
2. **Воронка**: opens → starts → completes → shares
3. **Top quizzes**: по plays, likes, saves
4. **Обновление**: каждые 30 секунд (refetchInterval)
5. **Fallback**: если API недоступен, запросы напрямую к Supabase

### PvP (Challenges & Rooms)
1. **Challenge cooldown**: 1 час между вызовами одному и тому же игроку
2. **Room codes**: 6 символов, генерация через `generate_room_code` RPC
3. **Real-time**: Supabase subscriptions для обновлений комнаты
4. **Статусы room**: waiting → selecting → playing → finished
5. **Статусы challenge**: pending → accepted/declined → completed

### Tasks (Задания)
1. **Reward type**: пока только popcorns
2. **Task types**: link (внешняя ссылка), internal, social
3. **Иконки**: эмодзи (🎯📢👥🎁⭐🔔💎🏆)
4. **Admin CRUD**: create/update/delete через useTasks хуки
5. **Completion**: один раз, дубликаты блокируются unique constraint

### Referrals (Рефералы)
1. **Referral code**: автогенерация в profiles
2. **Tracking**: referrals таблица (referrer_id → referred_id)
3. **Stats**: useReferralCount для отображения в профиле
4. **Share**: copyReferralLink через telegram.ts

### Deployment
1. **Frontend**: Netlify — URL из VITE_MINI_APP_URL
2. **Bot**: Local dev (polling) / Production (webhook на /api/bot/webhook)
3. **Database**: Supabase — wyiwdhtefbnjdrdbgaas.supabase.co
4. **Build**: `npm run build` → `npx netlify deploy --prod --dir=dist --site=0ebc8ded-38e2-450f-81f2-5b9ff8969dbe`

### Design System Files
1. **`.cursorrules`** — AI rules for Cursor (styling, components, patterns)
2. **`DESIGN_SYSTEM.md`** — Full design system documentation
3. **`src/index.css`** — CSS variables and Telegram theme
4. **`tailwind.config.ts`** — Tailwind config with colors and animations

### Personality Tests (Тесты личности)
1. **Отличие от Quiz**: нет правильных ответов, каждый ответ дает очки к результату
2. **Результат**: персонаж/тип с картинкой и описанием (не score)
3. **DB таблицы**: personality_tests, personality_test_questions, personality_test_answers, personality_test_results, personality_test_completions, personality_test_likes, personality_test_favorites
4. **Подсчёт результата**: суммируем очки из result_points (JSONB), берём результат с max очками
5. **UI Flow**: Cover → Questions (выбор без "правильно/неправильно") → Character Result
6. **Шаринг**: "Я — Гомер Симпсон! Пройди тест и узнай кто ты!"
7. **Inline mode**: test: или тест: префикс для поиска только тестов
8. **Модерация**: как у квизов (is_published: false → true)
9. **Admin Panel**: таб "Tests" для модерации pending тестов

### Moderation Notifications
1. **При создании**: уведомление админам в бота с кнопками Approve/Reject
2. **При решении**: уведомление автору о результате модерации
3. **ADMIN_TELEGRAM_IDS**: env переменная со списком ID админов
4. **Handlers**: server/src/bot/handlers/notifications.ts, moderation.ts

### Deep Links (start_param)
1. **Формат**: `{testId|questId}_{refUserId}_{source}` (e.g., `abc-123_456_result_share`)
2. **Парсинг**: Index.tsx при инициализации проверяет tg.initDataUnsafe.start_param
3. **Логика**: UUID-like первый параметр → открываем тест (если source содержит "test") или квиз
4. **Referral**: refUserId сохраняется для аналитики (кто привёл пользователя)

### Inline Query Results
1. **cache_time**: 0-5 сек для персонализированных результатов
2. **is_personal**: true — результаты уникальны для каждого пользователя
3. **ID формат**: `{type}_{contentId}_{userId}_{timestamp}` для уникальности
4. **Шаринг теста**: test_result:testId:resultTitle → InlineQueryResultPhoto с картинкой результата

### Баннеры (Admin)
1. **CRUD**: создание, редактирование, скрытие/показ, удаление
2. **is_active**: true показывает на главной, false скрывает
3. **Карусель**: автосвайп каждые 3.5 сек, ручной свайп сбрасывает таймер
4. **RLS**: отключен, проверка админа на уровне приложения
5. **Редактирование**: inline форма в админке с сохранением всех полей

### Coming Soon Features
1. **Gallery**: кнопка неактивна с badge "soon"
2. **Leaderboard**: кнопка неактивна с badge "soon"  
3. **Challenge (PvP)**: кнопка серая с badge "soon"
4. **Toast**: при нажатии показывается "Скоро" / "В разработке"

---

**Golden Rule**: All decisions go in CLAUDE.md first, then code.
