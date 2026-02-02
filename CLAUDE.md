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

1. **Home** (`pages/Index.tsx`) — banner carousel + quiz showcase
2. **WelcomeScreen** — quiz intro with start CTA
3. **QuizScreen** — 1 question per screen, progress bar
4. **ResultScreen** — score + percentile + verdict + share/challenge
5. **CompareScreen** — user vs friend comparison
6. **ProfileScreen** — user stats + history
7. **AdminPanel** — quizzes/banners management

## Existing UI Components

- `tg-section` — glass card container
- `tg-button` / `tg-button-secondary` / `tg-button-text` — buttons
- `tg-option` — quiz answer option
- `tg-progress` — progress bar
- `tg-avatar` — circle icon/avatar
- `tg-score` — large score display
- Full shadcn/ui library in `components/ui/`

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

**Rule**: All decisions go in CLAUDE.md first, then code.
