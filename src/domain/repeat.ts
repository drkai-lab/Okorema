import type { RepeatRule } from "./types";

const WEEKDAY = new Set([1, 2, 3, 4, 5]);

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function addMonthsClamped(date: Date, months: number, dayOfMonth: number, timeSource: Date): Date {
  const monthIndex = date.getMonth() + months;
  const year = date.getFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const next = new Date(
    year,
    month,
    Math.min(dayOfMonth, lastDay),
    timeSource.getHours(),
    timeSource.getMinutes(),
    timeSource.getSeconds(),
    timeSource.getMilliseconds(),
  );
  return next;
}

function step(current: Date, rule: Exclude<RepeatRule, "none">, original: Date): Date {
  if (rule === "daily") {
    return addDays(current, 1);
  }
  if (rule === "weekly") {
    return addDays(current, 7);
  }
  if (rule === "weekdays") {
    let cursor = addDays(current, 1);
    while (!WEEKDAY.has(cursor.getDay())) {
      cursor = addDays(cursor, 1);
    }
    return cursor;
  }
  return addMonthsClamped(current, 1, original.getDate(), original);
}

/**
 * Next occurrence strictly after `after`, keeping the original clock time.
 * Missed slots are skipped so one completion cannot land in the past and
 * immediately look overdue again.
 */
export function nextOccurrence(dueAt: Date, rule: RepeatRule, after: Date): Date | null {
  if (rule === "none") {
    return null;
  }
  let cursor = new Date(dueAt.getTime());
  for (let i = 0; i < 5000; i += 1) {
    cursor = step(cursor, rule, dueAt);
    if (cursor.getTime() > after.getTime()) {
      return cursor;
    }
  }
  return null;
}
