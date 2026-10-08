const ID_LINE = /okorema:id=([^\s]+)/;
const DUE_LINE = /okorema:due=([^\s]*)/;

export type ParsedKeepBody = {
  notes: string;
  localId: string | null;
  dueAt: string | null;
};

export function encodeKeepBody(notes: string, localId: string, dueAt: string | null): string {
  const visible = notes
    .replace(ID_LINE, "")
    .replace(DUE_LINE, "")
    .trim();
  const marker = `okorema:id=${localId}\nokorema:due=${dueAt ?? ""}`;
  return visible ? `${visible}\n\n${marker}` : marker;
}

export function parseKeepBody(text: string): ParsedKeepBody {
  const idMatch = text.match(ID_LINE);
  const dueMatch = text.match(DUE_LINE);
  const due = dueMatch?.[1] ? dueMatch[1] : null;
  const notes = text.replace(ID_LINE, "").replace(DUE_LINE, "").replace(/\n{3,}/g, "\n\n").trim();
  return {
    notes,
    localId: idMatch?.[1] ?? null,
    dueAt: due,
  };
}

/** Keep's public REST surface has create/get/list/delete and no patch. */
export function planKeepWrite(hasMapping: boolean): "create" | "replace" {
  return hasMapping ? "replace" : "create";
}
