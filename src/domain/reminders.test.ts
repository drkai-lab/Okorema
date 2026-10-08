import { describe, expect, it } from "vitest";

import { escalationCopy } from "./copy";
import { desiredWindowSize, effectivePersistence, escalationOffsetMinutes, IOS_PENDING_NOTIFICATION_LIMIT, notificationTone } from "./escalation";
import { selectImportableReminders } from "./importFilter";
import { sortPlacesByDistance } from "./geo";
import { completedSince, completeReminder, snoozeAll, snoozeReminder, undoReminder, visibleCompleted } from "./mutation";
import { isOverdue, overdueReminders } from "./overdue";
import { nextOccurrence } from "./repeat";
import { planNotifications, resumeEscalation, type ScheduleReminder } from "./schedule";
import { freshClocks, occurrenceKeyFor, type EscalationState, type Reminder } from "./types";

function reminder(overrides: Partial<Reminder> = {}): Reminder {
  const id = overrides.id ?? "rem-1";
  const dueAt = overrides.dueAt === undefined ? "2026-10-08T00:00:00.000Z" : overrides.dueAt;
  const now = "2026-10-01T00:00:00.000Z";
  return {
    id,
    listId: "list-1",
    title: "牛乳を買う",
    notes: "",
    dueAt,
    preNotifyMinutes: null,
    repeatRule: "none",
    repeatAnchorAt: dueAt,
    persistence: "normal",
    completedAt: null,
    snoozeUntil: null,
    lastMutationId: null,
    undoSnapshot: null,
    geofence: null,
    externalRecurrence: null,
    clocks: freshClocks(now),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
    occurrenceKey: overrides.occurrenceKey ?? occurrenceKeyFor(id, dueAt),
  };
}

function scheduleOf(item: Reminder): ScheduleReminder {
  return {
    id: item.id,
    title: item.title,
    dueAt: item.dueAt,
    preNotifyMinutes: item.preNotifyMinutes,
    persistence: item.persistence,
    completedAt: item.completedAt,
    snoozeUntil: item.snoozeUntil,
    deletedAt: item.deletedAt,
    occurrenceKey: item.occurrenceKey,
  };
}

describe("escalation offsets and tone", () => {
  it("places 13 oni notices inside two hours, then hourly", () => {
    const within = [];
    for (let index = 1; index < 40; index += 1) {
      const offset = escalationOffsetMinutes("oni", index);
      if (offset <= 120) {
        within.push(offset);
      } else {
        break;
      }
    }
    expect(within).toHaveLength(13);
    expect(escalationOffsetMinutes("oni", 13)).toBe(120);
    expect(escalationOffsetMinutes("oni", 14)).toBe(180);
    expect(escalationOffsetMinutes("oni", 15)).toBe(240);
    expect(desiredWindowSize("oni")).toBe(13);
  });

  it("keeps gentle slower than normal, and changes tone by level", () => {
    expect(escalationOffsetMinutes("gentle", 2)).toBeGreaterThan(escalationOffsetMinutes("normal", 2));
    expect(notificationTone("gentle", 1)).toBe("plain");
    expect(notificationTone("gentle", 4)).toBe("plain");
    expect(notificationTone("normal", 1)).toBe("plain");
    expect(notificationTone("normal", 2)).toBe("scolding");
    expect(notificationTone("oni", 1)).toBe("scolding");
    expect(escalationCopy("oni", 1, "提出", "ja").body).toContain("放置しない");
    expect(escalationCopy("normal", 1, "提出", "ja").body).not.toContain("放置しない");
    expect(escalationCopy("normal", 2, "提出", "en").tone).toBe("scolding");
    expect(effectivePersistence("oni", false)).toBe("normal");
    expect(effectivePersistence("oni", true)).toBe("oni");
    expect(selectImportableReminders([
      { dueAt: "2026-10-08T00:00:00.000Z", repeating: false },
      { dueAt: null, repeating: false },
      { dueAt: "2026-10-08T00:00:00.000Z", repeating: true },
    ])).toHaveLength(1);
  });
});

describe("resume keeps the escalation counter", () => {
  const anchor = "2026-10-08T00:00:00.000Z";

  it("does not rewind a persisted index when the app restarts", () => {
    const state: EscalationState = {
      reminderId: "rem-1",
      anchorAt: anchor,
      nextIndex: 5,
      scheduledThroughIndex: 8,
    };
    const beforeFifth = new Date(new Date(anchor).getTime() + escalationOffsetMinutes("oni", 5) * 60_000 - 1000);
    const resumed = resumeEscalation(state, beforeFifth, "oni");
    expect(resumed.nextIndex).toBe(5);
    expect(resumed.nextIndex).not.toBe(1);
  });

  it("advances through notices whose scheduled time has already passed", () => {
    const state: EscalationState = {
      reminderId: "rem-1",
      anchorAt: anchor,
      nextIndex: 1,
      scheduledThroughIndex: 13,
    };
    const afterBurst = new Date(new Date(anchor).getTime() + 125 * 60_000);
    expect(resumeEscalation(state, afterBurst, "oni").nextIndex).toBe(14);
  });

  it("cold-starts from elapsed time instead of notice 1", () => {
    const state: EscalationState = {
      reminderId: "rem-1",
      anchorAt: anchor,
      nextIndex: 1,
      scheduledThroughIndex: 0,
    };
    const threeHoursLater = new Date(new Date(anchor).getTime() + 3 * 60 * 60_000);
    const resumed = resumeEscalation(state, threeHoursLater, "oni");
    expect(resumed.nextIndex).toBeGreaterThan(1);
    const fire = new Date(anchor).getTime() + escalationOffsetMinutes("oni", resumed.nextIndex) * 60_000;
    expect(fire).toBeGreaterThan(threeHoursLater.getTime());
  });
});

describe("scheduling window and the iOS 64 cap", () => {
  it("bakes the persisted index into the next notification", () => {
    const dueAt = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
    const item = reminder({ dueAt, persistence: "oni", occurrenceKey: occurrenceKeyFor("rem-1", dueAt) });
    const state: EscalationState = {
      reminderId: item.id,
      anchorAt: dueAt,
      nextIndex: 5,
      scheduledThroughIndex: 8,
    };
    const plan = planNotifications([scheduleOf(item)], [state], new Date(), IOS_PENDING_NOTIFICATION_LIMIT);
    const first = plan.notifications.find((notification) => notification.kind === "escalation");
    expect(first?.index).toBe(5);
    expect(first?.identifier).toContain(":5");
    expect(plan.states[0]?.nextIndex).toBe(5);
  });

  it("warns and shortens windows when full strength would exceed 64", () => {
    const reminders = Array.from({ length: 10 }, (_, index) => {
      const dueAt = new Date(Date.now() + (index + 1) * 60 * 60_000).toISOString();
      return scheduleOf(
        reminder({
          id: `rem-${index}`,
          dueAt,
          persistence: "normal",
          occurrenceKey: occurrenceKeyFor(`rem-${index}`, dueAt),
        }),
      );
    });
    const plan = planNotifications(reminders, [], new Date(), IOS_PENDING_NOTIFICATION_LIMIT);
    expect(plan.report.truncated).toBe(true);
    expect(plan.report.scheduledCount).toBeLessThanOrEqual(IOS_PENDING_NOTIFICATION_LIMIT);
    expect(plan.report.desiredCount).toBeGreaterThan(IOS_PENDING_NOTIFICATION_LIMIT);
    expect(plan.report.weakenedReminderIds.length).toBeGreaterThan(0);
    const counts = new Map<string, number>();
    for (const notification of plan.notifications) {
      counts.set(notification.reminderId, (counts.get(notification.reminderId) ?? 0) + 1);
    }
    const soonest = counts.get("rem-0") ?? 0;
    const latest = counts.get("rem-9") ?? 0;
    expect(soonest).toBeGreaterThanOrEqual(latest);
    expect(soonest).toBeLessThan(desiredWindowSize("normal"));
  });

  it("schedules a single pre-notification inside the budget", () => {
    const dueAt = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
    const item = scheduleOf(reminder({ dueAt, preNotifyMinutes: 30, occurrenceKey: occurrenceKeyFor("rem-1", dueAt) }));
    const plan = planNotifications([item], [], new Date(), IOS_PENDING_NOTIFICATION_LIMIT);
    const prenotifies = plan.notifications.filter((notification) => notification.kind === "prenotify");
    expect(prenotifies).toHaveLength(1);
    expect(plan.report.truncated).toBe(false);
  });
});

describe("repeat, completion, snooze, overdue", () => {
  it("skips missed daily slots and lands on the next future clock time", () => {
    const due = new Date(2026, 9, 5, 9, 0, 0);
    const completedAt = new Date(2026, 9, 7, 15, 0, 0);
    const next = nextOccurrence(due, "daily", completedAt);
    expect(next?.getFullYear()).toBe(2026);
    expect(next?.getMonth()).toBe(9);
    expect(next?.getDate()).toBe(8);
    expect(next?.getHours()).toBe(9);
  });

  it("moves weekdays from Friday to Monday and clamps month ends", () => {
    const friday = new Date(2026, 9, 9, 9, 0, 0);
    const monday = nextOccurrence(friday, "weekdays", friday);
    expect(monday?.getDay()).toBe(1);
    expect(monday?.getDate()).toBe(12);

    const jan31 = new Date(2026, 0, 31, 9, 0, 0);
    const february = nextOccurrence(jan31, "monthly", jan31);
    expect(february?.getMonth()).toBe(1);
    expect(february?.getDate()).toBe(28);
    const march = nextOccurrence(jan31, "monthly", february as Date);
    expect(march?.getMonth()).toBe(2);
    expect(march?.getDate()).toBe(31);
  });

  it("advances once and ignores a second complete of the same occurrence", () => {
    const due = new Date(2026, 9, 8, 9, 0, 0);
    const item = reminder({
      dueAt: due.toISOString(),
      repeatRule: "daily",
      occurrenceKey: occurrenceKeyFor("rem-1", due.toISOString()),
    });
    const now = new Date(2026, 9, 8, 9, 5, 0);
    const first = completeReminder(item, {
      now,
      requestId: "tap-1",
      occurrenceKey: item.occurrenceKey,
      logId: "log-1",
    });
    const second = completeReminder(first.reminder, {
      now,
      requestId: "notif-1",
      occurrenceKey: item.occurrenceKey,
      logId: "log-2",
    });
    const sameRequest = completeReminder(first.reminder, {
      now,
      requestId: "tap-1",
      occurrenceKey: first.reminder.occurrenceKey,
      logId: "log-3",
    });
    expect(first.status).toBe("applied");
    expect(second.status).toBe("stale");
    expect(second.reminder.dueAt).toBe(first.reminder.dueAt);
    expect(sameRequest.status).toBe("duplicate");
    expect(first.log?.title).toBe(item.title);
    const undone = undoReminder(first.reminder, now, "undo-1");
    expect(undone.status).toBe("applied");
    expect(undone.reminder.dueAt).toBe(item.dueAt);
    expect(undone.reminder.occurrenceKey).toBe(item.occurrenceKey);
  });

  it("snoozes without moving the due time or the repeat", () => {
    const item = reminder({ repeatRule: "daily" });
    const now = new Date("2026-10-08T01:00:00.000Z");
    const snoozed = snoozeReminder(item, {
      now,
      minutes: 10,
      requestId: "snooze-1",
      occurrenceKey: item.occurrenceKey,
    });
    const again = snoozeReminder(snoozed.reminder, {
      now,
      minutes: 10,
      requestId: "snooze-1",
      occurrenceKey: item.occurrenceKey,
    });
    expect(snoozed.status).toBe("applied");
    expect(snoozed.reminder.dueAt).toBe(item.dueAt);
    expect(snoozed.reminder.repeatRule).toBe("daily");
    expect(new Date(snoozed.reminder.snoozeUntil ?? 0).getTime() - now.getTime()).toBe(10 * 60_000);
    expect(again.status).toBe("duplicate");
    expect(isOverdue(item, now)).toBe(true);
    expect(isOverdue(snoozed.reminder, new Date(now.getTime() + 5 * 60_000))).toBe(false);
    expect(isOverdue(snoozed.reminder, new Date(now.getTime() + 11 * 60_000))).toBe(true);
  });

  it("snoozes every overdue reminder and counts recent completions", () => {
    const now = new Date("2026-10-08T01:00:00.000Z");
    const items = [
      reminder({ id: "a", dueAt: "2026-10-08T00:00:00.000Z", occurrenceKey: occurrenceKeyFor("a", "2026-10-08T00:00:00.000Z") }),
      reminder({ id: "b", dueAt: "2026-10-08T00:30:00.000Z", occurrenceKey: occurrenceKeyFor("b", "2026-10-08T00:30:00.000Z") }),
      reminder({ id: "c", dueAt: "2026-10-09T00:00:00.000Z", occurrenceKey: occurrenceKeyFor("c", "2026-10-09T00:00:00.000Z") }),
    ];
    const overdue = overdueReminders(items, now);
    expect(overdue.map((item) => item.id)).toEqual(["a", "b"]);
    const snoozed = snoozeAll(overdue, now, 10, "all");
    expect(snoozed.every((item) => item.dueAt === items.find((original) => original.id === item.id)?.dueAt)).toBe(true);
    expect(overdueReminders(snoozed, now)).toHaveLength(0);

    const done = completeReminder(items[2], {
      now,
      requestId: "done",
      occurrenceKey: items[2].occurrenceKey,
      logId: "log",
    });
    expect(visibleCompleted([done.reminder], [], 5)).toHaveLength(1);
    expect(completedSince(done.log ? [done.log] : [], now, 7)).toBe(1);
    expect(completedSince(done.log ? [done.log] : [], new Date("2026-10-20T00:00:00.000Z"), 7)).toBe(0);
  });
});

describe("place search order", () => {
  it("sorts places by distance from the current location", () => {
    const origin = { latitude: 35.6812, longitude: 139.7671 };
    const sorted = sortPlacesByDistance(origin, [
      { id: "far", latitude: 34.6937, longitude: 135.5023 },
      { id: "near", latitude: 35.6895, longitude: 139.6917 },
      { id: "mid", latitude: 35.4437, longitude: 139.638 },
    ]);
    expect(sorted.map((place) => place.id)).toEqual(["near", "mid", "far"]);
  });
});
