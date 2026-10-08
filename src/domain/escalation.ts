import type { PersistenceLevel, Tone } from "./types";

/** Apple caps pending local notifications at 64 per app. */
export const IOS_PENDING_NOTIFICATION_LIMIT = 64;

/**
 * Minutes after the series anchor when notice `index` (1-based) fires.
 *
 * Gentle: 0, 60, 180, then every 4 hours.
 * Normal: 0, 15, 30, 60, 90, 120, then hourly.
 * Oni: 13 notices across the first 2 hours (every 10 minutes, inclusive of
 * minute 120), then hourly forever.
 */
export function escalationOffsetMinutes(level: PersistenceLevel, index: number): number {
  if (!Number.isInteger(index) || index < 1) {
    throw new Error(`escalation index must be a positive integer, got ${index}`);
  }

  if (level === "gentle") {
    if (index === 1) return 0;
    if (index === 2) return 60;
    if (index === 3) return 180;
    return 180 + (index - 3) * 240;
  }

  if (level === "normal") {
    const head = [0, 15, 30, 60, 90, 120];
    if (index <= head.length) {
      return head[index - 1];
    }
    return 120 + (index - head.length) * 60;
  }

  if (index <= 13) {
    return (index - 1) * 10;
  }
  return 120 + (index - 13) * 60;
}

export function notificationTone(level: PersistenceLevel, index: number): Tone {
  if (level === "gentle") {
    return "plain";
  }
  if (level === "normal") {
    return index <= 1 ? "plain" : "scolding";
  }
  return "scolding";
}

/** How many future escalation notices we want pending when the OS budget allows. */
export function effectivePersistence(level: PersistenceLevel, isPro: boolean): PersistenceLevel {
  if (level === "oni" && !isPro) {
    return "normal";
  }
  return level;
}

export function desiredWindowSize(level: PersistenceLevel): number {
  if (level === "gentle") return 4;
  if (level === "normal") return 8;
  return 13;
}

export function fireTimeMs(anchorIso: string, level: PersistenceLevel, index: number): number {
  return new Date(anchorIso).getTime() + escalationOffsetMinutes(level, index) * 60_000;
}
