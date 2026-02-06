export interface ParsedQuizResultInlineQuery {
  quizId: string;
  score: number;
  total: number;
  quizTitle: string;
  refUserId?: number;
}

export interface ParsedTestResultInlineQuery {
  testId: string;
  resultTitle: string;
  refUserId?: number;
}

const parseOptionalRefUserId = (parts: string[]): { refUserId?: number; payloadParts: string[] } => {
  if (parts.length <= 1) {
    return { payloadParts: parts };
  }

  const maybeRef = parts[parts.length - 1];
  if (/^\d{5,}$/.test(maybeRef)) {
    return {
      refUserId: parseInt(maybeRef, 10),
      payloadParts: parts.slice(0, -1),
    };
  }

  return { payloadParts: parts };
};

export const parseQuizResultInlineQuery = (rawQuery: string): ParsedQuizResultInlineQuery | null => {
  if (!rawQuery.startsWith('quiz_result:')) return null;

  const parts = rawQuery.split(':');
  if (parts.length < 5) return null;

  const quizId = parts[1]?.trim();
  const score = parseInt(parts[2] || '', 10);
  const total = parseInt(parts[3] || '', 10);
  if (!quizId || Number.isNaN(score) || Number.isNaN(total) || total <= 0) {
    return null;
  }

  const restParts = parts.slice(4);
  const { refUserId, payloadParts } = parseOptionalRefUserId(restParts);
  const quizTitle = decodeURIComponent(payloadParts.join(':')).trim();
  if (!quizTitle) return null;

  return { quizId, score, total, quizTitle, refUserId };
};

export const parseTestResultInlineQuery = (rawQuery: string): ParsedTestResultInlineQuery | null => {
  if (!rawQuery.startsWith('test_result:')) return null;

  const parts = rawQuery.split(':');
  if (parts.length < 3) return null;

  const testId = parts[1]?.trim();
  if (!testId) return null;

  const restParts = parts.slice(2);
  const { refUserId, payloadParts } = parseOptionalRefUserId(restParts);
  const resultTitle = decodeURIComponent(payloadParts.join(':')).trim();
  if (!resultTitle) return null;

  return { testId, resultTitle, refUserId };
};

export const resolveInlineRefUserId = (parsedRefUserId: number | undefined, senderUserId: number): number => {
  return parsedRefUserId ?? senderUserId;
};

// Telegram Markdown (legacy) escape for user-provided text in captions/messages.
export const escapeTelegramMarkdown = (value: string): string => {
  return value.replace(/([_*`[\]])/g, '\\$1');
};
