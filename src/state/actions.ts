import { selectImportableReminders } from "@/domain/importFilter";
import { completeReminder, snoozeAll, snoozeReminder, undoReminder } from "@/domain/mutation";
import { overdueReminders } from "@/domain/overdue";
import type { BudgetReport } from "@/domain/schedule";
import { freshClocks, occurrenceKeyFor, type Reminder, type ReminderList } from "@/domain/types";
import { openRepository } from "@/db/openRepository";
import { createId, type Repository } from "@/db/repository";
import { deviceLocale, type AppLocale } from "@/i18n";
import { LIST_COLORS, LIST_ICONS } from "@/domain/appearance";
import { refreshSchedules } from "@/services/scheduler";
import { syncGeofences } from "@/services/places";

const listeners = new Set<() => void>();
let chain: Promise<unknown> = Promise.resolve();

export function onDataChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitDataChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = chain.then(work, work);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function isProFrom(settings: Record<string, string>): boolean {
  return settings.proStoreUnlocked === "1" || settings.proDevUnlock === "1";
}

export async function loadAll(repo: Repository) {
  const [lists, reminders, logs, settings] = await Promise.all([
    repo.lists(),
    repo.reminders(),
    repo.logs(),
    repo.settings(),
  ]);
  return { lists, reminders, logs, settings };
}

export async function reschedule(repo: Repository, locale: AppLocale, isPro: boolean): Promise<BudgetReport | null> {
  try {
    const reminders = await repo.reminders();
    await syncGeofences(reminders);
  } catch {
    // Location or notification services are unavailable in some runtimes.
  }
  try {
    return await refreshSchedules(repo, locale, isPro);
  } catch {
    return null;
  }
}

async function finish(repo: Repository): Promise<void> {
  const settings = await repo.settings();
  await reschedule(repo, deviceLocale(), isProFrom(settings));
}

export async function commitComplete(
  repo: Repository,
  reminderId: string,
  occurrenceKey: string,
  requestId: string,
): Promise<void> {
  const reminder = (await repo.reminders()).find((item) => item.id === reminderId);
  if (!reminder) {
    return;
  }
  const result = completeReminder(reminder, {
    now: new Date(),
    requestId,
    occurrenceKey,
    logId: createId(),
  });
  if (result.status !== "applied") {
    return;
  }
  await repo.saveReminder(result.reminder);
  if (result.log) {
    await repo.saveLog(result.log);
  }
  await finish(repo);
}

export async function commitSnooze(
  repo: Repository,
  reminderId: string,
  occurrenceKey: string,
  requestId: string,
): Promise<void> {
  const reminder = (await repo.reminders()).find((item) => item.id === reminderId);
  if (!reminder) {
    return;
  }
  const result = snoozeReminder(reminder, {
    now: new Date(),
    minutes: 10,
    requestId,
    occurrenceKey,
  });
  if (result.status !== "applied") {
    return;
  }
  await repo.saveReminder(result.reminder);
  await finish(repo);
}

export async function commitSnoozeAll(repo: Repository): Promise<void> {
  const now = new Date();
  const overdue = overdueReminders(await repo.reminders(), now);
  const next = snoozeAll(overdue, now, 10, `snooze-all:${now.toISOString()}`);
  for (const reminder of next) {
    await repo.saveReminder(reminder);
  }
  await finish(repo);
}

export async function commitUndo(repo: Repository, reminderId: string, requestId: string): Promise<boolean> {
  const reminder = (await repo.reminders()).find((item) => item.id === reminderId);
  if (!reminder) {
    return false;
  }
  const result = undoReminder(reminder, new Date(), requestId);
  if (result.status !== "applied") {
    return false;
  }
  await repo.saveReminder(result.reminder);
  const logs = await repo.logs();
  const matched = logs.find((log) => log.reminderId === reminderId && !log.undoneAt && log.completedAt === reminder.updatedAt);
  if (matched) {
    await repo.saveLog({ ...matched, undoneAt: new Date().toISOString() });
  }
  await finish(repo);
  return true;
}

export async function importDeviceItems(
  repo: Repository,
  items: { title: string; notes: string; dueAt: string; listName: string; repeating: boolean }[],
): Promise<number> {
  const selected = selectImportableReminders(items);
  const lists = await repo.lists();
  const now = new Date().toISOString();
  const byName = new Map(lists.filter((list) => !list.deletedAt).map((list) => [list.name, list]));
  let order = lists.length;
  for (const item of selected) {
    let list = byName.get(item.listName);
    if (!list) {
      list = {
        id: createId(),
        name: item.listName || "Reminders",
        color: LIST_COLORS[order % LIST_COLORS.length].id,
        icon: LIST_ICONS[order % LIST_ICONS.length].id,
        sortOrder: order,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        nameClock: now,
      };
      order += 1;
      byName.set(list.name, list);
      await repo.saveList(list);
    }
    const id = createId();
    const reminder: Reminder = {
      id,
      listId: list.id,
      title: item.title || item.notes || "Reminder",
      notes: item.notes,
      dueAt: item.dueAt,
      preNotifyMinutes: null,
      repeatRule: "none",
      repeatAnchorAt: null,
      persistence: "gentle",
      completedAt: null,
      snoozeUntil: null,
      occurrenceKey: occurrenceKeyFor(id, item.dueAt),
      lastMutationId: null,
      undoSnapshot: null,
      geofence: null,
      externalRecurrence: null,
      clocks: freshClocks(now),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await repo.saveReminder(reminder);
  }
  await finish(repo);
  return selected.length;
}

export async function seedDemo(repo: Repository): Promise<void> {
  const existing = await repo.reminders();
  if (existing.some((item) => item.title === "牛乳を買う")) {
    await repo.setSetting("onboarded", "1");
    return;
  }
  const now = new Date();
  const nowIso = now.toISOString();
  const specs: { name: string; color: string; icon: string }[] = [
    { name: "買い物", color: "persimmon", icon: "cart" },
    { name: "仕事", color: "sea", icon: "briefcase" },
    { name: "健康", color: "pine", icon: "pulse" },
  ];
  const lists: ReminderList[] = [];
  const current = await repo.lists();
  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index];
    const found = current.find((list) => list.name === spec.name && !list.deletedAt);
    if (found) {
      lists.push(found);
      continue;
    }
    const list: ReminderList = {
      id: createId(),
      name: spec.name,
      color: spec.color,
      icon: spec.icon,
      sortOrder: current.length + index,
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
      nameClock: nowIso,
    };
    lists.push(list);
    await repo.saveList(list);
  }
  const overdue = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const later = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();
  const tomorrow = new Date(now.getTime() + 26 * 60 * 60 * 1000).toISOString();
  const drafts: { list: ReminderList; title: string; dueAt: string | null; completedAt: string | null; notes: string }[] = [
    { list: lists[0], title: "牛乳を買う", dueAt: overdue, completedAt: null, notes: "駅前の店" },
    { list: lists[1], title: "報告書を送る", dueAt: later, completedAt: null, notes: "" },
    { list: lists[2], title: "歩く", dueAt: tomorrow, completedAt: null, notes: "20分" },
  ];
  for (const draft of drafts) {
    const id = createId();
    await repo.saveReminder({
      id,
      listId: draft.list.id,
      title: draft.title,
      notes: draft.notes,
      dueAt: draft.dueAt,
      preNotifyMinutes: 15,
      repeatRule: draft.title === "歩く" ? "daily" : "none",
      repeatAnchorAt: draft.title === "歩く" ? draft.dueAt : null,
      persistence: draft.title === "報告書を送る" ? "normal" : "gentle",
      completedAt: draft.completedAt,
      snoozeUntil: null,
      occurrenceKey: occurrenceKeyFor(id, draft.dueAt),
      lastMutationId: null,
      undoSnapshot: null,
      geofence: null,
      externalRecurrence: null,
      clocks: freshClocks(nowIso),
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
    });
  }
  await repo.setSetting("onboarded", "1");
  await finish(repo);
}

export async function openAppRepository(): Promise<Repository> {
  return openRepository();
}
