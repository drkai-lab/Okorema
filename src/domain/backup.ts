import type { CompletionLog, Reminder, ReminderList } from "./types";

export const BACKUP_FORMAT = "okorema-backup";
export const BACKUP_VERSION = 1;

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  lists: ReminderList[];
  reminders: Reminder[];
  completionLogs: CompletionLog[];
};

export type ImportResult =
  | {
      ok: true;
      lists: ReminderList[];
      reminders: Reminder[];
      completionLogs: CompletionLog[];
      addedLists: number;
      addedReminders: number;
      addedLogs: number;
      skipped: number;
    }
  | { ok: false; error: "invalid-backup" };

export function createBackup(
  lists: ReminderList[],
  reminders: Reminder[],
  completionLogs: CompletionLog[],
  exportedAt: string,
): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    lists,
    reminders,
    completionLogs,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
}

export function importBackupAdditive(
  existingLists: ReminderList[],
  existingReminders: Reminder[],
  existingLogs: CompletionLog[],
  raw: unknown,
): ImportResult {
  if (!isRecord(raw) || raw.format !== BACKUP_FORMAT || raw.version !== BACKUP_VERSION) {
    return { ok: false, error: "invalid-backup" };
  }
  if (!Array.isArray(raw.lists) || !Array.isArray(raw.reminders) || !Array.isArray(raw.completionLogs)) {
    return { ok: false, error: "invalid-backup" };
  }

  const lists = [...existingLists];
  const reminders = [...existingReminders];
  const completionLogs = [...existingLogs];
  const listIds = new Set(lists.map((list) => list.id));
  const reminderIds = new Set(reminders.map((reminder) => reminder.id));
  const logIds = new Set(completionLogs.map((log) => log.id));
  let addedLists = 0;
  let addedReminders = 0;
  let addedLogs = 0;
  let skipped = 0;

  for (const candidate of raw.lists) {
    if (!isRecord(candidate) || typeof candidate.id !== "string") {
      skipped += 1;
      continue;
    }
    if (listIds.has(candidate.id)) {
      skipped += 1;
      continue;
    }
    lists.push(candidate as ReminderList);
    listIds.add(candidate.id);
    addedLists += 1;
  }

  for (const candidate of raw.reminders) {
    if (!isRecord(candidate) || typeof candidate.id !== "string" || typeof candidate.listId !== "string") {
      skipped += 1;
      continue;
    }
    if (reminderIds.has(candidate.id) || !listIds.has(candidate.listId)) {
      skipped += 1;
      continue;
    }
    reminders.push(candidate as Reminder);
    reminderIds.add(candidate.id);
    addedReminders += 1;
  }

  for (const candidate of raw.completionLogs) {
    if (!isRecord(candidate) || typeof candidate.id !== "string") {
      skipped += 1;
      continue;
    }
    if (logIds.has(candidate.id)) {
      skipped += 1;
      continue;
    }
    completionLogs.push(candidate as CompletionLog);
    logIds.add(candidate.id);
    addedLogs += 1;
  }

  return {
    ok: true,
    lists,
    reminders,
    completionLogs,
    addedLists,
    addedReminders,
    addedLogs,
    skipped,
  };
}
