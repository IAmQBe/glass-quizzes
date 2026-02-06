import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function pluralizeRu(count: number, one: string, few: string, many: string) {
  const abs = Math.abs(count);
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = abs % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function formatQuestionCount(count: number) {
  return `${count} ${pluralizeRu(count, "вопрос", "вопроса", "вопросов")}`;
}
