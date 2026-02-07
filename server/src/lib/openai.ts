import { z } from 'zod';

const OpenAiChatResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      content: z.string().nullable().optional(),
    }),
  })).min(1),
});

const stripCodeFences = (raw: string): string => {
  const trimmed = raw.trim();
  if (trimmed.startsWith('```')) {
    // Remove first and last fence (best-effort).
    const withoutFirst = trimmed.replace(/^```[a-zA-Z0-9_-]*\n?/, '');
    return withoutFirst.replace(/\n?```$/, '').trim();
  }
  return trimmed;
};

const QuizVariantSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  cover_image_keywords: z.array(z.string().min(1)).min(3).max(8),
  questions: z.array(z.object({
    text: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(6),
    correctAnswer: z.number().int().min(0),
  })).min(2),
}).superRefine((val, ctx) => {
  for (let i = 0; i < val.questions.length; i++) {
    const q = val.questions[i];
    if (q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `questions[${i}].correctAnswer out of range`,
        path: ['questions', i, 'correctAnswer'],
      });
    }
  }
});

const PersonalityTestVariantSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  cover_image_keywords: z.array(z.string().min(1)).min(3).max(8),
  results: z.array(z.object({
    result_key: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    share_text: z.string().default(''),
    image_keywords: z.array(z.string().min(1)).min(2).max(8).default([]),
  })).min(2),
  questions: z.array(z.object({
    question_text: z.string().min(1),
    answers: z.array(z.object({
      answer_text: z.string().min(1),
      result_points: z.record(z.string(), z.number().int()),
    })).min(2),
  })).min(2),
}).superRefine((val, ctx) => {
  const keys = new Set<string>();
  for (const r of val.results) {
    if (keys.has(r.result_key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate result_key: ${r.result_key}`,
        path: ['results'],
      });
    }
    keys.add(r.result_key);
  }

  for (let qi = 0; qi < val.questions.length; qi++) {
    const q = val.questions[qi];
    for (let ai = 0; ai < q.answers.length; ai++) {
      const rp = q.answers[ai].result_points || {};
      const anyKnownKey = Object.keys(rp).some((k) => keys.has(k));
      if (!anyKnownKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `answers[${ai}].result_points does not reference any known result_key`,
          path: ['questions', qi, 'answers', ai, 'result_points'],
        });
      }
    }
  }
});

export type QuizVariant = z.infer<typeof QuizVariantSchema>;
export type PersonalityTestVariant = z.infer<typeof PersonalityTestVariantSchema>;

const QuizResponseSchema = z.object({
  variants: z.array(QuizVariantSchema).length(3),
});

const PersonalityResponseSchema = z.object({
  variants: z.array(PersonalityTestVariantSchema).length(3),
});

const getOpenAiConfig = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o';
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return { apiKey, model };
};

async function callOpenAiJson(params: {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
}): Promise<unknown> {
  const { apiKey, model: envModel } = getOpenAiConfig();
  const model = params.model || envModel;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: params.temperature ?? 0.8,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OpenAI request failed: HTTP ${response.status} ${text?.slice(0, 200)}`);
  }

  const json = await response.json();
  const parsed = OpenAiChatResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error('OpenAI response shape invalid');
  }

  const content = parsed.data.choices[0]?.message?.content || '';
  const cleaned = stripCodeFences(content);

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error('OpenAI returned non-JSON content');
  }
}

async function callOpenAiJsonWithRepair<S extends z.ZodTypeAny>(
  schema: S,
  params: { system: string; user: string; temperature?: number },
): Promise<z.output<S>> {
  const raw = await callOpenAiJson(params);
  const first = schema.safeParse(raw);
  if (first.success) return first.data;

  const repairSystem = [
    'You are a strict JSON formatter and validator.',
    'Given invalid JSON output, you must return ONLY valid JSON that matches the required schema.',
    'Do not add extra keys. Do not wrap in code fences.',
  ].join('\n');

  const repairUser = [
    'Fix the following JSON so it matches the required schema.',
    'Return ONLY JSON.',
    '',
    JSON.stringify(raw),
  ].join('\n');

  const repairedRaw = await callOpenAiJson({
    system: repairSystem,
    user: repairUser,
    temperature: 0.2,
  });

  const repaired = schema.safeParse(repairedRaw);
  if (!repaired.success) {
    throw new Error('OpenAI JSON validation failed (after repair)');
  }

  return repaired.data;
}

export async function generateQuizVariants(params: {
  prompt: string;
  questionCount?: number;
}): Promise<QuizVariant[]> {
  const questionCount = Math.max(2, Math.min(params.questionCount ?? 10, 12));

  const system = [
    'You generate quiz content for a Telegram mini app.',
    'Return JSON only. No markdown. No code fences.',
    'Generate EXACTLY 3 distinct variants.',
    'Keep it safe for a general audience (no explicit sexual content, no hate, no self-harm, no illegal instructions).',
    'Each quiz must have at least 2 questions. Prefer 4 answer options per question.',
    'correctAnswer must be a valid index into options.',
    'cover_image_keywords should be 3-8 simple keywords (ru or en) useful to find or create a cover image.',
    '',
    'JSON schema:',
    '{ "variants": [ { "title": string, "description": string, "cover_image_keywords": string[], "questions": [ { "text": string, "options": string[], "correctAnswer": number } ] } ] }',
  ].join('\n');

  const user = [
    `User prompt (ru): ${params.prompt}`,
    `Question count: ${questionCount}`,
    'Make the 3 variants meaningfully different in angle/style.',
  ].join('\n');

  const result = await callOpenAiJsonWithRepair(QuizResponseSchema, { system, user, temperature: 0.9 });
  return result.variants;
}

export async function generatePersonalityTestVariants(params: {
  prompt: string;
  questionCount?: number;
  resultsCount?: number;
}): Promise<PersonalityTestVariant[]> {
  const resultsCount = Math.max(2, Math.min(params.resultsCount ?? 4, 6));
  const questionCount = Math.max(2, Math.min(params.questionCount ?? 8, 10));

  const system = [
    'You generate personality test content for a Telegram mini app.',
    'Return JSON only. No markdown. No code fences.',
    'Generate EXACTLY 3 distinct variants.',
    'Keep it safe for a general audience (no explicit sexual content, no hate, no self-harm, no illegal instructions).',
    'Use result keys: result_1, result_2, ... up to the results count.',
    'Compatibility rule: each question must have EXACTLY one answer per result (so answers count == results count).',
    'Each answer must award points only to its own result_key: { "<result_key>": 1 }.',
    'cover_image_keywords and image_keywords should be simple keywords (ru or en) useful to find or create images.',
    '',
    'JSON schema:',
    '{ "variants": [ { "title": string, "description": string, "cover_image_keywords": string[], "results": [ { "result_key": string, "title": string, "description": string, "share_text": string, "image_keywords": string[] } ], "questions": [ { "question_text": string, "answers": [ { "answer_text": string, "result_points": object } ] } ] } ] }',
  ].join('\n');

  const user = [
    `User prompt (ru): ${params.prompt}`,
    `Results count: ${resultsCount}`,
    `Question count: ${questionCount}`,
    'Make the 3 variants meaningfully different in tone/personas.',
  ].join('\n');

  const result = await callOpenAiJsonWithRepair(PersonalityResponseSchema, { system, user, temperature: 0.9 });

  // Post-sanitize to guarantee 1:1 answers per result_key with { key: 1 }.
  return result.variants.map((v) => {
    const keys = v.results.map((r) => r.result_key);
    const normalizedQuestions = v.questions.map((q) => ({
      ...q,
      answers: keys.map((k, idx) => {
        const existing = q.answers[idx];
        return {
          answer_text: existing?.answer_text || `Ответ для ${k}`,
          result_points: { [k]: 1 },
        };
      }),
    }));

    return {
      ...v,
      questions: normalizedQuestions,
    };
  });
}
