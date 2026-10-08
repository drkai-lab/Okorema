import { completedSince } from "./mutation";
import { effectiveDueIso, isOverdue, overdueReminders, remindersDueToday, upcomingReminders } from "./overdue";
import type { CompletionLog, Reminder } from "./types";

export type WidgetTodayItem = {
  id: string;
  occurrenceKey: string;
  title: string;
  done: boolean;
};

export type WidgetSnapshot = {
  nextTitle: string;
  nextDue: string;
  counts: string;
  today: WidgetTodayItem[];
};

export function buildWidgetSnapshot(
  reminders: Reminder[],
  logs: CompletionLog[],
  now: Date,
  labels: { noUpcoming: string; overdue: (count: number) => string; week: (count: number) => string },
  formatDue: (iso: string | null) => string,
): WidgetSnapshot {
  const active = reminders.filter((reminder) => !reminder.deletedAt);
  const next = upcomingReminders(active, now, 1)[0];
  const overdue = overdueReminders(active, now).length;
  const week = completedSince(logs, now, 7);
  const today = remindersDueToday(active, now)
    .filter((reminder) => !isOverdue(reminder, now))
    .slice(0, 3)
    .map((reminder) => ({
      id: reminder.id,
      occurrenceKey: reminder.occurrenceKey,
      title: reminder.title,
      done: false,
    }));
  const due = next ? effectiveDueIso(next) : null;
  return {
    nextTitle: next?.title ?? labels.noUpcoming,
    nextDue: due ? formatDue(due) : "",
    counts: `${labels.overdue(overdue)} · ${labels.week(week)}`,
    today,
  };
}
