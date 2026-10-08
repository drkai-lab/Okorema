import { getLocales } from "expo-localization";

import { isSameLocalDay } from "@/domain/overdue";
import type { AppLocale } from "@/domain/copy";

import { en, ja, type Messages } from "./messages";

export type { AppLocale };

export function resolveLocale(languageCode: string | null | undefined): AppLocale {
  if (languageCode === "en") {
    return "en";
  }
  return "ja";
}

export function deviceLocale(): AppLocale {
  return resolveLocale(getLocales()[0]?.languageCode);
}

export function messagesFor(locale: AppLocale): Messages {
  return locale === "en" ? en : ja;
}

export function formatDue(iso: string | null, locale: AppLocale, now: Date): string {
  if (!iso) {
    return messagesFor(locale).noDue;
  }
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  if (date.getTime() <= now.getTime()) {
    return locale === "ja" ? `期限切れ ${time}` : `Overdue ${time}`;
  }
  if (isSameLocalDay(date, now)) {
    return locale === "ja" ? `今日 ${time}` : `Today ${time}`;
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isSameLocalDay(date, tomorrow)) {
    return locale === "ja" ? `明日 ${time}` : `Tomorrow ${time}`;
  }
  const day = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(date);
  return `${day} ${time}`;
}

export function formatDateTime(iso: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
