export type ImportCandidate = {
  dueAt: string | null;
  repeating: boolean;
};

/** Device import is read-only and skips undated or repeating items. */
export function selectImportableReminders<T extends ImportCandidate>(items: T[]): T[] {
  return items.filter((item) => Boolean(item.dueAt) && !item.repeating);
}
