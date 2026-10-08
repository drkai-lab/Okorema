import type { RepeatRule } from "../types";

const DAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR"];

export function toRRule(rule: RepeatRule, due: Date): string | null {
  if (rule === "none") {
    return null;
  }
  if (rule === "daily") {
    return "RRULE:FREQ=DAILY";
  }
  if (rule === "weekdays") {
    return "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
  }
  if (rule === "weekly") {
    return `RRULE:FREQ=WEEKLY;BYDAY=${DAY[due.getDay()]}`;
  }
  return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${due.getDate()}`;
}

function parseParts(rrule: string): Map<string, string> {
  const body = rrule.trim().replace(/^RRULE:/i, "");
  const parts = new Map<string, string>();
  for (const chunk of body.split(";")) {
    const [key, value] = chunk.split("=");
    if (key && value) {
      parts.set(key.toUpperCase(), value.toUpperCase());
    }
  }
  return parts;
}

export function fromRRule(rrule: string): RepeatRule | "unsupported" {
  const parts = parseParts(rrule);
  const freq = parts.get("FREQ");
  const interval = parts.get("INTERVAL");
  if (interval && interval !== "1") {
    return "unsupported";
  }
  if (freq === "DAILY" && !parts.get("BYDAY")) {
    return "daily";
  }
  if (freq === "WEEKLY") {
    const days = (parts.get("BYDAY") ?? "").split(",").filter(Boolean).sort();
    const weekdays = [...WEEKDAYS].sort();
    if (days.length === 1) {
      return "weekly";
    }
    if (days.join(",") === weekdays.join(",")) {
      return "weekdays";
    }
    return "unsupported";
  }
  if (freq === "MONTHLY") {
    const day = parts.get("BYMONTHDAY");
    if (day && !day.includes(",") && Number.isInteger(Number(day))) {
      return "monthly";
    }
  }
  return "unsupported";
}
