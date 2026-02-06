# Codex Notes

## Repo
Glass Quizzes (Vite + React + Supabase) with Telegram Mini App integration.

## Rules And Decisions
- Profiles in the UI use Telegram `telegram_id` as the primary identity source.
- Quiz `duration_seconds` is treated as total quiz time, not per-question time.
- Quiz scoring uses correct answers from the shuffled question order and derives verdict via `getVerdict`.
- Likes and saves mutations require `{ quizId/testId, isLiked/isFavorite }` objects.
- Personality test `participant_count` is updated by a DB trigger on completion insert.
- Card containers are non-button elements with `role="button"` to avoid nested buttons.

## Updates Applied
- Added DB trigger migration for personality test participant count.
- Fixed preview like/save mutations.
- Added missing `supabase` import in `useAuth`.
- Added guards for empty personality test questions.
- Fixed quiz timeout result to include `maxScore` and `verdictEmoji`.
- Aligned quiz correctness tracking with shuffled questions.
- Added creator + squad display in Profile (saved/history) by enriching favorites and history queries.
- Added leaderboard popcorns fallback when RPC returns empty.
- Synced test bookmarks into `favorites` and manually updates `personality_tests.save_count`.
- Fixed leaderboard UI to show 1-2 entries (not only 3+).
- Added quiz creator + squad data in `useQuizWithQuestions` and avatar display in `QuizCard`.
- Added `safe-bottom-nav` spacing to keep content above bottom nav.
- Tuned dark theme CSS variables to a Telegram iOS-style darker palette.
- Updated bottom menu to a liquid glass style using new CSS utilities.
- Moved like/save actions to bottom of quiz/test cards and aligned creator display in tests with avatar + squad.

## Follow-ups
- Apply the new Supabase migration: `supabase/migrations/20260206093000_add_personality_test_participant_trigger.sql`.
- If you want per-question timers, update `QuizScreen` logic and rename labels accordingly.
