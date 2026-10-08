import type { Reminder } from "./types";

export function effectiveDueIso(reminder: Pick<Reminder, "dueAt" | "snoozeUntil" | "completedAt" | "deletedAt">): string | null {
  if (reminder.deletedAt || reminder.completedAt || !reminder.dueAt) {
    return null;
  }
  return reminder.snoozeUntil ?? reminder.dueAt;
}

export function isOverdue(
  reminder: Pick<Reminder, "dueAt" | "snoozeUntil" | "completedAt" | "deletedAt">,
  now: Date,
): boolean {
  const due = effectiveDueIso(reminder);
  if (!due) {
    return false;
  }
  return new Date(due).getTime() <= now.getTime();
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function upcomingReminders<T extends Reminder>(reminders: T[], now: Date, limit: number): T[] {
  return reminders
    .filter((reminder) => {
      const due = effectiveDueIso(reminder);
      return Boolean(due) && new Date(due as string).getTime() > now.getTime();
    })
    .sort((a, b) => new Date(effectiveDueIso(a) as string).getTime() - new Date(effectiveDueIso(b) as string).getTime())
    .slice(0, limit);
}

export function remindersDueToday<T extends Reminder>(reminders: T[], now: Date): T[] {
  return reminders
    .filter((reminder) => {
      if (reminder.deletedAt || reminder.completedAt || !reminder.dueAt) {
        return false;
      }
      const due = new Date(reminder.snoozeUntil ?? reminder.dueAt);
      return isSameLocalDay(due, now);
    })
    .sort((a, b) => new Date(a.snoozeUntil ?? a.dueAt ?? 0).getTime() - new Date(b.snoozeUntil ?? b.dueAt ?? 0).getTime());
}

export function overdueReminders<T extends Reminder>(reminders: T[], now: Date): T[] {
  return reminders
    .filter((reminder) => isOverdue(reminder, now))
    .sort((a, b) => {
      const aDue = new Date(effectiveDueIso(a) ?? 0).getTime();
      const bDue = new Date(effectiveDueIso(b) ?? 0).getTime();
      return aDue - bDue;
    });
}
