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

export interface ParsedQuizInviteInlineQuery {
  quizId: string;
  refUserId?: number;
}

export interface ParsedTestInviteInlineQuery {
  testId: string;
  refUserId?: number;
}

export interface ParsedPollInlineQuery {
  pollId: string;
  refUserId?: number;
}

const parseOptionalRefUserId = (
  parts: string[],
  opts?: { allowSinglePartRef?: boolean }
): { refUserId?: number; payloadParts: string[] } => {
  if (parts.length === 0) {
    return { payloadParts: parts };
  }

  // For payload-bearing queries (quiz_result/test_result) we don't want to interpret the only payload
  // segment as a ref id, otherwise we'd lose the title. For invite/poll queries, the ref can be the
  // only trailing segment.
  if (parts.length === 1 && !opts?.allowSinglePartRef) {
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

export const parseQuizInviteInlineQuery = (rawQuery: string): ParsedQuizInviteInlineQuery | null => {
  if (!rawQuery.startsWith('quiz_invite:')) return null;

  const parts = rawQuery.split(':');
  if (parts.length < 2) return null;

  const quizId = parts[1]?.trim();
  if (!quizId) return null;

  const restParts = parts.slice(2);
  const { refUserId } = parseOptionalRefUserId(restParts, { allowSinglePartRef: true });
  return { quizId, refUserId };
};

export const parseTestInviteInlineQuery = (rawQuery: string): ParsedTestInviteInlineQuery | null => {
  if (!rawQuery.startsWith('test_invite:')) return null;

  const parts = rawQuery.split(':');
  if (parts.length < 2) return null;

  const testId = parts[1]?.trim();
  if (!testId) return null;

  const restParts = parts.slice(2);
  const { refUserId } = parseOptionalRefUserId(restParts, { allowSinglePartRef: true });
  return { testId, refUserId };
};

export const parsePollInlineQuery = (rawQuery: string): ParsedPollInlineQuery | null => {
  if (!rawQuery.startsWith('poll:')) return null;

  const parts = rawQuery.split(':');
  if (parts.length < 2) return null;

  const pollId = parts[1]?.trim();
  if (!pollId) return null;

  const restParts = parts.slice(2);
  const { refUserId } = parseOptionalRefUserId(restParts, { allowSinglePartRef: true });
  return { pollId, refUserId };
};

export const resolveInlineRefUserId = (parsedRefUserId: number | undefined, senderUserId: number): number => {
  return parsedRefUserId ?? senderUserId;
};

// Telegram Markdown (legacy) escape for user-provided text in captions/messages.
export const escapeTelegramMarkdown = (value: string): string => {
  return value.replace(/([_*`[\]])/g, '\\$1');
};
