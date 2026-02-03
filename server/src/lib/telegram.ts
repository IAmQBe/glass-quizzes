import crypto from 'crypto';
import { z } from 'zod';

/**
 * Telegram WebApp initData validation
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

const TelegramUserSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
  is_premium: z.boolean().optional(),
  photo_url: z.string().optional(),
});

const InitDataSchema = z.object({
  query_id: z.string().optional(),
  user: TelegramUserSchema.optional(),
  auth_date: z.number(),
  hash: z.string(),
  start_param: z.string().optional(),
});

export type TelegramUser = z.infer<typeof TelegramUserSchema>;
export type InitData = z.infer<typeof InitDataSchema>;

/**
 * Parse initData string from Telegram WebApp
 */
export function parseInitData(initDataString: string): Record<string, string> {
  const params = new URLSearchParams(initDataString);
  const data: Record<string, string> = {};

  for (const [key, value] of params.entries()) {
    data[key] = value;
  }

  return data;
}

/**
 * Validate Telegram WebApp initData
 * Returns parsed data if valid, throws if invalid
 */
export function validateInitData(
  initDataString: string,
  botToken: string,
  maxAgeSeconds: number = 86400 // 24 hours default
): InitData {
  const params = parseInitData(initDataString);

  // Extract hash
  const hash = params.hash;
  if (!hash) {
    throw new Error('Missing hash in initData');
  }

  // Build data-check-string (sorted alphabetically, excluding hash)
  const dataCheckString = Object.keys(params)
    .filter((key) => key !== 'hash')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('\n');

  // Calculate HMAC
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // Compare hashes
  if (calculatedHash !== hash) {
    throw new Error('Invalid initData hash');
  }

  // Check auth_date freshness
  const authDate = parseInt(params.auth_date || '0', 10);
  const now = Math.floor(Date.now() / 1000);

  if (now - authDate > maxAgeSeconds) {
    throw new Error('initData expired');
  }

  // Parse user JSON if present
  let user: TelegramUser | undefined;
  if (params.user) {
    try {
      user = TelegramUserSchema.parse(JSON.parse(params.user));
    } catch (e) {
      throw new Error('Invalid user data in initData');
    }
  }

  return {
    query_id: params.query_id,
    user,
    auth_date: authDate,
    hash,
    start_param: params.start_param,
  };
}

/**
 * Extract start_param payload
 * Format: quest_<id>_ref_<userId>_src_<source> or test_<id>_ref_<userId>_src_<source>
 */
export function parseStartParam(startParam: string | undefined): {
  questId?: string;
  testId?: string;
  refUserId?: string;
  source?: string;
} {
  if (!startParam) return {};

  const result: { questId?: string; testId?: string; refUserId?: string; source?: string } = {};

  const questMatch = startParam.match(/quest_([a-zA-Z0-9-]+)/);
  if (questMatch) result.questId = questMatch[1];

  const testMatch = startParam.match(/test_([a-zA-Z0-9-]+)/);
  if (testMatch) result.testId = testMatch[1];

  const refMatch = startParam.match(/ref_(\d+)/);
  if (refMatch) result.refUserId = refMatch[1];

  const srcMatch = startParam.match(/src_(\w+)/);
  if (srcMatch) result.source = srcMatch[1];

  return result;
}

/**
 * Build start_param for inline buttons
 */
export function buildStartParam(params: {
  questId?: string;
  testId?: string;
  refUserId?: number | string;
  source?: string;
}): string {
  const parts: string[] = [];

  if (params.questId) parts.push(`quest_${params.questId}`);
  if (params.testId) parts.push(`test_${params.testId}`);
  if (params.refUserId) parts.push(`ref_${params.refUserId}`);
  if (params.source) parts.push(`src_${params.source}`);

  return parts.join('_');
}
