import { notificationTone } from "./escalation";
import type { PersistenceLevel } from "./types";

export type AppLocale = "ja" | "en";

export type NotificationCopy = {
  title: string;
  body: string;
  tone: "plain" | "scolding";
};

const NORMAL_SCOLD_JA = [
  "「{title}」、まだ手を付けてないね。今やろう。",
  "「{title}」を後回しにしない。終わらせて。",
  "さっき言った「{title}」、まだ残ってるよ。",
];

const NORMAL_SCOLD_EN = [
  "{title} is still sitting there. Do it now.",
  "Stop postponing {title}. Finish it.",
  "{title} has not moved. It is still your turn.",
];

const ONI_JA = [
  "「{title}」を放置しない。今すぐ終わらせる。",
  "「{title}」、{n}回目。完了するまで止まらない。",
  "まだ「{title}」が残っている。片付けるまで通知は続く。",
];

const ONI_EN = [
  "Do not leave {title}. Finish it now.",
  "{title}, notice {n}. This continues until you mark it done.",
  "{title} is still open. The alerts keep coming.",
];

function fill(template: string, title: string, n: number): string {
  return template.replaceAll("{title}", title).replaceAll("{n}", String(n));
}

export function escalationCopy(
  level: PersistenceLevel,
  index: number,
  title: string,
  locale: AppLocale,
): NotificationCopy {
  const tone = notificationTone(level, index);
  const safeTitle = title.trim() || (locale === "ja" ? "リマインダー" : "Reminder");

  if (level === "gentle") {
    if (locale === "ja") {
      return {
        tone,
        title: "Okorema!",
        body:
          index === 1
            ? `「${safeTitle}」の時間です。`
            : `「${safeTitle}」はまだ完了していません。（${index}）`,
      };
    }
    return {
      tone,
      title: "Okorema!",
      body:
        index === 1
          ? `It's time: ${safeTitle}.`
          : `${safeTitle} is still open. (${index})`,
    };
  }

  if (level === "normal" && index <= 1) {
    return locale === "ja"
      ? { tone, title: "Okorema!", body: `「${safeTitle}」の時間です。` }
      : { tone, title: "Okorema!", body: `It's time: ${safeTitle}.` };
  }

  if (level === "normal") {
    const bank = locale === "ja" ? NORMAL_SCOLD_JA : NORMAL_SCOLD_EN;
    const template = bank[(index - 2) % bank.length];
    return {
      tone,
      title: "Okorema!",
      body: `${fill(template, safeTitle, index)} (${index})`,
    };
  }

  const bank = locale === "ja" ? ONI_JA : ONI_EN;
  const template = bank[(index - 1) % bank.length];
  return {
    tone,
    title: locale === "ja" ? "Okorema! 鬼モード" : "Okorema! Oni mode",
    body: fill(template, safeTitle, index),
  };
}

export function preNotifyCopy(title: string, minutes: number, locale: AppLocale): NotificationCopy {
  const safeTitle = title.trim() || (locale === "ja" ? "リマインダー" : "Reminder");
  if (locale === "ja") {
    return {
      tone: "plain",
      title: "Okorema!",
      body: `「${safeTitle}」まであと${minutes}分です。`,
    };
  }
  return {
    tone: "plain",
    title: "Okorema!",
    body: `${safeTitle} is due in ${minutes} minutes.`,
  };
}
