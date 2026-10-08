import type { EventDraft, RemoteEvent, RemoteNote, RemoteTask, RemoteTaskList, SyncClient } from "@/domain/sync/engine";

export type GoogleCalendarSummary = {
  id: string;
  summary: string;
  primary: boolean;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class GoogleSyncClient implements SyncClient {
  keepBlocked = false;

  constructor(
    private readonly token: () => Promise<string>,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const accessToken = await this.token();
    const response = await this.fetchImpl(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new GoogleApiError(body || response.statusText, response.status);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  async listCalendars(): Promise<GoogleCalendarSummary[]> {
    const calendars: GoogleCalendarSummary[] = [];
    let pageToken = "";
    do {
      const url = new URL("https://www.googleapis.com/calendar/v3/users/me/calendarList");
      url.searchParams.set("maxResults", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const page = await this.request<{ items?: { id: string; summary?: string; primary?: boolean }[]; nextPageToken?: string }>(url.toString());
      for (const item of page.items ?? []) {
        calendars.push({ id: item.id, summary: item.summary ?? item.id, primary: Boolean(item.primary) });
      }
      pageToken = page.nextPageToken ?? "";
    } while (pageToken);
    return calendars;
  }

  async createDedicatedCalendar(): Promise<GoogleCalendarSummary> {
    const created = await this.request<{ id: string; summary?: string }>("https://www.googleapis.com/calendar/v3/calendars", {
      method: "POST",
      body: JSON.stringify({ summary: "Okorema!", timeZone: timeZone() }),
    });
    return { id: created.id, summary: created.summary ?? "Okorema!", primary: false };
  }

  async listEvents(calendarId: string): Promise<RemoteEvent[]> {
    const events: RemoteEvent[] = [];
    let pageToken = "";
    do {
      const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
      url.searchParams.set("maxResults", "250");
      url.searchParams.set("singleEvents", "false");
      url.searchParams.set("showDeleted", "false");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const page = await this.request<{ items?: CalendarEvent[]; nextPageToken?: string }>(url.toString());
      for (const item of page.items ?? []) {
        const mapped = toRemoteEvent(item);
        if (mapped) events.push(mapped);
      }
      pageToken = page.nextPageToken ?? "";
      if (events.length >= 500) break;
    } while (pageToken);
    return events;
  }

  async insertEvent(calendarId: string, event: EventDraft): Promise<RemoteEvent> {
    const created = await this.request<CalendarEvent>(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      { method: "POST", body: JSON.stringify(toGoogleEvent(event)) },
    );
    return toRemoteEvent(created) ?? fallbackEvent(created.id ?? "", event);
  }

  async patchEvent(calendarId: string, event: RemoteEvent): Promise<RemoteEvent> {
    const patched = await this.request<CalendarEvent>(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.id)}`,
      { method: "PATCH", body: JSON.stringify(toGoogleEvent(event)) },
    );
    return toRemoteEvent(patched) ?? event;
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    await this.request<void>(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE" },
    );
  }

  async listTaskLists(): Promise<RemoteTaskList[]> {
    const lists: RemoteTaskList[] = [];
    let pageToken = "";
    do {
      const url = new URL("https://tasks.googleapis.com/tasks/v1/users/@me/lists");
      url.searchParams.set("maxResults", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const page = await this.request<{ items?: { id: string; title?: string; updated?: string }[]; nextPageToken?: string }>(url.toString());
      for (const item of page.items ?? []) {
        lists.push({ id: item.id, title: item.title ?? "", updated: item.updated ?? new Date(0).toISOString() });
      }
      pageToken = page.nextPageToken ?? "";
    } while (pageToken);
    return lists;
  }

  async insertTaskList(title: string): Promise<RemoteTaskList> {
    const created = await this.request<{ id: string; title?: string; updated?: string }>("https://tasks.googleapis.com/tasks/v1/users/@me/lists", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    return { id: created.id, title: created.title ?? title, updated: created.updated ?? new Date().toISOString() };
  }

  async patchTaskList(id: string, title: string): Promise<RemoteTaskList> {
    const patched = await this.request<{ id: string; title?: string; updated?: string }>(
      `https://tasks.googleapis.com/tasks/v1/users/@me/lists/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify({ title }) },
    );
    return { id: patched.id, title: patched.title ?? title, updated: patched.updated ?? new Date().toISOString() };
  }

  async deleteTaskList(id: string): Promise<void> {
    await this.request<void>(`https://tasks.googleapis.com/tasks/v1/users/@me/lists/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async listTasks(listId: string): Promise<RemoteTask[]> {
    const tasks: RemoteTask[] = [];
    let pageToken = "";
    do {
      const url = new URL(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks`);
      url.searchParams.set("showCompleted", "true");
      url.searchParams.set("showHidden", "true");
      url.searchParams.set("maxResults", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const page = await this.request<{ items?: GoogleTask[]; nextPageToken?: string }>(url.toString());
      for (const item of page.items ?? []) {
        if (!item.id || item.deleted) continue;
        tasks.push({
          id: item.id,
          listId,
          title: item.title ?? "",
          notes: item.notes ?? "",
          due: item.due ?? null,
          status: item.status === "completed" ? "completed" : "needsAction",
          updated: item.updated ?? new Date(0).toISOString(),
        });
      }
      pageToken = page.nextPageToken ?? "";
    } while (pageToken);
    return tasks;
  }

  async insertTask(listId: string, task: Omit<RemoteTask, "id" | "updated" | "listId">): Promise<RemoteTask> {
    const created = await this.request<GoogleTask>(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks`, {
      method: "POST",
      body: JSON.stringify({ title: task.title, notes: task.notes, due: task.due, status: task.status }),
    });
    return {
      id: created.id ?? "",
      listId,
      title: created.title ?? task.title,
      notes: created.notes ?? task.notes,
      due: created.due ?? task.due,
      status: created.status === "completed" ? "completed" : "needsAction",
      updated: created.updated ?? new Date().toISOString(),
    };
  }

  async patchTask(task: RemoteTask): Promise<RemoteTask> {
    const patched = await this.request<GoogleTask>(
      `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(task.listId)}/tasks/${encodeURIComponent(task.id)}`,
      { method: "PATCH", body: JSON.stringify({ title: task.title, notes: task.notes, due: task.due, status: task.status }) },
    );
    return { ...task, updated: patched.updated ?? task.updated };
  }

  async deleteTask(listId: string, taskId: string): Promise<void> {
    await this.request<void>(
      `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
      { method: "DELETE" },
    );
  }

  async listNotes(): Promise<RemoteNote[]> {
    try {
      const page = await this.request<{ notes?: GoogleNote[] }>("https://keep.googleapis.com/v1/notes");
      return (page.notes ?? []).map(toRemoteNote);
    } catch (error) {
      if (error instanceof GoogleApiError && (error.status === 403 || error.status === 401)) {
        this.keepBlocked = true;
        return [];
      }
      throw error;
    }
  }

  async createNote(note: { title: string; bodyText: string; checked: boolean }): Promise<RemoteNote> {
    if (this.keepBlocked) {
      throw new GoogleApiError("keep-blocked", 403);
    }
    const created = await this.request<GoogleNote>("https://keep.googleapis.com/v1/notes", {
      method: "POST",
      body: JSON.stringify({
        title: note.title,
        body: { text: { text: `${note.bodyText}\nokorema:done=${note.checked ? "1" : "0"}` } },
      }),
    });
    return toRemoteNote(created);
  }

  async deleteNote(name: string): Promise<void> {
    await this.request<void>(`https://keep.googleapis.com/v1/${name}`, { method: "DELETE" });
  }
}

type CalendarEvent = {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  updated?: string;
  start?: { dateTime?: string; date?: string };
  recurrence?: string[];
  extendedProperties?: { private?: { okoremaId?: string } };
};

type GoogleTask = {
  id?: string;
  title?: string;
  notes?: string;
  due?: string;
  status?: string;
  updated?: string;
  deleted?: boolean;
};

type GoogleNote = {
  name?: string;
  title?: string;
  updateTime?: string;
  body?: {
    text?: { text?: string };
    list?: { listItems?: { checked?: boolean; text?: { text?: string } }[] };
  };
};

function timeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function toGoogleEvent(event: EventDraft | RemoteEvent): Record<string, unknown> {
  const start = new Date(event.startIso);
  const end = new Date(start.getTime() + 30 * 60_000);
  return {
    summary: event.summary,
    description: event.description,
    start: { dateTime: start.toISOString(), timeZone: timeZone() },
    end: { dateTime: end.toISOString(), timeZone: timeZone() },
    recurrence: event.rrule ? [event.rrule] : [],
    extendedProperties: { private: { okoremaId: event.okoremaId ?? "" } },
  };
}

function toRemoteEvent(item: CalendarEvent): RemoteEvent | null {
  const startIso = item.start?.dateTime ?? (item.start?.date ? `${item.start.date}T09:00:00.000Z` : null);
  if (!item.id || !startIso) return null;
  return {
    id: item.id,
    updated: item.updated ?? new Date(0).toISOString(),
    summary: item.summary ?? "",
    description: item.description ?? "",
    startIso,
    rrule: item.recurrence?.[0] ?? null,
    okoremaId: item.extendedProperties?.private?.okoremaId ?? null,
    status: item.status === "cancelled" ? "cancelled" : "confirmed",
  };
}

function fallbackEvent(id: string, event: EventDraft): RemoteEvent {
  return {
    id,
    updated: new Date().toISOString(),
    summary: event.summary,
    description: event.description,
    startIso: event.startIso,
    rrule: event.rrule,
    okoremaId: event.okoremaId,
    status: "confirmed",
  };
}

function toRemoteNote(note: GoogleNote): RemoteNote {
  const listItems = note.body?.list?.listItems ?? [];
  const listText = listItems.map((item) => item.text?.text ?? "").join("\n");
  const raw = note.body?.text?.text ?? listText;
  const doneMatch = raw.match(/okorema:done=([01])/);
  const listChecked = listItems.length > 0 ? listItems.every((item) => item.checked) : null;
  return {
    name: note.name ?? "",
    title: note.title ?? "",
    bodyText: raw.replace(/okorema:done=[01]/g, "").trim(),
    checked: listChecked ?? doneMatch?.[1] === "1",
    updateTime: note.updateTime ?? new Date(0).toISOString(),
  };
}
