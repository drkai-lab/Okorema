import { desiredWindowSize, fireTimeMs, notificationTone } from "./escalation";
import type { EscalationState, PersistenceLevel, Tone } from "./types";

export type ScheduleReminder = {
  id: string;
  title: string;
  dueAt: string | null;
  preNotifyMinutes: number | null;
  persistence: PersistenceLevel;
  completedAt: string | null;
  snoozeUntil: string | null;
  deletedAt: string | null;
  occurrenceKey: string;
};

export type PlannedNotification = {
  reminderId: string;
  identifier: string;
  kind: "escalation" | "prenotify";
  index: number;
  fireAt: string;
  tone: Tone;
  occurrenceKey: string;
  persistence: PersistenceLevel;
  title: string;
  preNotifyMinutes: number | null;
};

export type BudgetReport = {
  limit: number;
  desiredCount: number;
  scheduledCount: number;
  truncated: boolean;
  weakenedReminderIds: string[];
};

export function seriesAnchor(reminder: ScheduleReminder): string | null {
  if (reminder.deletedAt || reminder.completedAt || !reminder.dueAt) {
    return null;
  }
  return reminder.snoozeUntil ?? reminder.dueAt;
}

/**
 * Continue an escalation series from persisted state.
 * Passed notices are consumed. A cold start after the anchor never rewinds to 1
 * when that first notice is already in the past.
 */
export function resumeEscalation(state: EscalationState, now: Date, level: PersistenceLevel): EscalationState {
  let next = state.nextIndex < 1 ? 1 : state.nextIndex;
  while (next <= state.scheduledThroughIndex) {
    if (fireTimeMs(state.anchorAt, level, next) > now.getTime()) {
      return { ...state, nextIndex: next };
    }
    next += 1;
  }
  let guard = 0;
  while (fireTimeMs(state.anchorAt, level, next) <= now.getTime()) {
    next += 1;
    guard += 1;
    if (guard > 100_000) {
      break;
    }
  }
  return { ...state, nextIndex: next };
}

export function reconcileEscalation(
  previous: EscalationState | null,
  reminder: ScheduleReminder,
  now: Date,
): EscalationState | null {
  const anchor = seriesAnchor(reminder);
  if (!anchor) {
    return null;
  }
  if (!previous || previous.reminderId !== reminder.id || previous.anchorAt !== anchor) {
    return resumeEscalation(
      {
        reminderId: reminder.id,
        anchorAt: anchor,
        nextIndex: 1,
        scheduledThroughIndex: 0,
      },
      now,
      reminder.persistence,
    );
  }
  return resumeEscalation(previous, now, reminder.persistence);
}

export function markDelivered(state: EscalationState, index: number): EscalationState {
  if (!Number.isInteger(index) || index < state.nextIndex) {
    return state;
  }
  return { ...state, nextIndex: index + 1 };
}

function prenotifyFor(reminder: ScheduleReminder, now: Date): PlannedNotification | null {
  if (!reminder.dueAt || reminder.preNotifyMinutes == null || reminder.snoozeUntil) {
    return null;
  }
  const fire = new Date(reminder.dueAt).getTime() - reminder.preNotifyMinutes * 60_000;
  if (fire <= now.getTime()) {
    return null;
  }
  return {
    reminderId: reminder.id,
    identifier: `pre:${reminder.id}:${reminder.occurrenceKey}`,
    kind: "prenotify",
    index: 0,
    fireAt: new Date(fire).toISOString(),
    tone: "plain",
    occurrenceKey: reminder.occurrenceKey,
    persistence: reminder.persistence,
    title: reminder.title,
    preNotifyMinutes: reminder.preNotifyMinutes,
  };
}

function allocateWindows(orderedIds: string[], desired: Record<string, number>, budget: number): Record<string, number> {
  const cap: Record<string, number> = {};
  for (const id of orderedIds) {
    cap[id] = 0;
  }
  let remaining = Math.max(0, budget);
  let progressed = true;
  while (remaining > 0 && progressed) {
    progressed = false;
    for (const id of orderedIds) {
      if (remaining <= 0) {
        break;
      }
      if (cap[id] < (desired[id] ?? 0)) {
        cap[id] += 1;
        remaining -= 1;
        progressed = true;
      }
    }
  }
  return cap;
}

export function planNotifications(
  reminders: ScheduleReminder[],
  previousStates: EscalationState[],
  now: Date,
  limit: number,
): { notifications: PlannedNotification[]; states: EscalationState[]; report: BudgetReport } {
  const previousById = new Map(previousStates.map((state) => [state.reminderId, state]));
  const active = reminders
    .map((reminder) => ({
      reminder,
      state: reconcileEscalation(previousById.get(reminder.id) ?? null, reminder, now),
    }))
    .filter((entry): entry is { reminder: ScheduleReminder; state: EscalationState } => entry.state != null);

  const wantedPre = active
    .map((entry) => prenotifyFor(entry.reminder, now))
    .filter((item): item is PlannedNotification => item != null)
    .sort((a, b) => (a.fireAt < b.fireAt ? -1 : 1));
  const keptPre = wantedPre.slice(0, Math.max(0, limit));
  const escalationBudget = Math.max(0, limit - keptPre.length);

  const ordered = [...active].sort((a, b) => {
    const aFire = fireTimeMs(a.state.anchorAt, a.reminder.persistence, a.state.nextIndex);
    const bFire = fireTimeMs(b.state.anchorAt, b.reminder.persistence, b.state.nextIndex);
    return aFire - bFire;
  });
  const desired: Record<string, number> = {};
  for (const entry of ordered) {
    desired[entry.reminder.id] = desiredWindowSize(entry.reminder.persistence);
  }
  const caps = allocateWindows(
    ordered.map((entry) => entry.reminder.id),
    desired,
    escalationBudget,
  );

  const notifications: PlannedNotification[] = [...keptPre];
  const states: EscalationState[] = [];
  for (const entry of active) {
    const cap = caps[entry.reminder.id] ?? 0;
    let through = entry.state.scheduledThroughIndex;
    for (let offset = 0; offset < cap; offset += 1) {
      const index = entry.state.nextIndex + offset;
      const fire = fireTimeMs(entry.state.anchorAt, entry.reminder.persistence, index);
      notifications.push({
        reminderId: entry.reminder.id,
        identifier: `esc:${entry.reminder.id}:${entry.state.anchorAt}:${index}`,
        kind: "escalation",
        index,
        fireAt: new Date(fire).toISOString(),
        tone: notificationTone(entry.reminder.persistence, index),
        occurrenceKey: entry.reminder.occurrenceKey,
        persistence: entry.reminder.persistence,
        title: entry.reminder.title,
        preNotifyMinutes: null,
      });
      through = index;
    }
    states.push({ ...entry.state, scheduledThroughIndex: cap > 0 ? through : entry.state.scheduledThroughIndex });
  }

  const desiredCount =
    wantedPre.length + active.reduce((sum, entry) => sum + desiredWindowSize(entry.reminder.persistence), 0);
  const scheduledCount = notifications.length;
  const weakenedReminderIds = active
    .filter((entry) => (caps[entry.reminder.id] ?? 0) < desiredWindowSize(entry.reminder.persistence))
    .map((entry) => entry.reminder.id);

  return {
    notifications,
    states,
    report: {
      limit,
      desiredCount,
      scheduledCount,
      truncated: scheduledCount < desiredCount,
      weakenedReminderIds,
    },
  };
}
