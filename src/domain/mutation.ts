import { nextOccurrence } from "./repeat";
import { occurrenceKeyFor, type CompletionLog, type Reminder } from "./types";

export type MutationStatus = "applied" | "duplicate" | "stale";

export type MutationResult = {
  status: MutationStatus;
  reminder: Reminder;
  previous: Reminder;
  log: CompletionLog | null;
};

export type CompleteInput = {
  now: Date;
  requestId: string;
  occurrenceKey: string;
  logId: string;
};

export type SnoozeInput = {
  now: Date;
  minutes: number;
  requestId: string;
  occurrenceKey: string;
};

function snapshot(reminder: Reminder): string {
  return JSON.stringify(reminder);
}

function refuse(status: Exclude<MutationStatus, "applied">, reminder: Reminder): MutationResult {
  return { status, reminder, previous: reminder, log: null };
}

export function completeReminder(reminder: Reminder, input: CompleteInput): MutationResult {
  if (reminder.deletedAt) {
    return refuse("stale", reminder);
  }
  if (reminder.lastMutationId === input.requestId) {
    return refuse("duplicate", reminder);
  }
  if (reminder.occurrenceKey !== input.occurrenceKey) {
    return refuse("stale", reminder);
  }
  if (reminder.completedAt && reminder.repeatRule === "none") {
    return refuse("duplicate", reminder);
  }

  const nowIso = input.now.toISOString();
  const previous = reminder;
  const log: CompletionLog = {
    id: input.logId,
    reminderId: reminder.id,
    title: reminder.title,
    completedAt: nowIso,
    undoneAt: null,
  };

  if (reminder.repeatRule === "none" || !reminder.dueAt) {
    return {
      status: "applied",
      previous,
      log,
      reminder: {
        ...reminder,
        completedAt: nowIso,
        snoozeUntil: null,
        lastMutationId: input.requestId,
        undoSnapshot: snapshot(reminder),
        clocks: { ...reminder.clocks, completed: nowIso },
        updatedAt: nowIso,
      },
    };
  }

  const origin = new Date(reminder.repeatAnchorAt ?? reminder.dueAt);
  const next = nextOccurrence(origin, reminder.repeatRule, input.now);
  if (!next) {
    return {
      status: "applied",
      previous,
      log,
      reminder: {
        ...reminder,
        completedAt: nowIso,
        snoozeUntil: null,
        repeatRule: "none",
        lastMutationId: input.requestId,
        undoSnapshot: snapshot(reminder),
        clocks: { ...reminder.clocks, completed: nowIso },
        updatedAt: nowIso,
      },
    };
  }

  const dueAt = next.toISOString();
  return {
    status: "applied",
    previous,
    log,
    reminder: {
      ...reminder,
      dueAt,
      completedAt: null,
      snoozeUntil: null,
      occurrenceKey: occurrenceKeyFor(reminder.id, dueAt),
      repeatAnchorAt: reminder.repeatAnchorAt ?? reminder.dueAt,
      externalRecurrence: null,
      lastMutationId: input.requestId,
      undoSnapshot: snapshot(reminder),
      clocks: { ...reminder.clocks, dueAt: nowIso, completed: nowIso },
      updatedAt: nowIso,
    },
  };
}

export function snoozeReminder(reminder: Reminder, input: SnoozeInput): MutationResult {
  if (reminder.deletedAt || reminder.completedAt) {
    return refuse("stale", reminder);
  }
  if (!Number.isFinite(input.minutes) || input.minutes <= 0) {
    return refuse("stale", reminder);
  }
  if (reminder.lastMutationId === input.requestId) {
    return refuse("duplicate", reminder);
  }
  if (reminder.occurrenceKey !== input.occurrenceKey) {
    return refuse("stale", reminder);
  }

  const nowIso = input.now.toISOString();
  const until = new Date(input.now.getTime() + input.minutes * 60_000).toISOString();
  return {
    status: "applied",
    previous: reminder,
    log: null,
    reminder: {
      ...reminder,
      snoozeUntil: until,
      lastMutationId: input.requestId,
      undoSnapshot: snapshot(reminder),
      updatedAt: nowIso,
    },
  };
}

export function snoozeAll(reminders: Reminder[], now: Date, minutes: number, requestPrefix: string): Reminder[] {
  return reminders.map((reminder) => {
    const result = snoozeReminder(reminder, {
      now,
      minutes,
      requestId: `${requestPrefix}:${reminder.id}:${reminder.occurrenceKey}`,
      occurrenceKey: reminder.occurrenceKey,
    });
    return result.reminder;
  });
}

export function undoReminder(reminder: Reminder, now: Date, requestId: string): MutationResult {
  if (!reminder.undoSnapshot) {
    return refuse("stale", reminder);
  }
  if (reminder.lastMutationId === requestId) {
    return refuse("duplicate", reminder);
  }
  let restored: Reminder;
  try {
    restored = JSON.parse(reminder.undoSnapshot) as Reminder;
  } catch {
    return refuse("stale", reminder);
  }
  const nowIso = now.toISOString();
  return {
    status: "applied",
    previous: reminder,
    log: null,
    reminder: {
      ...restored,
      undoSnapshot: null,
      lastMutationId: requestId,
      updatedAt: nowIso,
    },
  };
}

export function visibleCompleted(reminders: Reminder[], logs: CompletionLog[], limit: number): { title: string; completedAt: string; id: string }[] {
  const fromReminders = reminders
    .filter((reminder) => reminder.completedAt && !reminder.deletedAt)
    .map((reminder) => ({
      id: reminder.id,
      title: reminder.title,
      completedAt: reminder.completedAt as string,
    }));
  const fromLogs = logs
    .filter((log) => !log.undoneAt)
    .filter((log) => !fromReminders.some((item) => item.id === log.reminderId && item.completedAt === log.completedAt))
    .map((log) => ({ id: log.id, title: log.title, completedAt: log.completedAt }));
  return [...fromReminders, ...fromLogs]
    .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1))
    .slice(0, limit);
}

export function completedSince(logs: CompletionLog[], now: Date, days: number): number {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return logs.filter((log) => !log.undoneAt && new Date(log.completedAt).getTime() >= cutoff).length;
}
