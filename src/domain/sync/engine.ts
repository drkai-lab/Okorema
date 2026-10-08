import { LIST_COLORS, LIST_ICONS } from "../appearance";
import {
  occurrenceKeyFor,
  type FieldClocks,
  type Reminder,
  type ReminderList,
  type RepeatRule,
} from "../types";
import { encodeKeepBody, parseKeepBody, planKeepWrite } from "./keep";
import { findByLocal, findByRemote, needsPush, planMissingRemote, planPull, planPush, upsertMapping, type Mapping } from "./mapping";
import { maxClock, mergePresentFields } from "./merge";
import { fromRRule, toRRule } from "./rrule";
import { extractTaskMarker, fromTaskDue, joinTaskNotes, toTaskDue } from "./tasksTime";

export type RemoteEvent = {
  id: string;
  updated: string;
  summary: string;
  description: string;
  startIso: string;
  rrule: string | null;
  okoremaId: string | null;
  status: "confirmed" | "cancelled";
};

export type RemoteTaskList = { id: string; title: string; updated: string };

export type RemoteTask = {
  id: string;
  listId: string;
  title: string;
  notes: string;
  due: string | null;
  status: "needsAction" | "completed";
  updated: string;
};

export type RemoteNote = {
  name: string;
  title: string;
  bodyText: string;
  checked: boolean;
  updateTime: string;
};

export type EventDraft = Omit<RemoteEvent, "id" | "updated" | "status">;

export interface SyncClient {
  listEvents(calendarId: string): Promise<RemoteEvent[]>;
  insertEvent(calendarId: string, event: EventDraft): Promise<RemoteEvent>;
  patchEvent(calendarId: string, event: RemoteEvent): Promise<RemoteEvent>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
  listTaskLists(): Promise<RemoteTaskList[]>;
  insertTaskList(title: string): Promise<RemoteTaskList>;
  patchTaskList(id: string, title: string): Promise<RemoteTaskList>;
  deleteTaskList(id: string): Promise<void>;
  listTasks(listId: string): Promise<RemoteTask[]>;
  insertTask(listId: string, task: Omit<RemoteTask, "id" | "updated" | "listId">): Promise<RemoteTask>;
  patchTask(task: RemoteTask): Promise<RemoteTask>;
  deleteTask(listId: string, taskId: string): Promise<void>;
  listNotes(): Promise<RemoteNote[]>;
  createNote(note: { title: string; bodyText: string; checked: boolean }): Promise<RemoteNote>;
  deleteNote(name: string): Promise<void>;
}

export type SyncState = {
  lists: ReminderList[];
  reminders: Reminder[];
  mappings: Mapping[];
};

export type SyncConfig = {
  now: string;
  createId: () => string;
  defaultListId: string;
  calendarId: string | null;
  enableCalendar: boolean;
  enableTasks: boolean;
  enableKeep: boolean;
  keepAvailable: boolean;
};

export type SyncResult = {
  state: SyncState;
  warnings: string[];
};

function cloneState(state: SyncState): SyncState {
  return {
    lists: state.lists.map((list) => ({ ...list })),
    reminders: state.reminders.map((reminder) => ({
      ...reminder,
      clocks: { ...reminder.clocks },
      geofence: reminder.geofence ? { ...reminder.geofence } : null,
    })),
    mappings: state.mappings.map((mapping) => ({ ...mapping })),
  };
}

function eventDraft(reminder: Reminder): EventDraft {
  const start = new Date(reminder.dueAt ?? 0);
  const ruleDate = new Date(reminder.repeatAnchorAt ?? reminder.dueAt ?? 0);
  const rrule =
    reminder.externalRecurrence && reminder.repeatRule === "none"
      ? reminder.externalRecurrence
      : toRRule(reminder.repeatRule, ruleDate);
  return {
    summary: reminder.title,
    description: reminder.notes,
    startIso: start.toISOString(),
    rrule,
    okoremaId: reminder.id,
  };
}

function importedList(id: string, name: string, sortOrder: number, now: string): ReminderList {
  return {
    id,
    name: name || "Okorema",
    color: LIST_COLORS[sortOrder % LIST_COLORS.length].id,
    icon: LIST_ICONS[sortOrder % LIST_ICONS.length].id,
    sortOrder,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    nameClock: now,
  };
}

function importedReminder(input: {
  id: string;
  listId: string;
  title: string;
  notes: string;
  dueAt: string | null;
  completed: boolean;
  repeatRule: RepeatRule;
  externalRecurrence: string | null;
  now: string;
  remoteUpdated: string;
}): Reminder {
  const clocks: FieldClocks = {
    title: input.remoteUpdated,
    notes: input.remoteUpdated,
    dueAt: input.remoteUpdated,
    completed: input.remoteUpdated,
    listId: input.remoteUpdated,
  };
  return {
    id: input.id,
    listId: input.listId,
    title: input.title || "（無題）",
    notes: input.notes,
    dueAt: input.dueAt,
    preNotifyMinutes: null,
    repeatRule: input.repeatRule,
    repeatAnchorAt: input.dueAt,
    persistence: "gentle",
    completedAt: input.completed ? input.remoteUpdated : null,
    snoozeUntil: null,
    occurrenceKey: occurrenceKeyFor(input.id, input.dueAt),
    lastMutationId: null,
    undoSnapshot: null,
    geofence: null,
    externalRecurrence: input.externalRecurrence,
    clocks,
    createdAt: input.now,
    updatedAt: input.remoteUpdated,
    deletedAt: null,
  };
}

export async function runSync(input: SyncState, config: SyncConfig, client: SyncClient): Promise<SyncResult> {
  const state = cloneState(input);
  const warnings: string[] = [];

  if (config.enableTasks) {
    await syncTaskLists(state, config, client);
    await syncTasks(state, config, client, warnings);
  }
  if (config.enableCalendar && config.calendarId) {
    await syncCalendar(state, config, client, warnings);
  }
  if (config.enableKeep) {
    if (!config.keepAvailable) {
      warnings.push("keep-unavailable");
    } else {
      await syncKeep(state, config, client);
    }
  }

  return { state, warnings };
}

async function syncTaskLists(state: SyncState, config: SyncConfig, client: SyncClient): Promise<void> {
  let remoteLists = await client.listTaskLists();
  for (const list of state.lists) {
    const mapping = findByLocal(state.mappings, "tasks", "list", list.id);
    if (list.deletedAt) {
      if (mapping) {
        await client.deleteTaskList(mapping.remoteId);
        state.mappings = state.mappings.filter((item) => item !== mapping && !(item.provider === "tasks" && item.localKind === "list" && item.localId === list.id));
      }
      continue;
    }
    const push = planPush(state.mappings, "tasks", "list", list.id);
    if (push.action === "create") {
      const created = await client.insertTaskList(list.name);
      state.mappings = upsertMapping(state.mappings, {
        provider: "tasks",
        localKind: "list",
        localId: list.id,
        remoteId: created.id,
        lastPushedAt: config.now,
      });
      remoteLists = await client.listTaskLists();
      continue;
    }
    const remote = remoteLists.find((item) => item.id === push.remoteId);
    if (!remote) {
      const decision = planMissingRemote(list.updatedAt, mapping?.lastPushedAt ?? null);
      if (decision === "recreate-remote") {
        const created = await client.insertTaskList(list.name);
        state.mappings = upsertMapping(state.mappings, {
          provider: "tasks",
          localKind: "list",
          localId: list.id,
          remoteId: created.id,
          lastPushedAt: config.now,
        });
      } else {
        list.deletedAt = config.now;
        state.mappings = state.mappings.filter((item) => !(item.provider === "tasks" && item.localKind === "list" && item.localId === list.id));
      }
      continue;
    }
    if (list.nameClock > remote.updated) {
      await client.patchTaskList(remote.id, list.name);
      state.mappings = upsertMapping(state.mappings, {
        provider: "tasks",
        localKind: "list",
        localId: list.id,
        remoteId: remote.id,
        lastPushedAt: config.now,
      });
    } else if (remote.updated > list.nameClock && remote.title !== list.name) {
      list.name = remote.title;
      list.nameClock = remote.updated;
      list.updatedAt = remote.updated;
    }
  }

  remoteLists = await client.listTaskLists();
  for (const remote of remoteLists) {
    if (planPull(state.mappings, "tasks", "list", remote.id).action === "insert") {
      const id = config.createId();
      state.lists.push(importedList(id, remote.title, state.lists.length, remote.updated));
      state.mappings = upsertMapping(state.mappings, {
        provider: "tasks",
        localKind: "list",
        localId: id,
        remoteId: remote.id,
        lastPushedAt: remote.updated,
      });
    }
  }
}

async function syncTasks(
  state: SyncState,
  config: SyncConfig,
  client: SyncClient,
  warnings: string[],
): Promise<void> {
  warnings.push("tasks-date-only");
  const listMap = new Map(
    state.mappings.filter((mapping) => mapping.provider === "tasks" && mapping.localKind === "list").map((mapping) => [mapping.localId, mapping.remoteId]),
  );
  for (const remoteListId of new Set(listMap.values())) {
    const tasks = await client.listTasks(remoteListId);
    for (const task of tasks) {
      const marker = extractTaskMarker(task.notes);
      const hint = marker.localId;
      const mapped = findByRemote(state.mappings, "tasks", "reminder", task.id);
      const local =
        state.reminders.find((reminder) => reminder.id === (mapped?.localId ?? hint)) ?? null;
      if (!local || local.deletedAt) {
        if (local?.deletedAt) {
          continue;
        }
        const localListId =
          [...listMap.entries()].find(([, remoteId]) => remoteId === task.listId)?.[0] ?? config.defaultListId;
        const dueAt = task.due ? fromTaskDue(task.due, marker.dueTime) : null;
        const id = hint && !state.reminders.some((reminder) => reminder.id === hint) ? hint : config.createId();
        state.reminders.push(
          importedReminder({
            id,
            listId: localListId,
            title: task.title,
            notes: marker.notes,
            dueAt,
            completed: task.status === "completed",
            repeatRule: "none",
            externalRecurrence: null,
            now: config.now,
            remoteUpdated: task.updated,
          }),
        );
        state.mappings = upsertMapping(state.mappings, {
          provider: "tasks",
          localKind: "reminder",
          localId: id,
          remoteId: task.id,
          lastPushedAt: task.updated,
        });
        continue;
      }
      applyTaskRemote(local, task);
      state.mappings = upsertMapping(state.mappings, {
        provider: "tasks",
        localKind: "reminder",
        localId: local.id,
        remoteId: task.id,
        lastPushedAt: findByLocal(state.mappings, "tasks", "reminder", local.id)?.lastPushedAt ?? task.updated,
      });
    }
  }

  for (const reminder of state.reminders) {
    const remoteListId = listMap.get(reminder.listId);
    if (!remoteListId) {
      continue;
    }
    const tasks = await client.listTasks(remoteListId);
    const hint = tasks.find((task) => extractTaskMarker(task.notes).localId === reminder.id)?.id ?? null;
    const decision = planPush(state.mappings, "tasks", "reminder", reminder.id, hint);
    const mapping = findByLocal(state.mappings, "tasks", "reminder", reminder.id);
    if (reminder.deletedAt) {
      if (decision.action === "update") {
        await client.deleteTask(remoteListId, decision.remoteId);
      }
      state.mappings = state.mappings.filter((item) => !(item.provider === "tasks" && item.localKind === "reminder" && item.localId === reminder.id));
      continue;
    }
    if (decision.action === "update") {
      const remote = tasks.find((task) => task.id === decision.remoteId);
      if (!remote) {
        const missing = planMissingRemote(reminder.updatedAt, mapping?.lastPushedAt ?? null);
        if (missing === "delete-local") {
          reminder.deletedAt = config.now;
          state.mappings = state.mappings.filter((item) => !(item.provider === "tasks" && item.localKind === "reminder" && item.localId === reminder.id));
          continue;
        }
      } else if (!needsPush(reminder.clocks, mapping?.lastPushedAt ?? null)) {
        continue;
      }
    }
    const draft = {
      title: reminder.title,
      notes: joinTaskNotes(reminder.notes, reminder.id, reminder.dueAt),
      due: reminder.dueAt ? toTaskDue(reminder.dueAt) : null,
      status: reminder.completedAt ? ("completed" as const) : ("needsAction" as const),
    };
    const saved =
      decision.action === "create" || !tasks.some((task) => task.id === (decision.action === "update" ? decision.remoteId : ""))
        ? await client.insertTask(remoteListId, draft)
        : await client.patchTask({ ...draft, id: decision.remoteId, listId: remoteListId, updated: config.now });
    state.mappings = upsertMapping(state.mappings, {
      provider: "tasks",
      localKind: "reminder",
      localId: reminder.id,
      remoteId: saved.id,
      lastPushedAt: config.now,
    });
  }
}

function applyTaskRemote(reminder: Reminder, task: RemoteTask): void {
  const marker = extractTaskMarker(task.notes);
  const dueAt = task.due ? fromTaskDue(task.due, marker.dueTime) : reminder.dueAt;
  const merged = mergePresentFields(
    {
      title: reminder.title,
      notes: reminder.notes,
      dueAt: reminder.dueAt,
      completed: Boolean(reminder.completedAt),
      listId: reminder.listId,
    },
    reminder.clocks,
    {
      title: task.title,
      notes: marker.notes,
      dueAt,
      completed: task.status === "completed",
    },
    task.updated,
    ["title", "notes", "dueAt", "completed"],
  );
  reminder.title = String(merged.values.title);
  reminder.notes = String(merged.values.notes ?? "");
  reminder.dueAt = (merged.values.dueAt as string | null) ?? null;
  reminder.clocks = merged.clocks;
  if (merged.tookRemote.includes("completed")) {
    reminder.completedAt = merged.values.completed ? task.updated : null;
  }
  if (reminder.dueAt) {
    reminder.occurrenceKey = occurrenceKeyFor(reminder.id, reminder.dueAt);
  }
}

async function syncCalendar(
  state: SyncState,
  config: SyncConfig,
  client: SyncClient,
  warnings: string[],
): Promise<void> {
  const calendarId = config.calendarId;
  if (!calendarId) {
    return;
  }
  let events = await client.listEvents(calendarId);
  for (const event of events) {
    if (event.status === "cancelled") {
      continue;
    }
    const mapped = findByRemote(state.mappings, "calendar", "reminder", event.id);
    const local =
      state.reminders.find((reminder) => reminder.id === (mapped?.localId ?? event.okoremaId)) ?? null;
    if (!local || local.deletedAt) {
      if (local?.deletedAt) {
        continue;
      }
      const parsed = event.rrule ? fromRRule(event.rrule) : "none";
      const unsupported = parsed === "unsupported";
      if (unsupported) {
        warnings.push(`unsupported-rrule:${event.id}`);
      }
      const id = event.okoremaId && !state.reminders.some((reminder) => reminder.id === event.okoremaId)
        ? event.okoremaId
        : config.createId();
      state.reminders.push(
        importedReminder({
          id,
          listId: config.defaultListId,
          title: event.summary,
          notes: event.description,
          dueAt: event.startIso,
          completed: false,
          repeatRule: unsupported ? "none" : parsed,
          externalRecurrence: unsupported ? event.rrule : null,
          now: config.now,
          remoteUpdated: event.updated,
        }),
      );
      state.mappings = upsertMapping(state.mappings, {
        provider: "calendar",
        localKind: "reminder",
        localId: id,
        remoteId: event.id,
        lastPushedAt: event.updated,
      });
    } else {
      applyEventRemote(local, event);
      state.mappings = upsertMapping(state.mappings, {
        provider: "calendar",
        localKind: "reminder",
        localId: local.id,
        remoteId: event.id,
        lastPushedAt: findByLocal(state.mappings, "calendar", "reminder", local.id)?.lastPushedAt ?? event.updated,
      });
    }
  }

  events = await client.listEvents(calendarId);
  for (const reminder of state.reminders) {
    if (!reminder.dueAt && !reminder.deletedAt) {
      continue;
    }
    const hint = events.find((event) => event.okoremaId === reminder.id)?.id ?? null;
    const decision = planPush(state.mappings, "calendar", "reminder", reminder.id, hint);
    const mapping = findByLocal(state.mappings, "calendar", "reminder", reminder.id);
    if (reminder.deletedAt || reminder.completedAt) {
      if (decision.action === "update" && !reminder.repeatRule && !reminder.externalRecurrence) {
        await client.deleteEvent(calendarId, decision.remoteId);
        state.mappings = state.mappings.filter((item) => !(item.provider === "calendar" && item.localKind === "reminder" && item.localId === reminder.id));
      }
      continue;
    }
    if (!reminder.dueAt) {
      continue;
    }
    if (decision.action === "update") {
      const remote = events.find((event) => event.id === decision.remoteId && event.status !== "cancelled");
      if (!remote) {
        if (planMissingRemote(reminder.updatedAt, mapping?.lastPushedAt ?? null) === "delete-local") {
          reminder.deletedAt = config.now;
          state.mappings = state.mappings.filter((item) => !(item.provider === "calendar" && item.localKind === "reminder" && item.localId === reminder.id));
          continue;
        }
      } else if (!needsPush(reminder.clocks, mapping?.lastPushedAt ?? null)) {
        continue;
      }
    }
    const draft = eventDraft(reminder);
    const remoteId = decision.action === "update" ? decision.remoteId : null;
    const exists = remoteId != null && events.some((event) => event.id === remoteId && event.status !== "cancelled");
    const saved = exists
      ? await client.patchEvent(calendarId, {
          ...draft,
          id: remoteId,
          updated: config.now,
          status: "confirmed",
        })
      : await client.insertEvent(calendarId, draft);
    state.mappings = upsertMapping(state.mappings, {
      provider: "calendar",
      localKind: "reminder",
      localId: reminder.id,
      remoteId: saved.id,
      lastPushedAt: config.now,
    });
    events = await client.listEvents(calendarId);
  }
}

function applyEventRemote(reminder: Reminder, event: RemoteEvent): void {
  const merged = mergePresentFields(
    {
      title: reminder.title,
      notes: reminder.notes,
      dueAt: reminder.dueAt,
      completed: Boolean(reminder.completedAt),
      listId: reminder.listId,
    },
    reminder.clocks,
    {
      title: event.summary,
      notes: event.description,
      dueAt: event.startIso,
    },
    event.updated,
    ["title", "notes", "dueAt"],
  );
  reminder.title = String(merged.values.title);
  reminder.notes = String(merged.values.notes ?? "");
  reminder.dueAt = (merged.values.dueAt as string | null) ?? reminder.dueAt;
  reminder.clocks = merged.clocks;
  if (merged.tookRemote.includes("dueAt") && event.rrule) {
    const parsed = fromRRule(event.rrule);
    if (parsed === "unsupported") {
      reminder.repeatRule = "none";
      reminder.externalRecurrence = event.rrule;
    } else {
      reminder.repeatRule = parsed;
      reminder.externalRecurrence = null;
    }
  }
  if (reminder.dueAt) {
    reminder.occurrenceKey = occurrenceKeyFor(reminder.id, reminder.dueAt);
  }
}

async function syncKeep(state: SyncState, config: SyncConfig, client: SyncClient): Promise<void> {
  let notes = await client.listNotes();
  for (const note of notes) {
    const parsed = parseKeepBody(note.bodyText);
    const mapped = findByRemote(state.mappings, "keep", "reminder", note.name);
    const localId = mapped?.localId ?? parsed.localId;
    const local = state.reminders.find((reminder) => reminder.id === localId) ?? null;
    if (local?.deletedAt) {
      continue;
    }
    if (!local) {
      const id =
        parsed.localId && !state.reminders.some((reminder) => reminder.id === parsed.localId)
          ? parsed.localId
          : config.createId();
      state.reminders.push(
        importedReminder({
          id,
          listId: config.defaultListId,
          title: note.title,
          notes: parsed.notes,
          dueAt: parsed.dueAt,
          completed: note.checked,
          repeatRule: "none",
          externalRecurrence: null,
          now: config.now,
          remoteUpdated: note.updateTime,
        }),
      );
      state.mappings = upsertMapping(state.mappings, {
        provider: "keep",
        localKind: "reminder",
        localId: id,
        remoteId: note.name,
        lastPushedAt: note.updateTime,
      });
      continue;
    }
    const merged = mergePresentFields(
      {
        title: local.title,
        notes: local.notes,
        dueAt: local.dueAt,
        completed: Boolean(local.completedAt),
        listId: local.listId,
      },
      local.clocks,
      {
        title: note.title,
        notes: parsed.notes,
        dueAt: parsed.dueAt,
        completed: note.checked,
      },
      note.updateTime,
      ["title", "notes", "dueAt", "completed"],
    );
    local.title = String(merged.values.title);
    local.notes = String(merged.values.notes ?? "");
    local.dueAt = (merged.values.dueAt as string | null) ?? local.dueAt;
    local.clocks = merged.clocks;
    if (merged.tookRemote.includes("completed")) {
      local.completedAt = merged.values.completed ? note.updateTime : null;
    }
    if (local.dueAt) {
      local.occurrenceKey = occurrenceKeyFor(local.id, local.dueAt);
    }
  }

  notes = await client.listNotes();
  for (const reminder of state.reminders) {
    const hint = notes.find((note) => parseKeepBody(note.bodyText).localId === reminder.id)?.name ?? null;
    const decision = planPush(state.mappings, "keep", "reminder", reminder.id, hint);
    const mapping = findByLocal(state.mappings, "keep", "reminder", reminder.id);
    if (reminder.deletedAt) {
      if (decision.action === "update") {
        await client.deleteNote(decision.remoteId);
      }
      state.mappings = state.mappings.filter((item) => !(item.provider === "keep" && item.localKind === "reminder" && item.localId === reminder.id));
      continue;
    }
    const remote = decision.action === "update" ? notes.find((note) => note.name === decision.remoteId) : null;
    if (remote && remote.updateTime > maxClock(reminder.clocks)) {
      continue;
    }
    if (mapping && !needsPush(reminder.clocks, mapping.lastPushedAt)) {
      continue;
    }
    const created = await client.createNote({
      title: reminder.title,
      bodyText: encodeKeepBody(reminder.notes, reminder.id, reminder.dueAt),
      checked: Boolean(reminder.completedAt),
    });
    if (planKeepWrite(Boolean(mapping || hint)) === "replace" && decision.action === "update") {
      await client.deleteNote(decision.remoteId);
    }
    state.mappings = upsertMapping(state.mappings, {
      provider: "keep",
      localKind: "reminder",
      localId: reminder.id,
      remoteId: created.name,
      lastPushedAt: config.now,
    });
    notes = await client.listNotes();
  }
}
