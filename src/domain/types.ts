export type PersistenceLevel = "gentle" | "normal" | "oni";

export type RepeatRule = "none" | "daily" | "weekdays" | "weekly" | "monthly";

export type Tone = "plain" | "scolding";

export type GeofenceTrigger = "arrive" | "leave";

export type GeofenceRadius = 100 | 300 | 500;

export type Geofence = {
  label: string;
  latitude: number;
  longitude: number;
  radiusMeters: GeofenceRadius;
  trigger: GeofenceTrigger;
};

export type FieldName = "title" | "notes" | "dueAt" | "completed" | "listId";

export type FieldClocks = Record<FieldName, string>;

export type Reminder = {
  id: string;
  listId: string;
  title: string;
  notes: string;
  dueAt: string | null;
  preNotifyMinutes: number | null;
  repeatRule: RepeatRule;
  /** First due in this repeat series. Monthly clamping walks from here so the day does not drift. */
  repeatAnchorAt: string | null;
  persistence: PersistenceLevel;
  completedAt: string | null;
  snoozeUntil: string | null;
  occurrenceKey: string;
  lastMutationId: string | null;
  undoSnapshot: string | null;
  geofence: Geofence | null;
  /** Original RRULE when the event used a recurrence Okorema cannot edit in place. */
  externalRecurrence: string | null;
  clocks: FieldClocks;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ReminderList = {
  id: string;
  name: string;
  color: string;
  icon: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  nameClock: string;
};

export type CompletionLog = {
  id: string;
  reminderId: string;
  title: string;
  completedAt: string;
  undoneAt: string | null;
};

export type EscalationState = {
  reminderId: string;
  anchorAt: string;
  /** Next 1-based notice that has not yet been consumed. */
  nextIndex: number;
  /** Highest index currently handed to the OS. 0 if none. */
  scheduledThroughIndex: number;
};

export const PRE_NOTIFY_OPTIONS = [5, 10, 15, 30, 45, 60] as const;

export type PreNotifyMinutes = (typeof PRE_NOTIFY_OPTIONS)[number];

export const GEOFENCE_RADII: GeofenceRadius[] = [100, 300, 500];

export function freshClocks(nowIso: string): FieldClocks {
  return {
    title: nowIso,
    notes: nowIso,
    dueAt: nowIso,
    completed: nowIso,
    listId: nowIso,
  };
}

export function occurrenceKeyFor(reminderId: string, dueAt: string | null): string {
  return `${reminderId}:${dueAt ?? "none"}`;
}

export function isValidPreNotify(minutes: number | null): boolean {
  if (minutes == null) {
    return true;
  }
  return (PRE_NOTIFY_OPTIONS as readonly number[]).includes(minutes);
}
