import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildReferralStartParam,
  buildReferralUrl,
  openTelegramTarget,
  parseReferralStartParam,
  resolveSquadTelegramUrl,
} from "@/lib/telegram";

describe("telegram link helpers", () => {
  afterEach(() => {
    delete (window as any).Telegram;
    vi.restoreAllMocks();
  });

  it("resolves squad URL from username variants", () => {
    expect(resolveSquadTelegramUrl({ username: "@durov" })).toBe("https://t.me/durov");
    expect(resolveSquadTelegramUrl({ username: "https://t.me/durov" })).toBe("https://t.me/durov");
    expect(resolveSquadTelegramUrl({ username: "t.me/durov" })).toBe("https://t.me/durov");
  });

  it("falls back to invite link when username points to bot", () => {
    expect(
      resolveSquadTelegramUrl({
        username: "@QuipoBot",
        inviteLink: "https://t.me/+AbCdEf123",
        botUsername: "QuipoBot",
      })
    ).toBe("https://t.me/+AbCdEf123");
  });

  it("returns null when squad URL cannot be resolved", () => {
    expect(resolveSquadTelegramUrl({ username: "", inviteLink: "" })).toBeNull();
    expect(resolveSquadTelegramUrl({ username: "https://example.com/not-telegram", inviteLink: null })).toBeNull();
    expect(resolveSquadTelegramUrl({ inviteLink: "https://t.me/" })).toBeNull();
  });

  it("opens Telegram links via openTelegramLink in Mini App", () => {
    const openTelegramLink = vi.fn();
    const openLink = vi.fn();
    (window as any).Telegram = {
      WebApp: {
        openTelegramLink,
        openLink,
      },
    };

    expect(openTelegramTarget("https://t.me/durov")).toBe(true);
    expect(openTelegramLink).toHaveBeenCalledOnce();
    expect(openTelegramLink).toHaveBeenCalledWith("https://t.me/durov");
    expect(openLink).not.toHaveBeenCalled();
  });

  it("opens invite links via openTelegramLink in Mini App", () => {
    const openTelegramLink = vi.fn();
    const openLink = vi.fn();
    (window as any).Telegram = {
      WebApp: {
        openTelegramLink,
        openLink,
      },
    };

    expect(openTelegramTarget("https://t.me/+AbCdEf123")).toBe(true);
    expect(openTelegramLink).toHaveBeenCalledOnce();
    expect(openTelegramLink).toHaveBeenCalledWith("https://t.me/+AbCdEf123");
    expect(openLink).not.toHaveBeenCalled();
  });

  it("uses tg:// deep links on desktop platform", () => {
    const openTelegramLink = vi.fn();
    const openLink = vi.fn();
    (window as any).Telegram = {
      WebApp: {
        platform: "tdesktop",
        openTelegramLink,
        openLink,
      },
    };

    expect(openTelegramTarget("https://t.me/durov")).toBe(true);
    expect(openTelegramLink).toHaveBeenCalledWith("tg://resolve?domain=durov");
    expect(openLink).not.toHaveBeenCalled();

    openTelegramLink.mockClear();
    expect(openTelegramTarget("https://t.me/+AbCdEf123")).toBe(true);
    expect(openTelegramLink).toHaveBeenCalledWith("tg://join?invite=AbCdEf123");
  });

  it("falls back to window.open outside Telegram", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    expect(openTelegramTarget("https://t.me/durov")).toBe(true);
    expect(openSpy).toHaveBeenCalledOnce();
  });
});

describe("referral helpers", () => {
  it("builds start params for numeric and code referrals", () => {
    expect(buildReferralStartParam("123456")).toBe("ref_123456");
    expect(buildReferralStartParam(987654)).toBe("ref_987654");
    expect(buildReferralStartParam("AB12CD34")).toBe("refc_AB12CD34");
  });

  it("builds referral URL for QuipoBot by default", () => {
    expect(buildReferralUrl("AB12CD34")).toBe("https://t.me/QuipoBot?start=refc_AB12CD34");
  });

  it("parses modern and legacy referral start params", () => {
    expect(parseReferralStartParam("ref_123456")).toEqual({
      referrerTelegramId: 123456,
      referralCode: null,
    });

    expect(parseReferralStartParam("refc_AB12CD34")).toEqual({
      referrerTelegramId: null,
      referralCode: "AB12CD34",
    });

    expect(parseReferralStartParam("AB12CD34")).toEqual({
      referrerTelegramId: null,
      referralCode: "AB12CD34",
    });

    expect(parseReferralStartParam("123456789")).toEqual({
      referrerTelegramId: 123456789,
      referralCode: null,
    });
  });
});
