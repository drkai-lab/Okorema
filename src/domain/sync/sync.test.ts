import { describe, expect, it } from "vitest";

import { createBackup, importBackupAdditive } from "../backup";
import { freshClocks, occurrenceKeyFor, type Reminder, type ReminderList } from "../types";
import { runSync, type RemoteEvent, type RemoteNote, type RemoteTask, type RemoteTaskList, type SyncClient } from "./engine";
import { encodeKeepBody, parseKeepBody, planKeepWrite } from "./keep";
import { planMissingRemote, planPull, planPush, upsertMapping, type Mapping } from "./mapping";
import { mergePresentFields } from "./merge";
import { fromRRule, toRRule } from "./rrule";
import { extractTaskMarker, fromTaskDue, joinTaskNotes, toTaskDue } from "./tasksTime";

function list(overrides: Partial<ReminderList> = {}): ReminderList {
  return {
    id: "list-1",
    name: "仕事",
    color: "indigo",
    icon: "briefcase",
    sortOrder: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    deletedAt: null,
    nameClock: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function reminder(overrides: Partial<Reminder> = {}): Reminder {
  const id = overrides.id ?? "rem-1";
  const dueAt = overrides.dueAt === undefined ? new Date(2026, 9, 8, 12, 30).toISOString() : overrides.dueAt;
  const created = "2026-10-01T00:00:00.000Z";
  return {
    id,
    listId: "list-1",
    title: "企画書",
    notes: "三点確認",
    dueAt,
    preNotifyMinutes: null,
    repeatRule: "weekly",
    repeatAnchorAt: dueAt,
    persistence: "normal",
    completedAt: null,
    snoozeUntil: null,
    lastMutationId: null,
    undoSnapshot: null,
    geofence: null,
    externalRecurrence: null,
    clocks: freshClocks(created),
    createdAt: created,
    updatedAt: created,
    deletedAt: null,
    ...overrides,
    occurrenceKey: overrides.occurrenceKey ?? occurrenceKeyFor(id, dueAt),
  };
}

class MemoryGoogle implements SyncClient {
  events: RemoteEvent[] = [];
  taskLists: RemoteTaskList[] = [];
  tasks: RemoteTask[] = [];
  notes: RemoteNote[] = [];
  eventCreates = 0;
  taskCreates = 0;
  noteCreates = 0;
  noteDeletes = 0;
  private sequence = 0;

  async listEvents(): Promise<RemoteEvent[]> {
    return this.events.map((event) => ({ ...event }));
  }

  async insertEvent(_calendarId: string, event: Omit<RemoteEvent, "id" | "updated" | "status">): Promise<RemoteEvent> {
    this.eventCreates += 1;
    const saved: RemoteEvent = {
      ...event,
      id: `ev-${++this.sequence}`,
      updated: "2000-01-01T00:00:00.000Z",
      status: "confirmed",
    };
    this.events.push(saved);
    return { ...saved };
  }

  async patchEvent(_calendarId: string, event: RemoteEvent): Promise<RemoteEvent> {
    const index = this.events.findIndex((item) => item.id === event.id);
    const saved = { ...event, updated: event.updated };
    if (index >= 0) {
      this.events[index] = saved;
    } else {
      this.events.push(saved);
    }
    return { ...saved };
  }

  async deleteEvent(_calendarId: string, eventId: string): Promise<void> {
    this.events = this.events.filter((event) => event.id !== eventId);
  }

  async listTaskLists(): Promise<RemoteTaskList[]> {
    return this.taskLists.map((item) => ({ ...item }));
  }

  async insertTaskList(title: string): Promise<RemoteTaskList> {
    const saved = { id: `tl-${++this.sequence}`, title, updated: "2000-01-01T00:00:00.000Z" };
    this.taskLists.push(saved);
    return { ...saved };
  }

  async patchTaskList(id: string, title: string): Promise<RemoteTaskList> {
    const found = this.taskLists.find((item) => item.id === id);
    if (!found) {
      throw new Error("missing task list");
    }
    found.title = title;
    found.updated = "2026-10-08T00:00:00.000Z";
    return { ...found };
  }

  async deleteTaskList(id: string): Promise<void> {
    this.taskLists = this.taskLists.filter((item) => item.id !== id);
    this.tasks = this.tasks.filter((task) => task.listId !== id);
  }

  async listTasks(listId: string): Promise<RemoteTask[]> {
    return this.tasks.filter((task) => task.listId === listId).map((task) => ({ ...task }));
  }

  async insertTask(listId: string, task: Omit<RemoteTask, "id" | "updated" | "listId">): Promise<RemoteTask> {
    this.taskCreates += 1;
    const saved: RemoteTask = { ...task, id: `task-${++this.sequence}`, listId, updated: "2000-01-01T00:00:00.000Z" };
    this.tasks.push(saved);
    return { ...saved };
  }

  async patchTask(task: RemoteTask): Promise<RemoteTask> {
    const index = this.tasks.findIndex((item) => item.id === task.id);
    const saved = { ...task };
    if (index >= 0) {
      this.tasks[index] = saved;
    } else {
      this.tasks.push(saved);
    }
    return { ...saved };
  }

  async deleteTask(listId: string, taskId: string): Promise<void> {
    this.tasks = this.tasks.filter((task) => !(task.listId === listId && task.id === taskId));
  }

  async listNotes(): Promise<RemoteNote[]> {
    return this.notes.map((note) => ({ ...note }));
  }

  async createNote(note: { title: string; bodyText: string; checked: boolean }): Promise<RemoteNote> {
    this.noteCreates += 1;
    const saved: RemoteNote = {
      name: `notes/${++this.sequence}`,
      title: note.title,
      bodyText: note.bodyText,
      checked: note.checked,
      updateTime: "2000-01-01T00:00:00.000Z",
    };
    this.notes.push(saved);
    return { ...saved };
  }

  async deleteNote(name: string): Promise<void> {
    this.noteDeletes += 1;
    this.notes = this.notes.filter((note) => note.name !== name);
  }
}

describe("conflict merge and mapping", () => {
  it("lets the newer timestamp win per field and keeps ties local", () => {
    const merged = mergePresentFields(
      { title: "ローカル", notes: "新しいメモ", dueAt: "2026-10-08T03:00:00.000Z", completed: false, listId: "list-1" },
      freshClocks("2026-10-08T00:00:00.000Z"),
      { title: "リモート", notes: "古いメモ" },
      "2026-10-07T00:00:00.000Z",
      ["title", "notes", "dueAt", "completed"],
    );
    expect(merged.values.title).toBe("ローカル");
    expect(merged.tookRemote).toEqual([]);

    const remoteWins = mergePresentFields(
      { title: "ローカル", notes: "古いメモ", dueAt: null, completed: false, listId: "list-1" },
      { ...freshClocks("2026-10-01T00:00:00.000Z"), notes: "2026-10-09T00:00:00.000Z" },
      { title: "リモート", notes: "リモートメモ" },
      "2026-10-08T00:00:00.000Z",
      ["title", "notes"],
    );
    expect(remoteWins.values.title).toBe("リモート");
    expect(remoteWins.values.notes).toBe("古いメモ");
    expect(remoteWins.tookRemote).toEqual(["title"]);
  });

  it("reuses one remote id for the same local row", () => {
    const first = planPush([], "calendar", "reminder", "rem-1", "ev-existing");
    expect(first).toEqual({ action: "update", remoteId: "ev-existing" });
    let mappings: Mapping[] = [];
    mappings = upsertMapping(mappings, {
      provider: "calendar",
      localKind: "reminder",
      localId: "rem-1",
      remoteId: "ev-1",
      lastPushedAt: "2026-10-01T00:00:00.000Z",
    });
    mappings = upsertMapping(mappings, {
      provider: "calendar",
      localKind: "reminder",
      localId: "rem-1",
      remoteId: "ev-1",
      lastPushedAt: "2026-10-02T00:00:00.000Z",
    });
    expect(mappings).toHaveLength(1);
    expect(planPull(mappings, "calendar", "reminder", "ev-1")).toEqual({ action: "update", localId: "rem-1" });
    expect(planPull(mappings, "calendar", "reminder", "ev-2")).toEqual({ action: "insert" });
    expect(planMissingRemote("2026-10-03T00:00:00.000Z", "2026-10-02T00:00:00.000Z")).toBe("recreate-remote");
    expect(planMissingRemote("2026-10-02T00:00:00.000Z", "2026-10-02T00:00:00.000Z")).toBe("delete-local");
  });

  it("maps repeats to RRULE and keeps the Tasks clock time beside the date", () => {
    const due = new Date(2026, 9, 8, 12, 30);
    expect(toRRule("weekdays", due)).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
    expect(fromRRule("RRULE:FREQ=WEEKLY;BYDAY=FR,MO,TH,TU,WE")).toBe("weekdays");
    expect(fromRRule("RRULE:FREQ=WEEKLY;BYDAY=TH")).toBe("weekly");
    expect(fromRRule("RRULE:FREQ=MONTHLY;BYMONTHDAY=8")).toBe("monthly");
    expect(fromRRule("RRULE:FREQ=HOURLY")).toBe("unsupported");
    expect(toRRule("daily", due)).toBe("RRULE:FREQ=DAILY");

    const dueIso = due.toISOString();
    expect(toTaskDue(dueIso)).toBe("2026-10-08T00:00:00.000Z");
    const notes = joinTaskNotes("三点確認", "rem-1", dueIso);
    const parts = extractTaskMarker(notes);
    expect(parts.notes).toBe("三点確認");
    expect(parts.localId).toBe("rem-1");
    expect(parts.dueTime).toBe("12:30");
    const restored = new Date(fromTaskDue(toTaskDue(dueIso), parts.dueTime));
    expect(restored.getHours()).toBe(12);
    expect(restored.getMinutes()).toBe(30);
    expect(restored.getDate()).toBe(8);
  });

  it("treats Keep updates as replace because the API has no patch", () => {
    expect(planKeepWrite(false)).toBe("create");
    expect(planKeepWrite(true)).toBe("replace");
    const body = encodeKeepBody("メモ", "rem-1", "2026-10-08T03:30:00.000Z");
    expect(parseKeepBody(body)).toMatchObject({
      notes: "メモ",
      localId: "rem-1",
      dueAt: "2026-10-08T03:30:00.000Z",
    });
  });
});

describe("sync engine", () => {
  it("does not duplicate calendar events, tasks, or keep notes on a second pass", async () => {
    const google = new MemoryGoogle();
    const state = { lists: [list()], reminders: [reminder()], mappings: [] };
    const config = {
      now: "2026-10-08T00:00:00.000Z",
      createId: () => `gen-${google.eventCreates + google.taskCreates + google.noteCreates + 1}`,
      defaultListId: "list-1",
      calendarId: "cal-1",
      enableCalendar: true,
      enableTasks: true,
      enableKeep: true,
      keepAvailable: true,
    };
    const once = await runSync(state, config, google);
    const twice = await runSync(once.state, config, google);
    expect(google.events).toHaveLength(1);
    expect(google.tasks).toHaveLength(1);
    expect(google.notes).toHaveLength(1);
    expect(google.eventCreates).toBe(1);
    expect(google.taskCreates).toBe(1);
    expect(google.noteCreates).toBe(1);
    expect(twice.state.reminders).toHaveLength(1);
    expect(twice.state.mappings.filter((mapping) => mapping.localKind === "reminder")).toHaveLength(3);
    expect(google.tasks[0]?.due).toBe("2026-10-08T00:00:00.000Z");
    expect(google.tasks[0]?.notes).toContain("dueTime=12:30");
    expect(google.events[0]?.rrule).toBe("RRULE:FREQ=WEEKLY;BYDAY=TH");
  });

  it("keeps a newer local note and accepts a newer remote title", async () => {
    const google = new MemoryGoogle();
    const initial = reminder({ clocks: { ...freshClocks("2026-10-08T00:00:00.000Z"), title: "2026-10-08T00:00:00.000Z" } });
    const config = {
      now: "2026-10-08T12:00:00.000Z",
      createId: () => "gen",
      defaultListId: "list-1",
      calendarId: "cal-1",
      enableCalendar: true,
      enableTasks: false,
      enableKeep: false,
      keepAvailable: false,
    };
    const once = await runSync({ lists: [list()], reminders: [initial], mappings: [] }, config, google);
    google.events[0].summary = "リモート題";
    google.events[0].description = "リモートメモ";
    google.events[0].updated = "2026-10-09T00:00:00.000Z";
    const edited = {
      ...once.state.reminders[0],
      notes: "ローカルメモ",
      clocks: { ...once.state.reminders[0].clocks, notes: "2026-10-10T00:00:00.000Z" },
      updatedAt: "2026-10-10T00:00:00.000Z",
    };
    const twice = await runSync(
      { ...once.state, reminders: [edited] },
      { ...config, now: "2026-10-10T01:00:00.000Z" },
      google,
    );
    expect(twice.state.reminders[0]?.title).toBe("リモート題");
    expect(twice.state.reminders[0]?.notes).toBe("ローカルメモ");
    expect(google.events).toHaveLength(1);
    expect(google.events[0]?.description).toBe("ローカルメモ");
    expect(google.events[0]?.summary).toBe("リモート題");
  });

  it("adopts an existing remote event instead of creating a second one", async () => {
    const google = new MemoryGoogle();
    const item = reminder({ id: "rem-1" });
    google.events.push({
      id: "ev-existing",
      updated: "2026-10-07T00:00:00.000Z",
      summary: item.title,
      description: item.notes,
      startIso: item.dueAt as string,
      rrule: "RRULE:FREQ=WEEKLY;BYDAY=TH",
      okoremaId: item.id,
      status: "confirmed",
    });
    const result = await runSync(
      { lists: [list()], reminders: [item], mappings: [] },
      {
        now: "2026-10-08T00:00:00.000Z",
        createId: () => "should-not-create",
        defaultListId: "list-1",
        calendarId: "cal-1",
        enableCalendar: true,
        enableTasks: false,
        enableKeep: false,
        keepAvailable: false,
      },
      google,
    );
    expect(google.events).toHaveLength(1);
    expect(google.eventCreates).toBe(0);
    expect(result.state.reminders).toHaveLength(1);
    expect(result.state.mappings.find((mapping) => mapping.provider === "calendar")?.remoteId).toBe("ev-existing");
  });

  it("replaces a Keep note when there is no update method, and skips personal accounts", async () => {
    const google = new MemoryGoogle();
    const base = {
      now: "2026-10-08T00:00:00.000Z",
      createId: () => "gen-keep",
      defaultListId: "list-1",
      calendarId: null,
      enableCalendar: false,
      enableTasks: false,
      enableKeep: true,
      keepAvailable: true,
    };
    const once = await runSync({ lists: [list()], reminders: [reminder()], mappings: [] }, base, google);
    const renamed = {
      ...once.state.reminders[0],
      title: "改題",
      clocks: { ...once.state.reminders[0].clocks, title: "2026-10-09T00:00:00.000Z" },
      updatedAt: "2026-10-09T00:00:00.000Z",
    };
    const twice = await runSync(
      { ...once.state, reminders: [renamed] },
      { ...base, now: "2026-10-09T00:00:00.000Z" },
      google,
    );
    expect(google.noteCreates).toBe(2);
    expect(google.noteDeletes).toBe(1);
    expect(google.notes).toHaveLength(1);
    expect(google.notes[0]?.title).toBe("改題");
    expect(twice.state.mappings.filter((mapping) => mapping.provider === "keep")).toHaveLength(1);

    const personal = new MemoryGoogle();
    const blocked = await runSync(
      { lists: [list()], reminders: [reminder()], mappings: [] },
      { ...base, keepAvailable: false },
      personal,
    );
    expect(blocked.warnings).toContain("keep-unavailable");
    expect(personal.noteCreates).toBe(0);
  });
});

describe("backup import", () => {
  it("adds rows and never overwrites an existing id", () => {
    const existingList = list();
    const existingReminder = reminder({ title: "残す" });
    const incoming = createBackup(
      [existingList, list({ id: "list-2", name: "健康", sortOrder: 1 })],
      [reminder({ id: existingReminder.id, title: "上書きしない" }), reminder({ id: "rem-2", listId: "list-2", title: "散歩" })],
      [],
      "2026-10-08T00:00:00.000Z",
    );
    const result = importBackupAdditive([existingList], [existingReminder], [], incoming);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.addedLists).toBe(1);
    expect(result.addedReminders).toBe(1);
    expect(result.reminders.find((item) => item.id === existingReminder.id)?.title).toBe("残す");
    expect(result.reminders.find((item) => item.id === "rem-2")?.title).toBe("散歩");
    expect(importBackupAdditive([], [], [], { format: "other" }).ok).toBe(false);
  });
});
