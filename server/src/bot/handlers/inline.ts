import { Context } from 'grammy';
import type { InlineQueryResultArticle, InlineQueryResultPhoto } from 'grammy/types';
import { getPublishedQuizzes, getRandomQuiz, getDailyQuiz, Quiz, getPublishedPersonalityTests, PersonalityTest, getPersonalityTestById } from '../../lib/supabase.js';
import { buildStartParam } from '../../lib/telegram.js';
import { supabase } from '../../lib/supabase.js';

const MINI_APP_URL = process.env.VITE_MINI_APP_URL || 'https://t.me/YourBotUsername/app';
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'QuipoBot';

// Build URL for inline buttons - direct Mini App link with Short Name
// Opens Mini App directly in one click
function buildDeepLink(startParam: string): string {
  return `https://t.me/${BOT_USERNAME}/app?startapp=${startParam}`;
}

// Check if URL is a valid http(s) URL (not data URL)
function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Build inline result for a quiz
 */
function buildQuizResult(
  quiz: Quiz,
  userId: number,
  resultId: string,
  options?: { isDaily?: boolean; isRandom?: boolean }
): InlineQueryResultArticle {
  const startParam = buildStartParam({
    questId: quiz.id,
    refUserId: userId,
    source: options?.isDaily ? 'daily' : options?.isRandom ? 'random' : 'inline',
  });

  const emoji = options?.isDaily ? '📅' : options?.isRandom ? '🎲' : '🧠';
  const label = options?.isDaily ? 'Daily Quiz' : options?.isRandom ? 'Random Quiz' : '';

  return {
    type: 'article',
    id: resultId,
    title: `${emoji} ${label ? label + ': ' : ''}${quiz.title}`,
    description: quiz.description || `${quiz.question_count} questions • ${Math.floor(quiz.duration_seconds / 60)}min`,
    thumbnail_url: quiz.image_url || 'https://via.placeholder.com/100x100.png?text=Quiz',
    input_message_content: {
      message_text:
        `${emoji} *${quiz.title}*\n\n` +
        `${quiz.description || 'Test your knowledge!'}\n\n` +
        `📊 ${quiz.participant_count.toLocaleString()} played • ❤️ ${quiz.like_count} likes\n` +
        `⏱ ${quiz.question_count} questions`,
      parse_mode: 'Markdown',
    },
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🎯 Take the Quiz',
            url: buildDeepLink(startParam),
          },
        ],
        [
          {
            text: '📤 Challenge a Friend',
            switch_inline_query: quiz.title,
          },
        ],
      ],
    },
  };
}

/**
 * Build inline result for a personality test
 */
function buildPersonalityTestResult(
  test: PersonalityTest,
  userId: number,
  resultId: string
): InlineQueryResultArticle {
  const startParam = buildStartParam({
    testId: test.id,
    refUserId: userId,
    source: 'inline_test',
  });

  return {
    type: 'article',
    id: resultId,
    title: `🎭 ${test.title}`,
    description: test.description || `${test.question_count} вопросов • ${test.result_count} результатов`,
    thumbnail_url: test.image_url || 'https://via.placeholder.com/100x100.png?text=Test',
    input_message_content: {
      message_text:
        `🎭 *${test.title}*\n\n` +
        `${test.description || 'Узнай кто ты!'}\n\n` +
        `📊 ${test.participant_count.toLocaleString()} прошли • ${test.result_count} результатов\n` +
        `⏱ ${test.question_count} вопросов`,
      parse_mode: 'Markdown',
    },
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🧪 Пройти тест',
            url: buildDeepLink(startParam),
          },
        ],
        [
          {
            text: '📤 Отправить другу',
            switch_inline_query: test.title,
          },
        ],
      ],
    },
  };
}

/**
 * Build personality test result share (when user finished a test)
 */
function buildTestResultShare(
  testTitle: string,
  resultTitle: string,
  resultDescription: string,
  testId: string,
  resultImageUrl: string | null,
  userId: number
): InlineQueryResultArticle {
  const startParam = buildStartParam({
    testId,
    refUserId: userId,
    source: 'result_share',
  });

  return {
    type: 'article',
    id: `test_result_${testId}_${userId}`,
    title: `🎭 Я — ${resultTitle}!`,
    description: `${testTitle} • Пройди и узнай кто ты!`,
    thumbnail_url: resultImageUrl || 'https://via.placeholder.com/100x100.png?text=Result',
    input_message_content: {
      message_text:
        `🧪 Я прошёл тест "*${testTitle}*" и оказался:\n\n` +
        `🎭 *${resultTitle}*\n\n` +
        `${resultDescription}\n\n` +
        `А кто ты? Пройди тест и узнай!`,
      parse_mode: 'Markdown',
    },
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🧪 Пройти тест',
            url: buildDeepLink(startParam),
          },
        ],
      ],
    },
  };
}

/**
 * Build profile result
 */
function buildProfileResult(userId: number): InlineQueryResultArticle {
  const startParam = buildStartParam({
    refUserId: userId,
    source: 'profile',
  });

  return {
    type: 'article',
    id: 'profile',
    title: '👤 My Profile',
    description: 'Share your stats and achievements',
    thumbnail_url: 'https://via.placeholder.com/100x100.png?text=Profile',
    input_message_content: {
      message_text:
        '🧠 *Mind Test Profile*\n\n' +
        'I\'ve been testing my mind! Want to compare?\n\n' +
        'Tap below to see my stats or challenge me!',
      parse_mode: 'Markdown',
    },
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '👀 View Profile',
            url: buildDeepLink(startParam),
          },
        ],
        [
          {
            text: '⚔️ Challenge Me',
            switch_inline_query: 'challenge',
          },
        ],
      ],
    },
  };
}

/**
 * Handle inline queries
 */
export async function handleInlineQuery(ctx: Context) {
  const rawQuery = ctx.inlineQuery?.query?.trim() || '';
  const query = rawQuery.toLowerCase();
  const userId = ctx.from?.id || 0;

  try {
    const results: InlineQueryResultArticle[] = [];

    // Check for quiz result share format: quiz_result:quizId:score:total:title
    // INSTANT RESPONSE - NO DATABASE CALLS!
    if (rawQuery.startsWith('quiz_result:')) {
      const parts = rawQuery.split(':');
      if (parts.length >= 5) {
        const quizId = parts[1];
        const score = parseInt(parts[2], 10);
        const total = parseInt(parts[3], 10);
        const quizTitle = decodeURIComponent(parts.slice(4).join(':'));
        const percentage = Math.round((score / total) * 100);

        const startParam = buildStartParam({ questId: quizId, refUserId: userId, source: 'quiz_result_share' });
        const buttonUrl = buildDeepLink(startParam);
        const safeId = `qr${quizId.replace(/-/g, '').slice(0, 12)}${Date.now()}`;

        // Instant response without DB
        results.push({
          type: 'article',
          id: safeId,
          title: `🧠 ${quizTitle}: ${score}/${total}`,
          description: `${percentage}% правильных • Сможешь лучше?`,
          thumbnail_url: 'https://placehold.co/100x100/3b82f6/white?text=%F0%9F%A7%A0',
          input_message_content: {
            message_text: `🧠 *${quizTitle}*\n\n✅ Мой результат: *${score}/${total}* (${percentage}%)\n\nСможешь лучше? Попробуй 👇`,
            parse_mode: 'Markdown',
          },
          reply_markup: { inline_keyboard: [[{ text: '🎯 Пройти квиз', url: buttonUrl }]] },
        });
      }

      await ctx.answerInlineQuery(results, { cache_time: 0, is_personal: true });
      return;
    }

    // Check for test result share format: test_result:testId:resultTitle:imageUrl:userId
    // INSTANT RESPONSE - NO DATABASE CALLS!
    if (rawQuery.startsWith('test_result:')) {
      const parts = rawQuery.split(':');

      if (parts.length >= 3) {
        const testId = parts[1];
        const resultTitle = decodeURIComponent(parts[2]).trim();
        
        // Parse imageUrl (part 3) and userId (part 4)
        let imageUrl = '';
        if (parts.length >= 4 && parts[3] && !/^\d+$/.test(parts[3])) {
          imageUrl = decodeURIComponent(parts[3]);
        }

        const startParam = buildStartParam({ testId, refUserId: userId, source: 'result_share' });
        const buttonUrl = buildDeepLink(startParam);
        const safeId = `tr${testId.replace(/-/g, '').slice(0, 12)}${Date.now()}`;
        const caption = `🎭 *Я — ${resultTitle}*\n\nА ты кто? Пройди тест и узнай! 👇`;

        // Use photo if we have a valid image URL, otherwise article
        if (isValidImageUrl(imageUrl)) {
          results.push({
            type: 'photo',
            id: safeId,
            photo_url: imageUrl,
            thumbnail_url: imageUrl,
            title: `🎭 Я — ${resultTitle}`,
            description: 'Пройди тест и узнай кто ты!',
            caption,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🧪 Пройти тест', url: buttonUrl }]] },
          } as any);
        } else {
          results.push({
            type: 'article',
            id: safeId,
            title: `🎭 Я — ${resultTitle}`,
            description: 'Пройди тест и узнай кто ты!',
            thumbnail_url: 'https://placehold.co/100x100/9333ea/white?text=%F0%9F%8E%AD',
            input_message_content: { message_text: caption, parse_mode: 'Markdown' },
            reply_markup: { inline_keyboard: [[{ text: '🧪 Пройти тест', url: buttonUrl }]] },
          });
        }
      }

      await ctx.answerInlineQuery(results, { cache_time: 0, is_personal: true });
      return;
    }

    // Default results (no query or empty)
    if (!query || query.length < 2) {
      // Add daily quiz
      const dailyQuiz = await getDailyQuiz();
      if (dailyQuiz) {
        results.push(buildQuizResult(dailyQuiz, userId, 'daily', { isDaily: true }));
      }

      // Add random quiz
      const randomQuiz = await getRandomQuiz();
      if (randomQuiz && randomQuiz.id !== dailyQuiz?.id) {
        results.push(buildQuizResult(randomQuiz, userId, 'random', { isRandom: true }));
      }

      // Add personality tests
      const personalityTests = await getPublishedPersonalityTests(3);
      for (const test of personalityTests) {
        results.push(buildPersonalityTestResult(test, userId, `test_${test.id}`));
      }

      // Add profile option
      results.push(buildProfileResult(userId));

      // Add some popular quizzes
      const popularQuizzes = await getPublishedQuizzes(5);
      for (const quiz of popularQuizzes) {
        if (quiz.id !== dailyQuiz?.id && quiz.id !== randomQuiz?.id) {
          results.push(buildQuizResult(quiz, userId, `quiz_${quiz.id}`));
        }
      }
    } else if (query.startsWith('test:') || query.startsWith('тест:')) {
      // Search personality tests specifically
      const allTests = await getPublishedPersonalityTests(20);
      const searchTerm = query.replace(/^(test:|тест:)/, '').trim();
      const matchingTests = allTests.filter(
        (t) =>
          t.title.toLowerCase().includes(searchTerm) ||
          t.description?.toLowerCase().includes(searchTerm)
      );

      for (const test of matchingTests.slice(0, 10)) {
        results.push(buildPersonalityTestResult(test, userId, `search_test_${test.id}`));
      }

      // If no results, show all tests
      if (results.length === 0) {
        for (const test of allTests.slice(0, 5)) {
          results.push(buildPersonalityTestResult(test, userId, `all_test_${test.id}`));
        }
      }
    } else {
      // Search quizzes and tests by title/description
      const allQuizzes = await getPublishedQuizzes(30);
      const matchingQuizzes = allQuizzes.filter(
        (q) =>
          q.title.toLowerCase().includes(query) ||
          q.description?.toLowerCase().includes(query)
      );

      for (const quiz of matchingQuizzes.slice(0, 6)) {
        results.push(buildQuizResult(quiz, userId, `search_${quiz.id}`));
      }

      // Also search personality tests
      const allTests = await getPublishedPersonalityTests(20);
      const matchingTests = allTests.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query)
      );

      for (const test of matchingTests.slice(0, 4)) {
        results.push(buildPersonalityTestResult(test, userId, `search_test_${test.id}`));
      }

      // If no results, suggest profile
      if (results.length === 0) {
        results.push(buildProfileResult(userId));
      }
    }

    await ctx.answerInlineQuery(results, {
      cache_time: 5, // Minimal cache - results are personalized with ref user ID
      is_personal: true,
    });
  } catch (error) {
    console.error('Inline query error:', error);

    // Return empty results on error
    await ctx.answerInlineQuery([], {
      cache_time: 10,
    });
  }
}
