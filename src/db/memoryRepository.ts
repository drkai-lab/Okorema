import type { Mapping } from "@/domain/sync/mapping";
import type { CompletionLog, EscalationState, Reminder, ReminderList } from "@/domain/types";
import type { Repository } from "@/db/repository";

type MemoryState = {
  lists: ReminderList[];
  reminders: Reminder[];
  logs: CompletionLog[];
  escalation: EscalationState[];
  mappings: Mapping[];
  settings: Record<string, string>;
};

const STORAGE_KEY = "okorema.memory.v1";

function emptyState(): MemoryState {
  return { lists: [], reminders: [], logs: [], escalation: [], mappings: [], settings: {} };
}

function loadState(): MemoryState {
  if (typeof localStorage === "undefined") {
    return emptyState();
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return emptyState();
  }
  try {
    return { ...emptyState(), ...(JSON.parse(raw) as MemoryState) };
  } catch {
    return emptyState();
  }
}

export class MemoryRepository implements Repository {
  private state: MemoryState;

  constructor() {
    this.state = loadState();
  }

  private persist(): void {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    }
  }

  async lists(): Promise<ReminderList[]> {
    return [...this.state.lists].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  }

  async reminders(): Promise<Reminder[]> {
    return [...this.state.reminders].sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
  }

  async logs(): Promise<CompletionLog[]> {
    return [...this.state.logs].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }

  async escalation(): Promise<EscalationState[]> {
    return [...this.state.escalation];
  }

  async mappings(): Promise<Mapping[]> {
    return [...this.state.mappings];
  }

  async settings(): Promise<Record<string, string>> {
    return { ...this.state.settings };
  }

  async saveList(list: ReminderList): Promise<void> {
    this.state.lists = this.state.lists.filter((item) => item.id !== list.id).concat(list);
    this.persist();
  }

  async saveReminder(reminder: Reminder): Promise<void> {
    this.state.reminders = this.state.reminders.filter((item) => item.id !== reminder.id).concat(reminder);
    this.persist();
  }

  async saveLog(log: CompletionLog): Promise<void> {
    this.state.logs = this.state.logs.filter((item) => item.id !== log.id).concat(log);
    this.persist();
  }

  async saveEscalation(states: EscalationState[]): Promise<void> {
    this.state.escalation = states;
    this.persist();
  }

  async replaceMappings(mappings: Mapping[]): Promise<void> {
    this.state.mappings = mappings;
    this.persist();
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.state.settings = { ...this.state.settings, [key]: value };
    this.persist();
  }

  async replaceAll(lists: ReminderList[], reminders: Reminder[], logs: CompletionLog[]): Promise<void> {
    this.state.lists = lists;
    this.state.reminders = reminders;
    this.state.logs = logs;
    this.persist();
  }
}
