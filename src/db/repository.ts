import * as SQLite from "expo-sqlite";

import type { Mapping } from "@/domain/sync/mapping";
import {
  freshClocks,
  type CompletionLog,
  type EscalationState,
  type Geofence,
  type PersistenceLevel,
  type Reminder,
  type ReminderList,
  type RepeatRule,
} from "@/domain/types";

const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  name_clock TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY NOT NULL,
  list_id TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT NOT NULL,
  due_at TEXT,
  pre_notify_minutes INTEGER,
  repeat_rule TEXT NOT NULL,
  repeat_anchor_at TEXT,
  persistence TEXT NOT NULL,
  completed_at TEXT,
  snooze_until TEXT,
  occurrence_key TEXT NOT NULL,
  last_mutation_id TEXT,
  undo_snapshot TEXT,
  geofence_json TEXT,
  external_recurrence TEXT,
  clocks_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS completion_logs (
  id TEXT PRIMARY KEY NOT NULL,
  reminder_id TEXT NOT NULL,
  title TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  undone_at TEXT
);
CREATE TABLE IF NOT EXISTS escalation_state (
  reminder_id TEXT PRIMARY KEY NOT NULL,
  anchor_at TEXT NOT NULL,
  next_index INTEGER NOT NULL,
  scheduled_through_index INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_mappings (
  provider TEXT NOT NULL,
  local_kind TEXT NOT NULL,
  local_id TEXT NOT NULL,
  remote_id TEXT NOT NULL,
  last_pushed_at TEXT,
  PRIMARY KEY (provider, local_kind, local_id)
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

type ListRow = {
  id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  name_clock: string;
};

type ReminderRow = {
  id: string;
  list_id: string;
  title: string;
  notes: string;
  due_at: string | null;
  pre_notify_minutes: number | null;
  repeat_rule: string;
  repeat_anchor_at: string | null;
  persistence: string;
  completed_at: string | null;
  snooze_until: string | null;
  occurrence_key: string;
  last_mutation_id: string | null;
  undo_snapshot: string | null;
  geofence_json: string | null;
  external_recurrence: string | null;
  clocks_json: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function mapList(row: ListRow): ReminderList {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    nameClock: row.name_clock,
  };
}

function mapReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    listId: row.list_id,
    title: row.title,
    notes: row.notes,
    dueAt: row.due_at,
    preNotifyMinutes: row.pre_notify_minutes,
    repeatRule: row.repeat_rule as RepeatRule,
    repeatAnchorAt: row.repeat_anchor_at,
    persistence: row.persistence as PersistenceLevel,
    completedAt: row.completed_at,
    snoozeUntil: row.snooze_until,
    occurrenceKey: row.occurrence_key,
    lastMutationId: row.last_mutation_id,
    undoSnapshot: row.undo_snapshot,
    geofence: row.geofence_json ? (JSON.parse(row.geofence_json) as Geofence) : null,
    externalRecurrence: row.external_recurrence,
    clocks: row.clocks_json ? JSON.parse(row.clocks_json) : freshClocks(row.updated_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class Repository {
  constructor(private readonly db: SQLite.SQLiteDatabase) {}

  async lists(): Promise<ReminderList[]> {
    const rows = await this.db.getAllAsync<ListRow>("SELECT * FROM lists ORDER BY sort_order ASC, created_at ASC");
    return rows.map(mapList);
  }

  async reminders(): Promise<Reminder[]> {
    const rows = await this.db.getAllAsync<ReminderRow>("SELECT * FROM reminders ORDER BY due_at ASC");
    return rows.map(mapReminder);
  }

  async logs(): Promise<CompletionLog[]> {
    return this.db.getAllAsync<CompletionLog>(
      "SELECT id, reminder_id as reminderId, title, completed_at as completedAt, undone_at as undoneAt FROM completion_logs ORDER BY completed_at DESC",
    );
  }

  async escalation(): Promise<EscalationState[]> {
    const rows = await this.db.getAllAsync<{
      reminder_id: string;
      anchor_at: string;
      next_index: number;
      scheduled_through_index: number;
    }>("SELECT * FROM escalation_state");
    return rows.map((row) => ({
      reminderId: row.reminder_id,
      anchorAt: row.anchor_at,
      nextIndex: row.next_index,
      scheduledThroughIndex: row.scheduled_through_index,
    }));
  }

  async mappings(): Promise<Mapping[]> {
    const rows = await this.db.getAllAsync<{
      provider: Mapping["provider"];
      local_kind: Mapping["localKind"];
      local_id: string;
      remote_id: string;
      last_pushed_at: string | null;
    }>("SELECT * FROM sync_mappings");
    return rows.map((row) => ({
      provider: row.provider,
      localKind: row.local_kind,
      localId: row.local_id,
      remoteId: row.remote_id,
      lastPushedAt: row.last_pushed_at,
    }));
  }

  async settings(): Promise<Record<string, string>> {
    const rows = await this.db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM settings");
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  async saveList(list: ReminderList): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO lists (id, name, color, icon, sort_order, created_at, updated_at, deleted_at, name_clock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      list.id,
      list.name,
      list.color,
      list.icon,
      list.sortOrder,
      list.createdAt,
      list.updatedAt,
      list.deletedAt,
      list.nameClock,
    );
  }

  async saveReminder(reminder: Reminder): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO reminders (
        id, list_id, title, notes, due_at, pre_notify_minutes, repeat_rule, repeat_anchor_at, persistence,
        completed_at, snooze_until, occurrence_key, last_mutation_id, undo_snapshot, geofence_json,
        external_recurrence, clocks_json, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      reminder.id,
      reminder.listId,
      reminder.title,
      reminder.notes,
      reminder.dueAt,
      reminder.preNotifyMinutes,
      reminder.repeatRule,
      reminder.repeatAnchorAt,
      reminder.persistence,
      reminder.completedAt,
      reminder.snoozeUntil,
      reminder.occurrenceKey,
      reminder.lastMutationId,
      reminder.undoSnapshot,
      reminder.geofence ? JSON.stringify(reminder.geofence) : null,
      reminder.externalRecurrence,
      JSON.stringify(reminder.clocks),
      reminder.createdAt,
      reminder.updatedAt,
      reminder.deletedAt,
    );
  }

  async saveLog(log: CompletionLog): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO completion_logs (id, reminder_id, title, completed_at, undone_at) VALUES (?, ?, ?, ?, ?)`,
      log.id,
      log.reminderId,
      log.title,
      log.completedAt,
      log.undoneAt,
    );
  }

  async saveEscalation(states: EscalationState[]): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync("DELETE FROM escalation_state");
      for (const state of states) {
        await this.db.runAsync(
          `INSERT INTO escalation_state (reminder_id, anchor_at, next_index, scheduled_through_index) VALUES (?, ?, ?, ?)`,
          state.reminderId,
          state.anchorAt,
          state.nextIndex,
          state.scheduledThroughIndex,
        );
      }
    });
  }

  async replaceMappings(mappings: Mapping[]): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync("DELETE FROM sync_mappings");
      for (const mapping of mappings) {
        await this.db.runAsync(
          `INSERT INTO sync_mappings (provider, local_kind, local_id, remote_id, last_pushed_at) VALUES (?, ?, ?, ?, ?)`,
          mapping.provider,
          mapping.localKind,
          mapping.localId,
          mapping.remoteId,
          mapping.lastPushedAt,
        );
      }
    });
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, value);
  }

  async replaceAll(lists: ReminderList[], reminders: Reminder[], logs: CompletionLog[]): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync("DELETE FROM lists");
      await this.db.runAsync("DELETE FROM reminders");
      await this.db.runAsync("DELETE FROM completion_logs");
      for (const list of lists) {
        await this.saveList(list);
      }
      for (const reminder of reminders) {
        await this.saveReminder(reminder);
      }
      for (const log of logs) {
        await this.saveLog(log);
      }
    });
  }
}

export async function openRepository(): Promise<Repository> {
  const db = await SQLite.openDatabaseAsync("okorema.db");
  await db.execAsync(SCHEMA);
  return new Repository(db);
}

export function createId(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === "function") {
    return cryptoRef.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}
