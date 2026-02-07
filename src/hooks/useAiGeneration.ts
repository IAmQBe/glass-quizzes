import { useMutation, useQuery } from "@tanstack/react-query";
import { getTelegram } from "@/lib/telegram";

export type AiContentType = "quiz" | "personality_test";

export type AiQuotaSnapshot = {
  free_quiz_used?: number | null;
  free_test_used?: number | null;
  paid_credits?: number | null;
  free_quiz_limit?: number | null;
  free_test_limit?: number | null;
  free_quiz_remaining?: number | null;
  free_test_remaining?: number | null;
  paid_credits_remaining?: number | null;
};

export type AiQuizVariant = {
  title: string;
  description: string;
  cover_image_keywords: string[];
  questions: Array<{
    text: string;
    options: string[];
    correctAnswer: number;
  }>;
};

export type AiPersonalityTestVariant = {
  title: string;
  description: string;
  cover_image_keywords: string[];
  results: Array<{
    result_key: string;
    title: string;
    description: string;
    share_text: string;
    image_keywords: string[];
  }>;
  questions: Array<{
    question_text: string;
    answers: Array<{
      answer_text: string;
      result_points: Record<string, number>;
    }>;
  }>;
};

export class ApiError extends Error {
  status: number;
  payload: any;

  constructor(message: string, status: number, payload?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

const getApiUrl = () => {
  const url = import.meta.env.VITE_API_URL as string | undefined;
  return url?.replace(/\/+$/, "") || null;
};

const getInitDataAuthHeader = () => {
  const initData = getTelegram()?.initData;
  if (!initData) return null;
  return `tma ${initData}`;
};

export const useAiQuota = (opts?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["aiQuota"],
    queryFn: async (): Promise<AiQuotaSnapshot | null> => {
      const apiUrl = getApiUrl();
      const authHeader = getInitDataAuthHeader();

      if (!apiUrl) {
        throw new Error("VITE_API_URL is not configured");
      }
      if (!authHeader) {
        throw new Error("Откройте приложение через Telegram");
      }

      const res = await fetch(`${apiUrl}/api/ai/quota`, {
        headers: { Authorization: authHeader },
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new ApiError(payload?.error || "Failed to load quota", res.status, payload);
      }

      return payload?.quota || null;
    },
    enabled: opts?.enabled ?? true,
    staleTime: 1000 * 30,
  });
};

export const useAiGenerate = () => {
  return useMutation({
    mutationFn: async (args: {
      contentType: AiContentType;
      prompt: string;
      options?: { question_count?: number; results_count?: number };
    }): Promise<{
      variants: AiQuizVariant[] | AiPersonalityTestVariant[];
      quota: AiQuotaSnapshot | null;
    }> => {
      const apiUrl = getApiUrl();
      const authHeader = getInitDataAuthHeader();

      if (!apiUrl) {
        throw new Error("VITE_API_URL is not configured");
      }
      if (!authHeader) {
        throw new Error("Откройте приложение через Telegram");
      }

      const res = await fetch(`${apiUrl}/api/ai/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          contentType: args.contentType,
          prompt: args.prompt,
          options: args.options || {},
        }),
      });

      const payload = await res.json().catch(() => null);
      if (res.status === 402) {
        throw new ApiError("payment_required", 402, payload);
      }
      if (!res.ok) {
        throw new ApiError(payload?.error || "AI generate failed", res.status, payload);
      }

      return {
        variants: payload?.variants || [],
        quota: payload?.quota || null,
      };
    },
  });
};

export const useAiCreateInvoice = () => {
  return useMutation({
    mutationFn: async (): Promise<{ invoiceLink: string; payload?: string }> => {
      const apiUrl = getApiUrl();
      const authHeader = getInitDataAuthHeader();

      if (!apiUrl) {
        throw new Error("VITE_API_URL is not configured");
      }
      if (!authHeader) {
        throw new Error("Откройте приложение через Telegram");
      }

      const res = await fetch(`${apiUrl}/api/payments/ai-generation-invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ quantity: 1 }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new ApiError(payload?.error || "Failed to create invoice", res.status, payload);
      }

      if (!payload?.invoiceLink) {
        throw new Error("Server did not return invoiceLink");
      }

      return { invoiceLink: payload.invoiceLink, payload: payload.payload };
    },
  });
};
