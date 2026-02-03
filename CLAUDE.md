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

1. **Home** (`pages/Index.tsx`) — banner carousel + quiz showcase + profile button
2. **WelcomeScreen** — quiz intro card (5 questions • 60 sec • public) + "Start test" CTA
3. **QuizScreen** — 1 question per screen, progress bar, animated transitions
4. **ResultScreen** — score display + percentile + verdict emoji + share/challenge/retry/profile buttons
5. **CompareScreen** — You vs Friend cards with VS badge, waiting state if friend hasn't completed
6. **ProfileScreen** — avatar, name, stats grid (4 cols), admin button (if admin), Pro features teaser
7. **AdminPanel** — tabs (Quizzes/Banners), list items with publish/delete actions

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
| `QuizCard` | `id, title, description, image_url, participant_count, question_count, duration_seconds, onClick` | Quiz list item card |
| `QuizShowcase` | `quizzes[], isLoading, onQuizSelect` | Grid of QuizCards with loading state |
| `NavLink` | react-router NavLink wrapper | Adds activeClassName support |

### shadcn/ui Components (`components/ui/`)
Full set: button, card, dialog, drawer, toast, tabs, form, input, select, checkbox, switch, progress, skeleton, avatar, badge, tooltip, popover, dropdown-menu, etc.

## Existing Hooks

| Hook | Returns | Description |
|------|---------|-------------|
| `usePublishedQuizzes()` | `{ data: Quiz[], isLoading }` | Fetch published quizzes |
| `useQuizWithQuestions(id)` | `{ data: { quiz, questions } }` | Fetch quiz + questions |
| `useMyQuizzes()` | `{ data: Quiz[] }` | Current user's quizzes |
| `useCreateQuiz()` | mutation | Create new quiz |
| `useSubmitQuizResult()` | mutation | Submit quiz result |
| `useBanners()` | `{ data: Banner[] }` | Fetch active banners |
| `useIsAdmin()` | `{ data: boolean }` | Check if current user is admin |
| `useQuiz()` | quiz state machine | Local quiz flow state (welcome→quiz→result) |

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

### Existing Tables
- `profiles` (id, telegram_id, username, first_name, last_name, avatar_url)
- `quizzes` (id, title, description, image_url, created_by, question_count, participant_count, duration_seconds, is_published)
- `questions` (id, quiz_id, question_text, image_url, options JSONB, correct_answer, order_index)
- `quiz_results` (id, quiz_id, user_id, score, max_score, percentile, answers JSONB, completed_at)
- `banners` (id, title, description, image_url, link_url, link_type, display_order, is_active)
- `user_roles` (id, user_id, role ENUM)

### To Add (Milestone B)
- `verdicts` (id, quiz_id, min_score, max_score, title, text, emoji)
- `attempts` (id, user_id, quiz_id, started_at, finished_at, score, verdict_id, source, ref_user_id)
- `shares` (id, attempt_id, shared_at, chat_type, source)
- `admins` (telegram_id, role, created_at) — or use env whitelist

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

## TODO / Backlog

### Milestone A: Baseline ✅
- [x] Create CLAUDE.md
- [x] Add backup scripts
- [x] Add .env.example
- [x] Add docker-compose.yml for local Postgres
- [ ] First commit

### Milestone B: DB + Models + API
- [ ] Add verdicts, attempts, shares tables (Supabase migration)
- [ ] Create server/ folder structure
- [ ] Implement basic API endpoints
- [ ] initData validation middleware

### Milestone C: Integrate UI with Real Data
- [ ] Connect screens to API
- [ ] Use real verdicts from DB
- [ ] Track attempts and shares

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

---

**Golden Rule**: All decisions go in CLAUDE.md first, then code.
