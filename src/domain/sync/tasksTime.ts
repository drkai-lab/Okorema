const MARKER = /<!--\s*okorema id=([^\s]+) dueTime=([0-9:]*)\s*-->\s*$/;

export type TaskNoteParts = {
  notes: string;
  dueTime: string | null;
  localId: string | null;
};

export function localTimeHHMM(iso: string): string {
  const date = new Date(iso);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Tasks API stores a date only. Send midnight UTC of the local calendar date
 * and keep the clock time in a notes marker.
 */
export function toTaskDue(dueAtIso: string): string {
  const date = new Date(dueAtIso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}T00:00:00.000Z`;
}

export function joinTaskNotes(notes: string, localId: string, dueAtIso: string | null): string {
  const dueTime = dueAtIso ? localTimeHHMM(dueAtIso) : "";
  const visible = notes.replace(MARKER, "").trim();
  const marker = `<!-- okorema id=${localId} dueTime=${dueTime} -->`;
  return visible ? `${visible}\n\n${marker}` : marker;
}

export function extractTaskMarker(notes: string): TaskNoteParts {
  const match = notes.match(MARKER);
  if (!match) {
    return { notes: notes.trim(), dueTime: null, localId: null };
  }
  const dueTime = match[2] || null;
  return {
    notes: notes.replace(MARKER, "").trim(),
    dueTime,
    localId: match[1],
  };
}

export function fromTaskDue(taskDue: string, dueTime: string | null): string {
  const [year, month, day] = taskDue.slice(0, 10).split("-").map(Number);
  const [hours, minutes] = (dueTime ?? "09:00").split(":").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, hours || 0, minutes || 0, 0, 0).toISOString();
}
