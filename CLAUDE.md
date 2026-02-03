# Glass Quizzes - Project Documentation

> **Single source of truth** — все архитектурные решения, изменения API/схемы БД фиксируются здесь.

## Project Overview

**Glass Quizzes** — Viral Quiz/Quest для Telegram с inline-вызовом в чатах и Mini App для прохождения.

- **Repo**: IAmQBe/glass-quizzes
- **UI Source**: Lovable.dev (Liquid Glass design — НЕ ПЕРЕПИСЫВАТЬ)

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

---

**Golden Rule**: All decisions go in CLAUDE.md first, then code.
