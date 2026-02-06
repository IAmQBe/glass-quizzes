import { describe, expect, it } from "vitest";
import { buildStartParam } from "../../server/src/lib/telegram";
import {
  parseQuizResultInlineQuery,
  parseTestResultInlineQuery,
  resolveInlineRefUserId,
} from "../../server/src/bot/handlers/inlineParsing";

describe("inline query parser", () => {
  it("parses quiz_result query with ref user id", () => {
    const parsed = parseQuizResultInlineQuery(
      "quiz_result:quiz-123:8:10:General%20Knowledge:70000123"
    );

    expect(parsed).toEqual({
      quizId: "quiz-123",
      score: 8,
      total: 10,
      quizTitle: "General Knowledge",
      refUserId: 70000123,
    });

    const finalRef = resolveInlineRefUserId(parsed?.refUserId, 123456);
    const startParam = buildStartParam({
      questId: parsed?.quizId,
      refUserId: finalRef,
      source: "quiz_result_share",
    });
    const deepLink = `https://t.me/QuipoBot/app?startapp=${startParam}`;

    expect(startParam).toContain("ref_70000123");
    expect(deepLink).toContain("startapp=quest_quiz-123_ref_70000123_src_quiz_result_share");
  });

  it("parses test_result query and falls back to sender id when ref is absent", () => {
    const parsed = parseTestResultInlineQuery("test_result:test-abc:Я%20герой");
    expect(parsed).toEqual({
      testId: "test-abc",
      resultTitle: "Я герой",
      refUserId: undefined,
    });

    const finalRef = resolveInlineRefUserId(parsed?.refUserId, 99000111);
    const startParam = buildStartParam({
      testId: parsed?.testId,
      refUserId: finalRef,
      source: "result_share",
    });
    const deepLink = `https://t.me/QuipoBot/app?startapp=${startParam}`;

    expect(startParam).toContain("ref_99000111");
    expect(deepLink).toContain("startapp=test_test-abc_ref_99000111_src_result_share");
  });
});
