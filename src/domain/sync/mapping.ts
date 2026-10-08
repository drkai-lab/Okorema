export type SyncProvider = "calendar" | "tasks" | "keep";

export type LocalKind = "list" | "reminder";

export type Mapping = {
  provider: SyncProvider;
  localKind: LocalKind;
  localId: string;
  remoteId: string;
  lastPushedAt: string | null;
};

export function sameMappingSlot(a: Mapping, b: Mapping): boolean {
  return (
    a.provider === b.provider &&
    a.localKind === b.localKind &&
    (a.localId === b.localId || a.remoteId === b.remoteId)
  );
}

export function upsertMapping(mappings: Mapping[], next: Mapping): Mapping[] {
  return [...mappings.filter((mapping) => !sameMappingSlot(mapping, next)), next];
}

export function findByLocal(
  mappings: Mapping[],
  provider: SyncProvider,
  localKind: LocalKind,
  localId: string,
): Mapping | null {
  return mappings.find((mapping) => mapping.provider === provider && mapping.localKind === localKind && mapping.localId === localId) ?? null;
}

export function findByRemote(
  mappings: Mapping[],
  provider: SyncProvider,
  localKind: LocalKind,
  remoteId: string,
): Mapping | null {
  return mappings.find((mapping) => mapping.provider === provider && mapping.localKind === localKind && mapping.remoteId === remoteId) ?? null;
}

export function planPush(
  mappings: Mapping[],
  provider: SyncProvider,
  localKind: LocalKind,
  localId: string,
  remoteHintId?: string | null,
): { action: "update"; remoteId: string } | { action: "create" } {
  const existing = findByLocal(mappings, provider, localKind, localId);
  if (existing) {
    return { action: "update", remoteId: existing.remoteId };
  }
  if (remoteHintId) {
    return { action: "update", remoteId: remoteHintId };
  }
  return { action: "create" };
}

export function planPull(
  mappings: Mapping[],
  provider: SyncProvider,
  localKind: LocalKind,
  remoteId: string,
): { action: "update"; localId: string } | { action: "insert" } {
  const existing = findByRemote(mappings, provider, localKind, remoteId);
  if (existing) {
    return { action: "update", localId: existing.localId };
  }
  return { action: "insert" };
}

/**
 * Remote row disappeared. Recreate it only when the device has edits newer
 * than the last successful push. Otherwise the remote deletion wins.
 */
export function planMissingRemote(localUpdatedAt: string, lastPushedAt: string | null): "delete-local" | "recreate-remote" {
  if (lastPushedAt && localUpdatedAt > lastPushedAt) {
    return "recreate-remote";
  }
  return "delete-local";
}

export function needsPush(clocks: { [key: string]: string }, lastPushedAt: string | null): boolean {
  if (!lastPushedAt) {
    return true;
  }
  return Object.values(clocks).some((clock) => clock > lastPushedAt);
}
