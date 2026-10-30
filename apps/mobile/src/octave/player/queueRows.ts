/**
 * Octave (mobile) — les RANGÉES de la file du lecteur, à plat pour la liste de tri : le titre de chaque file
 * (règle partagée `queueSections`), puis ses entrées ; toutes de la même hauteur (la liste se virtualise sans
 * mesurer). Une entrée ne se glisse que DANS sa file (`bounds`), et un lâcher devient la place dans SA file
 * (`queueActions.move`). Pur : `queueRows.test.ts`.
 */

import { queueSections, type QueueItem, type QueueState } from "@tentacle-tv/shared/octave";

export type QueueRow =
  | { kind: "header"; key: string; section: "user" | "context"; clearable: boolean }
  | { kind: "item"; key: string; item: QueueItem; section: "user" | "context" };

export interface QueueRows {
  rows: QueueRow[];
  /** Les places permises à la rangée `index` (entre la première et la dernière entrée de sa file). */
  bounds: (index: number) => { min: number; max: number };
  /** Un lâcher `from → to` (rangs des rangées) : l'entrée et sa place dans SA file ; `null` hors d'une file. */
  moveOf: (from: number, to: number) => { uid: string; toIndex: number } | null;
}

export function queueRows(queue: QueueState): QueueRows {
  const { userQueue, contextQueue } = queueSections(queue);
  const rows: QueueRow[] = [];
  const spans: Record<"user" | "context", { start: number; end: number }> = { user: { start: 0, end: -1 }, context: { start: 0, end: -1 } };
  const push = (section: "user" | "context", items: readonly QueueItem[]) => {
    if (items.length === 0) return;
    rows.push({ kind: "header", key: `h:${section}`, section, clearable: section === "user" });
    spans[section] = { start: rows.length, end: rows.length + items.length - 1 };
    for (const item of items) rows.push({ kind: "item", key: item.uid, item, section });
  };
  push("user", userQueue);
  push("context", contextQueue);
  const bounds = (index: number) => {
    const row = rows[index];
    if (!row || row.kind === "header") return { min: index, max: index };
    const span = spans[row.section];
    return { min: span.start, max: span.end };
  };
  const moveOf = (from: number, to: number) => {
    const row = rows[from];
    if (!row || row.kind !== "item") return null;
    const span = spans[row.section];
    if (to < span.start || to > span.end) return null;
    return { uid: row.item.uid, toIndex: to - span.start };
  };
  return { rows, bounds, moveOf };
}
