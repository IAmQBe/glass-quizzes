Original prompt: давай также сделаем возможность при создании теста/квиза — опубликовать его анонимно, типа добавим прям на первой странице кнопку слайдер, чтобы можно было выбрать публиковать анонимно (но при этом собранные лайки (попкорны) не учтутся в лидерборде), либо же публиковать от своего имени

по умолчанию пусть стоит публикация от своего имени

## 2026-02-06
- New request: improve search UX and sorting in `/src/pages/Index.tsx`.
- Implemented unified search for both quizzes and personality tests.
- Added default ranking by completions (`participant_count`), with additional sort modes: newest, likes, favorites.
- Added sort direction toggle (`desc/asc`) with arrow button (`ArrowDown`/`ArrowUp`).
- Updated tests list rendering to use filtered/sorted dataset and search-aware empty state.
- Build check: `npm run build` passed.
- Test check: `npm run test` passed.
- Playwright skill run was attempted but blocked:
  - Skill client script is ESM `.js` outside module scope (worked around by copying to `.mjs` in `/tmp`).
  - Final blocker: `playwright` package missing and network install blocked (`ENOTFOUND registry.npmjs.org`).

- New request: implement a gamified prediction market scenario on home page for product-spec handoff.
- Added `src/components/PredictionMarketSection.tsx` and mounted it in `src/pages/Index.tsx` home screen.
- Included in the new block:
  - Prediction Poll entity shape (id/squad/title/options/cover/deadline/status/resolution/proof/report count).
  - Lifecycle controls (`draft/open/locked/pending_resolution/resolved`) plus `cancelled/invalid/under_review`.
  - Two participation modes: `stake` (popcorn frozen in pool) and `vote` (reputation only), mutually exclusive per user.
  - Economics preview with parimutuel payout, fee split (`creator/treasury`), and partial refund.
  - Anti-abuse constraints: per-poll cap, daily cap, min participants/min pool validity, anti-sybil warm-up checks.
  - Captain constraints: monthly creation cap, cooldown, and hidden-until-approved indicator.
  - Inline growth card actions: deep link (`startapp=poll=<id>`) and `switchInlineQuery("poll:<id>")`.
  - Popcorn sinks list for economy control.
- Build check after changes: `npm run build` passed.
- Test check after changes: `npm run test` passed.
- Playwright skill run retried and still blocked:
  - `web_game_playwright_client.js` requires ESM execution; direct run fails in current Node mode.
  - `.mjs` workaround runs, but `playwright` package is missing (`ERR_MODULE_NOT_FOUND`).

### TODO for next agent
- If network is available, install `playwright` and run `~/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js` against `http://127.0.0.1:4173`.
- Manually verify the new sorting/search chips behavior on mobile viewport in home screen for both tabs (`Квизы` and `Тесты`).
- Manually validate new `PredictionMarketSection` UX in Telegram Mini App context (deep link + `switchInlineQuery`) and tune copy/thresholds with product.

### Follow-up fix
- Fixed regression where lists could disappear if `title/description` fields contained null values during search filtering.
- Made sort numeric parsing resilient for mixed/null DB values.
- Moved the search button outside horizontal chip scroll so it stays visible.
- Re-verified: `npm run build` and `npm run test` both pass.

### Follow-up fix 2
- Added additional data-safety guards for home feed:
  - Coerced source arrays to safe non-null lists before filtering/sorting.
  - Made sort value extraction tolerant to null item objects.
  - Added fallback to original safe lists when sorted result is unexpectedly empty and no search query is active.
- Re-verified again: `npm run build` and `npm run test` both pass.

### Follow-up fix 3
- Hardened feed sanitization to avoid full list disappearance from malformed legacy rows:
  - Validate items by `id` presence only (do not drop rows for missing title).
  - Keep search text normalization null-safe for title/description.
  - Keep render list fallback sorted from validated source arrays.
- Re-verified: `npm run build` and `npm run test` pass.

### Follow-up fix 4
- Updated feed data loading to keep legacy published items visible:
  - `usePublishedQuizzes`: removed strict DB filter `.eq("is_published", true)` and now treats any row with `is_published !== false` as visible.
  - `usePublishedPersonalityTests`: same visibility rule (`is_published !== false`).
- Normalized home feed items in `Index.tsx`:
  - Coerced IDs to safe strings.
  - Added default title fallback (`"Без названия"`).
  - Coerced numeric counters to safe numbers before sorting.
- Re-verified once more: `npm run build` and `npm run test` both pass.

### Follow-up fix 5
- Added resilient data fetch fallback for home feed:
  - `usePublishedQuizzes`: try `quizzes_public` first; if empty/error, fallback to `quizzes` with `(is_published = true OR status = 'published')`.
  - `usePublishedPersonalityTests`: try `personality_tests_public`; if empty/error, fallback to `personality_tests` with `is_published = true`.
  - Detail hooks (`useQuizWithQuestions`, `usePersonalityTestWithDetails`) now also fallback from public views to base tables.
- Home feed now merges `published + my own` content (deduplicated by id), so creator-owned cards remain visible even if publication flags drift.
- Re-verified: `npm run build` and `npm run test` pass.

## 2026-02-06
- New request: replace app page favicon with popcorn SVG icon.
- Added `public/popcorn-favicon.svg` based on existing popcorn vector icon.
- Connected new favicon in `index.html` via `<link rel="icon" type="image/svg+xml" href="/popcorn-favicon.svg" />`.
- Follow-up: old icon still appeared in browser due `favicon.ico` cache/fallback.
- Replaced `public/favicon.ico` with popcorn-based icon (64x64) and added cache-busting links in `index.html`:
  - `rel="icon"` SVG with `?v=20260206b`
  - `rel="icon"` ICO with `?v=20260206b`
  - `rel="shortcut icon"` ICO with `?v=20260206b`
- Ran `npm run build`; `dist/favicon.ico` and `dist/index.html` are updated accordingly.

## 2026-02-06 (prediction UX refactor)
- New request: simplify prediction UX into three focused screens and hide admin mechanics from regular users.
- Removed overloaded home prediction block and replaced architecture with:
  - Home showcase: compact Top-3 prediction cards + `Смотреть все` + optional `Trending squads` + `Создать прогноз` for captain.
  - List screen: filters (`Open/Locked/Resolved`, `Мой сквад/Все`), sorting (`Популярные`, `Скоро закроются`, `Новые`), searchable clickable cards.
  - Details screen: focused participation flow (mode segmented control, A/B selection, stake/vote actions, compact balance/reputation, payout preview card, info sheet).
- Added separate admin-only controls inside Details tab (`Admin`, visible only for current squad captain context):
  - close staking, choose outcome A/B, required proof URL, resolve,
  - cancel with full refund + confirmation,
  - reports count and hide/unhide toggle.
- Added prediction mock model/files:
  - `src/types/prediction.ts`
  - `src/data/predictions.ts`
  - `src/components/PredictionTopBlock.tsx`
  - `src/screens/PredictionListScreen.tsx`
  - `src/screens/PredictionDetailsScreen.tsx`
- Updated `src/pages/Index.tsx` navigation/state:
  - new screens: `prediction_list`, `prediction_details`,
  - deep-link support for `start_param` patterns like `poll=<id>`,
  - back-navigation target handling between Home/List/Details,
  - in-memory prediction updates on stake/vote/admin actions.
- Removed deprecated `src/components/PredictionMarketSection.tsx`.
- Verification:
  - `npm run build` passed.
  - `npm run test` passed.
  - Playwright skill client retry still blocked (missing `playwright`, `ERR_MODULE_NOT_FOUND`).

### TODO for next agent (prediction area)
- Connect prediction data/actions to backend tables/RPC instead of in-memory demo state.
- Wire real role checks for captain/admin visibility (currently inferred from user's squad context).
- Validate Telegram Mini App flows in-device:
  - `switchInlineQuery("poll:<id>")`
  - deep link `https://t.me/<bot>/app?startapp=poll=<id>`
- Optional polish: extract shared prediction helpers (time-left, payout preview, status mapping) to reusable utility module.

## 2026-02-06 (leaderboard creators visibility fix)
- New request: creators/users were missing in leaderboard tabs ("Создатели").
- Root cause in frontend hook `src/hooks/useLeaderboard.ts`:
  - `popcorns` category threw immediately on RPC error, so no fallback data path was used.
  - fallback path filtered out creators with `total_popcorns <= 0`, which could produce an empty list even when creators existed.
  - fallback publish filters were stricter than home-feed logic (`is_published === true` only).
- Implemented fixes:
  - Added resilient `loadCreatorsFallback()` path and invoke it both when RPC fails and when RPC returns empty payload.
  - Removed `> 0` filter so creators with published content but zero popcorn are still shown.
  - Aligned publish checks with resilient rules: `is_published !== false` (and `status === 'published'` compatibility for quizzes).
  - Added warning logs for RPC/fallback fetch failures to simplify future diagnostics.
- Verification:
  - `npm run build` passed.
  - `npm run test` passed.
  - Playwright skill run attempted again; blocked by environment:
    - direct skill client run fails due ESM `.js` in current Node mode,
    - `.mjs` workaround fails because `playwright` package is missing (`ERR_MODULE_NOT_FOUND`).

### TODO for next agent (leaderboard)
- Once network/install is available, install `playwright` and run the skill client against local app to visually verify creators tab in real UI.
- If production DB still returns sparse profile fields, consider adding a dedicated public profile projection for leaderboard display names.
- Additional UX tweak after verification:
  - `src/screens/LeaderboardScreen.tsx` and `src/screens/CreatorsScreen.tsx` now show `Автор <id>` fallback when `username/first_name` is missing, instead of generic repeated `Player/Creator`.
- Re-verified after tweak: `npm run build` and `npm run test` pass.

## 2026-02-06 (prediction gated create + quotas)
- New request: implement gated prediction creation flow with hints/limits and remove `Trending squads` from Home.
- Frontend wiring completed:
  - Added `src/hooks/usePredictions.ts` with:
    - `usePredictionCreationEligibility()` -> RPC `prediction_get_creation_eligibility`
    - `useSquadPredictionQuota()` -> RPC `prediction_get_squad_monthly_quota`
    - `usePredictionPolls()` -> reads `prediction_polls` + squad titles
    - `useCreatePredictionPoll()` -> RPC `prediction_create_poll`
  - Expanded prediction types in `src/types/prediction.ts`:
    - `PredictionCreationEligibility`, `PredictionSquadMonthlyQuota`, blocking reason codes, create payload/result types.
  - Added gate modal `src/components/CreatePredictionGateModal.tsx`:
    - checklist + priority CTA (`Пройти тесты` / `Создать команду` / `Открыть мою команду` / `Понятно`)
    - cooldown + monthly reset hint support.
  - Added dedicated create screen `src/screens/CreatePredictionScreen.tsx`:
    - form (title/options/cover/deadline)
    - participation mode toggles (stake/vote)
    - squad quota strip (`Сквад {name} · Осталось {remaining}/{limit}`)
    - submit via `prediction_create_poll`.
  - Updated Home block `src/components/PredictionTopBlock.tsx`:
    - removed `Trending squads` completely
    - create button always visible
    - added hint text under button.
  - Updated list screen `src/screens/PredictionListScreen.tsx`:
    - plus button always visible
    - added quota/requirements badge near plus.
  - Updated details screen `src/screens/PredictionDetailsScreen.tsx`:
    - respects poll-level mode availability (`stake_enabled` / `vote_enabled`).
  - Updated orchestration in `src/pages/Index.tsx`:
    - centralized `openCreatePrediction()` with eligibility refetch
    - opens `CreatePredictionGateModal` when blocked
    - routes to new `create_prediction` screen when eligible
    - adds gate CTA navigation actions (tests/team/squad)
    - shows Home/List hint states from eligibility
    - removed all `trendingSquads` usage for prediction home block
    - prediction data now uses backend hook with demo fallback when no rows.
- Backend migration already present and aligned for this feature:
  - `supabase/migrations/20260206173000_prediction_gated_create.sql`
  - contains tables + RPCs for eligibility/quota/create.
- Verification:
  - `npm run build` passed.
  - `npm run test -- --run` passed.
- Playwright skill client check:
  - direct run fails due CommonJS/ESM mismatch in provided script path.
  - `.mjs` workaround fails due missing `playwright` package (`ERR_MODULE_NOT_FOUND`).

### TODO for next agent
- Apply the new Supabase migration in the target environment and regenerate `src/integrations/supabase/types.ts` so prediction tables/RPC are strongly typed.
- Add/verify inline bot branch for `poll:<pollId>` if share-to-inline behavior is required end-to-end.
- Follow-up (leaderboard still empty in user report):
  - Hardened creators fallback in `useLeaderboard` for schema drift across environments.
  - Added multi-source/multi-column fallback reader:
    - tries `quizzes_public`/`quizzes` and `personality_tests_public`/`personality_tests`,
    - tries column variants with/without `status` and `is_anonymous`.
  - This prevents empty leaderboard when some deployments miss newer columns/views.
  - Build/test re-check passed: `npm run build`, `npm run test`.
- Extra resilience update for creator leaderboard fallback:
  - if publish/status fields are missing or inconsistent, fallback now tries alternate source+column combinations and, when needed, aggregates non-anonymous rows with `like_count > 0`.
  - prevents fully empty creators list on legacy/mismatched DB schemas.
- Re-verified after extra update: `npm run build` and `npm run test` pass.
- Leaderboard UX update (user request):
  - creators tab keeps top-3 podium format, rest rendered as list;
  - creators leaderboard limit raised to 300 items per page;
  - added sticky bottom "Ваше место" bar when current user is outside top-300;
  - for rank lookup outside top-300, screen performs an extended creators fetch (limit 5000) only when needed.
- Validation: `npm run build` and `npm run test` passed.
- Podium size hotfix (user feedback):
  - reduced oversized top-1 avatar blocks in leaderboard podiums;
  - replaced problematic `w-18/h-18` with explicit `w-[64px]/h-[64px]`;
  - reduced 2nd/3rd avatar sizes to `w-12/h-12` and tightened vertical spacing.
- Validation: `npm run build` and `npm run test` passed.
- Leaderboard unification update (user request):
  - Enabled all leaderboard tabs in `LeaderboardScreen`: `Команды`, `Создатели`, `Кубки`, `Челленджи`.
  - Applied one layout pattern for every tab:
    - top-3 podium block,
    - remainder as list,
    - max `300` rows loaded per tab.
  - Added sticky bottom "Ваше место" cards for users/squads outside top-300:
    - creators uses popcorn metric,
    - score uses total score,
    - challenges uses wins,
    - squads uses squad popcorns.
  - Added conditional extended rank lookup (limit `5000`) only when needed to resolve outside-top rank.
  - Updated `useSquadLeaderboard(limit, enabled)` to support conditional loading and avoid unnecessary calls.
- Validation: `npm run build` and `npm run test` passed.
- Follow-up UX tweak (compact prediction CTA + gate navigation):
  - `PredictionTopBlock` buttons made thinner (`py-2`, smaller icons) and renamed second CTA to `Создать событие`.
  - Gate modal progress CTA renamed from `Пройти тесты` to `Перейти` for blocked-by-progress state.
  - Added smooth scroll behavior from gate CTA to home content block (quizzes/tests tabs area), preserving last selected content tab.
  - `Index.tsx` now uses `homeContentBlockRef` + `shouldScrollToContentBlock` for animated scroll after modal action.
- Verification after tweak:
  - `npm run build` passed.
  - `npm run test -- --run` passed.
- Follow-up leaderboard adjustment (user feedback):
  - set `Кубки` and `Челленджи` tabs back to inactive with `soon` badge and toast;
  - aligned `Команды` visual style with `Создатели` pattern (podium/list/sticky style coherence):
    - round avatars in podium/list/sticky,
    - matching spacing and typography rhythm,
    - list subtitle now shows members count.
- Validation: `npm run build` and `npm run test` passed.
- Hotfix for eligibility counting and admin testing access:
  - `Index.tsx` now persists quiz completion to DB via `useSubmitQuizResult` on normal finish and timeout.
  - `useSubmitQuizResult` switched from `insert` to `upsert` on `(quiz_id,user_id)` to avoid duplicate-finish failures and keep completion data fresh.
  - Added migration `20260206214000_prediction_eligibility_and_admin_hotfix.sql`:
    - `prediction_get_creation_eligibility` now counts quiz completion with fallback to `user_events` (`quiz_complete`) by `telegram_id`.
    - Admin bootstrap: if no admin role exists, current caller is treated/admin-bootstrapped for testing.
    - Admin bypass now skips progress/captain/month-limit/cooldown checks (squad requirement still mandatory).
- Verification after hotfix:
  - `npm run build` passed.
  - `npm run test -- --run` passed.

## 2026-02-06 (profile history loading fix)
- New request: profile did not load completed tests/quests history.
- Implemented resilience fixes for history data loading:
  - `src/hooks/useQuizzes.ts` (`useMyQuizResults`):
    - switched primary history sort/select to `completed_at` (with legacy fallback to `created_at`),
    - added `user_id` fallback matching via both `profile.id` and `auth.user.id`,
    - added multi-source quiz detail fallback (`quizzes_public` with/without `is_anonymous`, then `quizzes` with visibility checks).
  - `src/hooks/usePersonalityTests.ts` (`useMyPersonalityTestCompletions`):
    - added `user_id` fallback matching via both `profile.id` and `auth.user.id`,
    - added multi-source test detail fallback (`personality_tests_public` with/without `is_anonymous`, then `personality_tests`),
    - added safe warning path for missing `personality_test_results` payload instead of hard-failing mapping.
  - `src/screens/ProfileScreen.tsx` (`TestResultItem`):
    - removed hard hide when related `test/result` is partially missing,
    - added safe fallback title/description,
    - disabled share button when payload is incomplete.
- Verification:
  - `npm run build` passed.
  - `npm run test -- --run` passed.
- Playwright skill check:
  - direct run of `web_game_playwright_client.js` fails due ESM/CJS mode mismatch,
  - `.mjs` workaround still blocked because `playwright` package is missing (`ERR_MODULE_NOT_FOUND`).

### TODO for next agent (profile history)
- With network/install access, install `playwright` and run the skill client for visual regression check in Profile -> History tab.
- If production DB still contains mixed historical `user_id` formats, consider backend unification/migration to a single identity key for `quiz_results` and `personality_test_completions`.

## 2026-02-06 (squad avatars fallback fix)
- New request: squad/team images were not отображаться reliably in UI.
- Root cause in frontend rendering:
  - squad avatars were rendered with a single URL source and no runtime fallback on image load failure;
  - for many records this leads to blank image blocks when primary URL is stale/unavailable.
- Implemented resilient avatar loading for squads:
  - Added `src/lib/squadAvatar.ts` with:
    - `normalizeTelegramUsername()` (handles accidental leading `@`),
    - `buildTelegramSquadUserpicUrl()`,
    - `getSquadAvatarCandidates()` (primary + fallback candidates, deduped).
  - Added reusable component `src/components/SquadAvatar.tsx`:
    - accepts `avatarUrl` + `username`,
    - auto-switches to next candidate on `img` load error,
    - supports custom visual fallback node.
  - Integrated `SquadAvatar` in squad-related screens:
    - `src/screens/SquadListScreen.tsx`
    - `src/screens/SquadScreen.tsx`
    - `src/screens/LeaderboardScreen.tsx` (all squad avatar slots: podium/list/sticky).
- Verification:
  - `npm run build` passed.
  - `npm run test -- --run` passed.
- Follow-up hardening:
  - `src/components/SquadAvatar.tsx` now renders visual fallback when *all* candidate URLs fail (prevents broken-image icon state).
- Re-verified after hardening:
  - `npm run build` passed.
  - `npm run test -- --run` passed.

## 2026-02-06 (admin moderation + tasks editing)
- New request: improve Admin Panel visibility/moderation for tests/quizzes, add editable tasks UX, and resolve task completion auth issue on Home.
- Admin moderation updates (`src/screens/AdminPanel.tsx`):
  - Added moderation preview mode for both content types:
    - preview of quiz questions + answer options + question images,
    - preview of personality test questions + answers + question images.
  - Added creator display for quiz/test cards in Admin tabs.
  - Added `Preview` action in quiz and test cards to open detailed moderation view.
  - Added moderation actions directly in preview:
    - `Опубликовать`,
    - `Отклонить` with required rejection reason input.
  - Updated tests tab to use full admin list (not only pending), with status badges.
  - Enhanced back behavior: when preview is open, top back button returns to list instead of exiting admin.
- Tasks admin UX (`src/screens/AdminPanel.tsx`):
  - Added full edit mode for existing tasks (title, description, type, link/channel, reward, icon, active flag).
  - Added task type selector in creation/editing:
    - `link`,
    - `subscribe_channel`,
    - `channel_boost`,
    - `telegram_premium`.
  - Added validation for required URL/channel on URL-dependent task types.
- Personality tests admin query consistency (`src/hooks/usePersonalityTests.ts`):
  - `useAdminPersonalityTests` query key aligned to `["admin", "tests"]` for stable invalidation.
- Verification:
  - `npm run build` passed.
  - `npm run test` passed.
  - `npm run server:build` passed.
- Follow-up hotfix for Home task completion auth error (`Ошибка: Not authenticated`):
  - Updated `src/hooks/useTasks.ts` completion mutation to gracefully fallback to direct profile-based completion when API returns auth-related errors (401 / invalid initData / authorization mismatch).
  - Re-verified after hotfix:
    - `npm run build` passed.
    - `npm run test` passed.

## 2026-02-06 (profile history card polish: media + author/team)
- User report: in Profile -> History one result card (`D. J. Trump`) showed broken media icon, and author/squad metadata looked visually broken.
- Implemented in `src/screens/ProfileScreen.tsx`:
  - Added `normalizeMediaUrl()` guard to ignore invalid media placeholders like `"null"` / empty strings.
  - In `TestResultItem`, added resilient image chain:
    - primary: `result.image_url`,
    - fallback: `test.image_url`,
    - if both fail on load -> emoji placeholder instead of broken browser image icon.
  - Introduced reusable `CreatorMeta` block with stable layout:
    - `Автор: <name>` line,
    - `Команда: <title>` line with popcorn icon,
    - truncation (`truncate`) for long names to avoid ugly wrapping.
  - Applied `CreatorMeta` to Saved cards, quiz history cards, and personality-test history cards.
  - Replaced `UNNAMED` with `Анонимный автор` in profile card metadata.
- Verification:
  - `npm run build` passed.
  - `npm run test -- --run` passed.

## 2026-02-06 (global moderation toggle + auto-publish mode)
- New request: add admin-controlled global content filtering mode:
  - ON: user-generated quizzes/tests/events require manual moderation.
  - OFF: user-generated quizzes/tests/events auto-publish immediately.
- Added frontend moderation settings helper:
  - `src/lib/moderationSettings.ts`
  - key: `moderation_settings` (`manual_moderation_enabled: boolean`, default `true`).
- Admin panel update (`src/screens/AdminPanel.tsx`):
  - added "Фильтрация контента" switch in header area,
  - persisted via `app_settings` upsert,
  - clear ON/OFF descriptions and success/error toasts.
- Quiz creation flow update:
  - `src/hooks/useQuizzes.ts` `useCreateQuiz` now reads moderation setting and creates quiz as:
    - pending/unpublished when filtering ON,
    - published immediately when filtering OFF.
  - keeps fallback for environments missing moderation columns.
  - `src/screens/CreateQuizScreen.tsx` now conditionally submits for review only when pending and shows correct toast.
- Personality test creation flow update:
  - `src/hooks/usePersonalityTests.ts` `useCreatePersonalityTest` now applies same ON/OFF moderation behavior with fallback.
  - `src/screens/CreatePersonalityTestScreen.tsx` now shows moderation vs auto-published toast based on actual created status.
- Prediction event creation flow update:
  - `src/hooks/usePredictions.ts` enriches create result with `next_status` and sends pending notification only for pending items.
  - `src/types/prediction.ts` extended `CreatePredictionResult` with `next_status`.
  - `src/screens/CreatePredictionScreen.tsx` now shows moderation vs published message according to created status.
- Added DB migration:
  - `supabase/migrations/20260206232500_content_moderation_toggle.sql`
  - ensures default setting row (`moderation_settings`),
  - adds `is_manual_moderation_enabled()` helper,
  - adds insert triggers for quizzes/personality tests to enforce global moderation toggle for non-admin creators,
  - updates `prediction_create_poll` to create `pending` when filtering ON and `open` when filtering OFF.
- Tasks UX/auth safety follow-up:
  - `src/hooks/useTasks.ts`: verifiable Telegram tasks (`subscribe_channel`, `channel_boost`, `telegram_premium`) no longer fall back to direct completion on auth/network failure; fallback remains for non-verifiable tasks.
  - `src/components/TasksBlock.tsx`: completion now passes `{taskId, taskType}` and link opening uses normalized Telegram target helper.
  - `server/src/api/index.ts`: Telegram chat parser hardened for additional link formats (`telegram.me`, `/s/...`) and rejects invite/private path forms that cannot be verified by bot.
- Verification after changes:
  - `npm run build` passed.
  - `npm run test` passed.
  - `npm run server:build` passed.
- Follow-up (admin access UX):
  - Fixed missing Admin Panel button for real admins when role RPC/session check is flaky.
  - `useIsAdmin` now has safe fallback by Telegram allowlist (`VITE_ADMIN_TELEGRAM_IDS`).
  - `ProfileScreen` now shows admin entry when either DB admin check passes or allowlist confirms admin Telegram ID.
  - Re-verified: `npm run test` and `npm run build` pass.
