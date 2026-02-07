import { Context, InlineKeyboard, InlineQueryResultBuilder } from 'grammy';
import type { InlineQueryResultArticle, InlineQueryResult } from 'grammy/types';
import {
  getDailyQuiz,
  getPersonalityTestById,
  getPublishedPersonalityTests,
  getPublishedQuizzes,
  getQuizById,
  getRandomQuiz,
  PersonalityTest,
  Quiz,
} from '../../lib/supabase.js';
import { buildStartParam } from '../../lib/telegram.js';
import { supabase } from '../../lib/supabase.js';
import {
  escapeTelegramMarkdown,
  parsePollInlineQuery,
  parseQuizInviteInlineQuery,
  parseQuizResultInlineQuery,
  parseTestInviteInlineQuery,
  parseTestResultInlineQuery,
  resolveInlineRefUserId,
} from './inlineParsing.js';

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'QuipoBot';
const CAPTION_LIMIT = 1024;
const INLINE_BUTTON_TEXT_LIMIT = 64;

// Build URL for inline buttons - direct Mini App link with Short Name
function buildDeepLink(startParam: string): string {
  return `https://t.me/${BOT_USERNAME}/app?startapp=${startParam}`;
}

function truncateText(value: string, maxLength: number): string {
  const raw = value.trim();
  if (raw.length <= maxLength) return raw;
  if (maxLength <= 3) return raw.slice(0, maxLength);
  return `${raw.slice(0, maxLength - 3).trimEnd()}...`;
}

function sanitizeInlineButtonText(value: string | null | undefined, fallback: string): string {
  const text = (value || '').trim() || fallback;
  return truncateText(text, INLINE_BUTTON_TEXT_LIMIT);
}

function stripTrailingBackslashes(value: string): string {
  return value.replace(/\\+$/, '');
}

function buildInlineCaption(params: {
  titleLine: string; // already escaped for Markdown if needed
  description?: string; // already escaped for Markdown if needed
  ctaLine?: string; // already escaped for Markdown if needed
}): string {
  const titleLine = params.titleLine.trim();
  const description = (params.description || '').trim();
  const ctaLine = (params.ctaLine || '').trim();

  const ctaBlock = ctaLine ? `\n\n${ctaLine}` : '';
  if (!description) {
    return `${titleLine}${ctaBlock}`.slice(0, CAPTION_LIMIT);
  }

  // Always keep title + CTA; truncate the description to fit into caption limit.
  const availableDescriptionLength = CAPTION_LIMIT - (titleLine.length + 2 + ctaBlock.length); // 2 for \n\n
  if (availableDescriptionLength <= 0) {
    return `${titleLine}${ctaBlock}`.slice(0, CAPTION_LIMIT);
  }

  let finalDescription = description;
  if (finalDescription.length > availableDescriptionLength) {
    finalDescription = truncateText(finalDescription, availableDescriptionLength);
    finalDescription = stripTrailingBackslashes(finalDescription);
  }

  return `${titleLine}\n\n${finalDescription}${ctaBlock}`.slice(0, CAPTION_LIMIT);
}

// Check if URL is a valid http(s) URL (not data URL, not empty)
function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || url.length < 10) return false;
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
): InlineQueryResult {
  const startParam = buildStartParam({
    questId: quiz.id,
    refUserId: userId,
    source: options?.isDaily ? 'daily' : options?.isRandom ? 'random' : 'inline',
  });

  const emoji = options?.isDaily ? '📅' : options?.isRandom ? '🎲' : '🧠';
  const minutes = Math.max(1, Math.round((quiz.duration_seconds || 0) / 60));
  const descriptionText = (quiz.description || '').trim() || `⏱ ${minutes} мин • ${quiz.question_count} вопросов`;

  const caption = buildInlineCaption({
    titleLine: `${emoji} *${escapeTelegramMarkdown(quiz.title)}*`,
    description: escapeTelegramMarkdown(descriptionText),
    ctaLine: '👉 Пройди квиз 👇',
  });

  const buttonText = sanitizeInlineButtonText(quiz.title, '🎯 Пройти квиз');
  const keyboard = new InlineKeyboard().url(buttonText, buildDeepLink(startParam));

  const finalImageUrl = quiz.image_url && isValidImageUrl(quiz.image_url) ? quiz.image_url : null;
  if (finalImageUrl) {
    return InlineQueryResultBuilder.photo(resultId, finalImageUrl, {
      thumbnail_url: finalImageUrl,
      photo_width: 640,
      photo_height: 640,
      title: `${emoji} ${quiz.title}`,
      description: truncateText(descriptionText, 100),
      caption,
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  return InlineQueryResultBuilder.article(resultId, `${emoji} ${quiz.title}`, {
    description: truncateText(descriptionText, 100),
    thumbnail_url: 'https://via.placeholder.com/100x100.png?text=Quiz',
    reply_markup: keyboard,
  }).text(caption, { parse_mode: 'Markdown' });
}

/**
 * Build inline result for a personality test
 */
function buildPersonalityTestResult(
  test: PersonalityTest,
  userId: number,
  resultId: string
): InlineQueryResult {
  const startParam = buildStartParam({
    testId: test.id,
    refUserId: userId,
    source: 'inline_test',
  });

  const descriptionText =
    (test.description || '').trim() || `${test.question_count} вопросов • ${test.result_count} результатов`;

  const caption = buildInlineCaption({
    titleLine: `🎭 *${escapeTelegramMarkdown(test.title)}*`,
    description: escapeTelegramMarkdown(descriptionText),
    ctaLine: '👉 А ты кто? Пройди тест 👇',
  });

  const buttonText = sanitizeInlineButtonText(test.title, '🧪 Пройти тест');
  const keyboard = new InlineKeyboard().url(buttonText, buildDeepLink(startParam));

  const finalImageUrl = test.image_url && isValidImageUrl(test.image_url) ? test.image_url : null;
  if (finalImageUrl) {
    return InlineQueryResultBuilder.photo(resultId, finalImageUrl, {
      thumbnail_url: finalImageUrl,
      photo_width: 640,
      photo_height: 640,
      title: `🎭 ${test.title}`,
      description: truncateText(descriptionText, 100),
      caption,
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  return InlineQueryResultBuilder.article(resultId, `🎭 ${test.title}`, {
    description: truncateText(descriptionText, 100),
    thumbnail_url: 'https://via.placeholder.com/100x100.png?text=Test',
    reply_markup: keyboard,
  }).text(caption, { parse_mode: 'Markdown' });
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
    const results: InlineQueryResult[] = [];

    // Share invite card for a specific quiz: quiz_invite:<quizId>[:refUserId]
    if (rawQuery.startsWith('quiz_invite:')) {
      const parsed = parseQuizInviteInlineQuery(rawQuery);
      if (parsed) {
        const finalRefUserId = resolveInlineRefUserId(parsed.refUserId, userId);
        const quiz = await getQuizById(parsed.quizId);
        if (quiz) {
          const safeId = `qi${parsed.quizId.replace(/-/g, '').slice(0, 16)}${Date.now().toString(36)}`.slice(0, 64);
          const result = buildQuizResult(quiz, finalRefUserId, safeId, { isRandom: false, isDaily: false });
          await ctx.answerInlineQuery([result], { cache_time: 0, is_personal: true });
          return;
        }
      }

      await ctx.answerInlineQuery([], { cache_time: 0, is_personal: true });
      return;
    }

    // Share invite card for a specific personality test: test_invite:<testId>[:refUserId]
    if (rawQuery.startsWith('test_invite:')) {
      const parsed = parseTestInviteInlineQuery(rawQuery);
      if (parsed) {
        const finalRefUserId = resolveInlineRefUserId(parsed.refUserId, userId);
        const test = await getPersonalityTestById(parsed.testId);
        if (test) {
          const safeId = `ti${parsed.testId.replace(/-/g, '').slice(0, 16)}${Date.now().toString(36)}`.slice(0, 64);
          const result = buildPersonalityTestResult(test, finalRefUserId, safeId);
          await ctx.answerInlineQuery([result], { cache_time: 0, is_personal: true });
          return;
        }
      }

      await ctx.answerInlineQuery([], { cache_time: 0, is_personal: true });
      return;
    }

    // Share invite card for a prediction poll: poll:<pollId>[:refUserId]
    if (rawQuery.startsWith('poll:')) {
      const parsed = parsePollInlineQuery(rawQuery);
      if (parsed) {
        const finalRefUserId = resolveInlineRefUserId(parsed.refUserId, userId);
        const safeId = `pl${parsed.pollId.replace(/-/g, '').slice(0, 16)}${Date.now().toString(36)}`.slice(0, 64);

        let title = 'Голосование';
        let optionA = '';
        let optionB = '';
        let coverImageUrl: string | null = null;

        try {
          const { data } = await Promise.race([
            supabase
              .from('prediction_polls')
              .select('title,option_a_label,option_b_label,cover_image_url')
              .eq('id', parsed.pollId)
              .maybeSingle(),
            new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 5000)),
          ]) as any;

          if (data) {
            title = data.title || title;
            optionA = data.option_a_label || '';
            optionB = data.option_b_label || '';
            if (data.cover_image_url && isValidImageUrl(data.cover_image_url)) {
              coverImageUrl = data.cover_image_url;
            }
          }
        } catch {
          // Ignore DB lookup errors; we'll just send a minimal card.
        }

        const optionLineA = optionA ? `A: ${truncateText(optionA, 40)}` : '';
        const optionLineB = optionB ? `B: ${truncateText(optionB, 40)}` : '';
        const optionsBlock = [optionLineA, optionLineB].filter(Boolean).join('\n');
        const descriptionText = optionsBlock || 'Выбери вариант и поучаствуй.';

        const startParam = `poll=${parsed.pollId}_ref_${finalRefUserId}_src_poll_inline`;
        const buttonUrl = buildDeepLink(startParam);
        const keyboard = new InlineKeyboard().url('🗳 Проголосовать', buttonUrl);

        const caption = buildInlineCaption({
          titleLine: `🗳 *${escapeTelegramMarkdown(title)}*`,
          description: escapeTelegramMarkdown(descriptionText),
          ctaLine: '👉 Прими участие в голосовании 👇',
        });

        let result: InlineQueryResult;
        if (coverImageUrl) {
          result = InlineQueryResultBuilder.photo(safeId, coverImageUrl, {
            thumbnail_url: coverImageUrl,
            photo_width: 640,
            photo_height: 640,
            title: `🗳 ${title}`,
            description: truncateText(descriptionText, 100),
            caption,
            parse_mode: 'Markdown',
            reply_markup: keyboard,
          });
        } else {
          result = InlineQueryResultBuilder.article(safeId, `🗳 ${title}`, {
            description: truncateText(descriptionText, 100),
            thumbnail_url: 'https://via.placeholder.com/100x100.png?text=Vote',
            reply_markup: keyboard,
          }).text(caption, { parse_mode: 'Markdown' });
        }

        await ctx.answerInlineQuery([result], { cache_time: 0, is_personal: true });
        return;
      }

      await ctx.answerInlineQuery([], { cache_time: 0, is_personal: true });
      return;
    }

    // Check for quiz result share format: quiz_result:quizId:score:total:title
    // INSTANT RESPONSE - NO DATABASE CALLS!
    if (rawQuery.startsWith('quiz_result:')) {
      const parsedQuizResult = parseQuizResultInlineQuery(rawQuery);
      if (parsedQuizResult) {
        const { quizId, score, total, quizTitle, refUserId } = parsedQuizResult;
        const percentage = Math.round((score / total) * 100);
        const safeQuizTitle = escapeTelegramMarkdown(quizTitle);
        const finalRefUserId = resolveInlineRefUserId(refUserId, userId);

        const startParam = buildStartParam({
          questId: quizId,
          refUserId: finalRefUserId,
          source: 'quiz_result_share',
        });
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
            message_text: `🧠 *${safeQuizTitle}*\n\n✅ Мой результат: *${score}/${total}* (${percentage}%)\n\nСможешь лучше? Попробуй 👇`,
            parse_mode: 'Markdown',
          },
          reply_markup: { inline_keyboard: [[{ text: '🎯 Пройти квиз', url: buttonUrl }]] },
        });
      }

      await ctx.answerInlineQuery(results, { cache_time: 0, is_personal: true });
      return;
    }

    // Check for test result share format: test_result:testId:resultTitle:userId
    // NOTE: Query is kept short (<256 chars) - we fetch description+image from DB
    if (rawQuery.startsWith('test_result:')) {
      const parsedTestResult = parseTestResultInlineQuery(rawQuery);
      console.log('[Inline] test_result query:', parsedTestResult ? 'parsed' : 'invalid', 'raw:', rawQuery.slice(0, 100));

      if (parsedTestResult) {
        const { testId, resultTitle, refUserId } = parsedTestResult;
        const finalRefUserId = resolveInlineRefUserId(refUserId, userId);

        console.log('[Inline] testId:', testId, '| resultTitle:', resultTitle, '| refUserId:', finalRefUserId);

        const startParam = buildStartParam({ testId, refUserId: finalRefUserId, source: 'result_share' });
        const buttonUrl = buildDeepLink(startParam);
        const safeId = `tr${testId.replace(/-/g, '').slice(0, 12)}${Date.now()}`;
        const keyboard = new InlineKeyboard().url('🧪 Пройти тест', buttonUrl);

        // Fetch description and image from DB (with timeout)
        let resultDescription = '';
        let finalImageUrl: string | null = null;

        try {
          console.log('[Inline] Fetching from DB...');
          const { data } = await Promise.race([
            supabase.from('personality_test_results')
              .select('description, image_url')
              .eq('test_id', testId)
              .ilike('title', `%${resultTitle.slice(0, 15)}%`)
              .limit(1)
              .maybeSingle(),
            new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 5000))
          ]) as any;

          if (data) {
            resultDescription = data.description || '';
            if (data.image_url && isValidImageUrl(data.image_url)) {
              finalImageUrl = data.image_url;
            }
            console.log('[Inline] DB result - desc:', resultDescription?.slice(0, 30), '| img:', finalImageUrl?.slice(0, 40));
          }
        } catch (e) {
          console.log('[Inline] DB lookup failed/timeout');
        }

        // Build caption
        const descriptionText = resultDescription || 'Пройди тест и узнай кто ты!';
        const safeResultTitle = escapeTelegramMarkdown(resultTitle);
        const safeDescriptionText = escapeTelegramMarkdown(descriptionText);
        const caption = `🎭 *Я — ${safeResultTitle}*\n\n${safeDescriptionText}\n\n👉 А ты кто? Пройди тест 👇`;

        // Build result using InlineQueryResultBuilder
        let result: InlineQueryResult;
        if (finalImageUrl) {
          console.log('[Inline] Building PHOTO result');
          result = InlineQueryResultBuilder.photo(safeId, finalImageUrl, {
            thumbnail_url: finalImageUrl,
            photo_width: 400,
            photo_height: 400,
            title: `🎭 Я — ${resultTitle}`,
            description: descriptionText.slice(0, 100),
            caption,
            parse_mode: 'Markdown',
            reply_markup: keyboard,
          });
        } else {
          console.log('[Inline] Building ARTICLE result');
          result = InlineQueryResultBuilder.article(safeId, `🎭 Я — ${resultTitle}`, {
            description: descriptionText.slice(0, 100),
            thumbnail_url: 'https://placehold.co/100x100/9333ea/white?text=Test',
            reply_markup: keyboard,
          }).text(caption, { parse_mode: 'Markdown' });
        }

        console.log('[Inline] Answering, type:', (result as any).type);
        await ctx.answerInlineQuery([result], { cache_time: 0, is_personal: true });
        return;
      }
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
