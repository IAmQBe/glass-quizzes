import { Context, InlineQueryResultArticle } from 'grammy';
import { getPublishedQuizzes, getRandomQuiz, getDailyQuiz, Quiz } from '../../lib/supabase.js';
import { buildStartParam } from '../../lib/telegram.js';

const MINI_APP_URL = process.env.VITE_MINI_APP_URL || 'https://t.me/YourBotUsername/app';
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'YourBot';

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
            url: `https://t.me/${BOT_USERNAME}/app?startapp=${startParam}`,
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
            url: `https://t.me/${BOT_USERNAME}/app?startapp=${startParam}`,
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
  const query = ctx.inlineQuery?.query?.toLowerCase().trim() || '';
  const userId = ctx.from?.id || 0;
  
  try {
    const results: InlineQueryResultArticle[] = [];
    
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
      
      // Add profile option
      results.push(buildProfileResult(userId));
      
      // Add some popular quizzes
      const popularQuizzes = await getPublishedQuizzes(5);
      for (const quiz of popularQuizzes) {
        if (quiz.id !== dailyQuiz?.id && quiz.id !== randomQuiz?.id) {
          results.push(buildQuizResult(quiz, userId, `quiz_${quiz.id}`));
        }
      }
    } else {
      // Search quizzes by title/description
      // For now, filter client-side (Supabase free tier doesn't have full-text search)
      const allQuizzes = await getPublishedQuizzes(50);
      const matchingQuizzes = allQuizzes.filter(
        (q) =>
          q.title.toLowerCase().includes(query) ||
          q.description?.toLowerCase().includes(query)
      );
      
      for (const quiz of matchingQuizzes.slice(0, 10)) {
        results.push(buildQuizResult(quiz, userId, `search_${quiz.id}`));
      }
      
      // If no results, suggest profile
      if (results.length === 0) {
        results.push(buildProfileResult(userId));
      }
    }
    
    await ctx.answerInlineQuery(results, {
      cache_time: 60, // Cache for 1 minute
      is_personal: true, // Results are personalized (ref includes user ID)
    });
  } catch (error) {
    console.error('Inline query error:', error);
    
    // Return empty results on error
    await ctx.answerInlineQuery([], {
      cache_time: 10,
      switch_pm_text: 'Something went wrong. Tap to retry.',
      switch_pm_parameter: 'retry',
    });
  }
}
