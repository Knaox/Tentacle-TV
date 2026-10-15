/**
 * La sélection de titres à supprimer — règle PURE, sans React (docs/DROITS-UTILISATEURS.md § 9.7).
 *
 * Portée par des IDENTIFIANTS, jamais par des index ni des cellules : elle survit au
 * démontage des cartes hors écran (grilles virtualisées) et au chargement des pages
 * suivantes. Un titre ne se coche que si Jellyfin a dit que CE compte peut le
 * supprimer (`CanDelete`) : inconnu (pas encore relevé) = pas cochable.
 */

import { LIBRARY_DELETE_BATCH_MAX, type LibraryDeleteItemResult } from "./libraryDeleteContract";

export interface DeletionSelectionState {
  selected: ReadonlySet<string>;
  /** Le dernier titre coché ou décoché un à un : l'origine d'une plage (Maj + clic). */
  anchor: string | null;
}

export type SelectablePredicate = (id: string) => boolean;

export const EMPTY_DELETION_SELECTION: DeletionSelectionState = { selected: new Set(), anchor: null };

/** Coche ou décoche un titre ; un titre non supprimable ne bouge pas. */
export function toggleInSelection(state: DeletionSelectionState, id: string, selectable: SelectablePredicate): DeletionSelectionState {
  if (!selectable(id)) return state;
  const selected = new Set(state.selected);
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  return { selected, anchor: id };
}

/**
 * Maj + clic : la plage de l'origine au titre visé, dans l'ordre affiché, prend
 * l'état du titre visé APRÈS le geste (coché si on coche, décoché si on décoche —
 * comme le Finder). Sans origine connue dans l'ordre : un simple basculement.
 * Les titres non supprimables de la plage sont sautés ; l'origine reste.
 */
export function rangeInSelection(
  state: DeletionSelectionState,
  id: string,
  order: readonly string[],
  selectable: SelectablePredicate,
): DeletionSelectionState {
  const from = state.anchor === null ? -1 : order.indexOf(state.anchor);
  const to = order.indexOf(id);
  if (from < 0 || to < 0) return toggleInSelection(state, id, selectable);
  const check = !state.selected.has(id);
  const selected = new Set(state.selected);
  const [start, end] = from <= to ? [from, to] : [to, from];
  for (let i = start; i <= end; i++) {
    const current = order[i];
    if (!selectable(current)) continue;
    if (check) selected.add(current);
    else selected.delete(current);
  }
  return { selected, anchor: state.anchor };
}

/** Tout sélectionner : chaque titre supprimable de la liste DONNÉE (toute la bibliothèque filtrée, pas la page chargée). */
export function selectAllInSelection(ids: readonly string[], selectable: SelectablePredicate): DeletionSelectionState {
  return { selected: new Set(ids.filter(selectable)), anchor: null };
}

/** Ne garde que les titres encore présents et supprimables (filtre changé, titre parti). */
export function pruneSelection(
  state: DeletionSelectionState,
  present: ReadonlySet<string>,
  selectable: SelectablePredicate,
): DeletionSelectionState {
  let changed = false;
  const selected = new Set<string>();
  for (const id of state.selected) {
    if (present.has(id) && selectable(id)) selected.add(id);
    else changed = true;
  }
  return changed ? { selected, anchor: state.anchor !== null && selected.has(state.anchor) ? state.anchor : null } : state;
}

/** Les noms à montrer dans la confirmation : les premiers, puis « et N autres ». */
export function confirmationPreview(names: readonly string[], shown = 5): { names: string[]; more: number } {
  // Six noms valent mieux que cinq et « et 1 autre ».
  const count = names.length <= shown + 1 ? names.length : shown;
  return { names: names.slice(0, count), more: names.length - count };
}

/** La sélection découpée en lots du contrat, dans l'ordre. */
export function deletionBatches(ids: readonly string[], size = LIBRARY_DELETE_BATCH_MAX): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += size) batches.push(ids.slice(i, i + size));
  return batches;
}

export interface DeletionSummary {
  /** Supprimés, ou déjà absents : dans les deux cas, plus dans la bibliothèque. */
  removed: string[];
  /** Dont déjà absents avant l'appel. */
  gone: string[];
  /** Refusés par Jellyfin : ce compte ne peut pas supprimer ces titres. */
  forbidden: string[];
  /** Jellyfin muet ou en erreur — à retenter. */
  failed: string[];
}

/** Le bilan d'une suppression, lots réunis. Un titre sans réponse (lot perdu) est en échec. */
export function summarizeDeletion(requested: readonly string[], results: readonly LibraryDeleteItemResult[]): DeletionSummary {
  const outcomeOf = new Map(results.map((r) => [r.id, r.outcome]));
  const summary: DeletionSummary = { removed: [], gone: [], forbidden: [], failed: [] };
  for (const id of requested) {
    const outcome = outcomeOf.get(id) ?? "failed";
    if (outcome === "deleted" || outcome === "gone") summary.removed.push(id);
    if (outcome === "gone") summary.gone.push(id);
    if (outcome === "forbidden") summary.forbidden.push(id);
    if (outcome === "failed") summary.failed.push(id);
  }
  return summary;
}
