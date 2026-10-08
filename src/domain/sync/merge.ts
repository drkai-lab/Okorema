import type { FieldClocks, FieldName } from "../types";

export function mergePresentFields<T extends Record<string, unknown>>(
  localValues: T,
  localClocks: FieldClocks,
  remoteValues: Partial<T>,
  remoteUpdatedAt: string,
  present: FieldName[],
): { values: T; clocks: FieldClocks; tookRemote: FieldName[] } {
  const draft: Record<string, unknown> = { ...localValues };
  const clocks = { ...localClocks };
  const tookRemote: FieldName[] = [];
  for (const field of present) {
    if (!(field in remoteValues)) {
      continue;
    }
    const localClock = localClocks[field];
    if (remoteUpdatedAt > localClock) {
      draft[field] = remoteValues[field];
      clocks[field] = remoteUpdatedAt;
      tookRemote.push(field);
    }
  }
  return { values: draft as T, clocks, tookRemote };
}

export function maxClock(clocks: FieldClocks): string {
  return Object.values(clocks).reduce((latest, value) => (value > latest ? value : latest), "");
}
