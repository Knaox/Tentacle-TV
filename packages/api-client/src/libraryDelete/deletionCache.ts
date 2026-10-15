/**
 * Un titre supprimé quitte TOUT ce que le client garde en cache, sans attendre de
 * relecture : grilles des bibliothèques (pages déjà chargées), rangées de
 * l'accueil, Ma liste, Continuer, recherche, saisons et épisodes d'une série — et,
 * avec une série, ses saisons et ses épisodes (`SeriesId`, `SeasonId`).
 *
 * Puis les listes se relisent (comptes, pages suivantes) : `invalidateAllMediaQueries`
 * et les relevés de titres supprimables. La fiche d'un titre supprimé n'est pas
 * arrachée sous les yeux : marquée périmée, elle se relit (introuvable) si on y revient.
 */

import type { QueryClient } from "@tanstack/react-query";
import { invalidateAllMediaQueries } from "../hooks/cacheUtils";
import { DELETABLE_INDEX_KEY } from "./deletableIndex";

type Matcher = (item: Record<string, unknown>) => boolean;

/** Un titre de la bibliothèque, tel qu'il dort en cache (MediaItem, SearchMediaItem…). */
function isItemLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && typeof (value as { Id?: unknown }).Id === "string";
}

/** Une « touche » de la recherche (`{ item, match, score }`). */
function hitItem(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || !("item" in value)) return null;
  const item = (value as { item: unknown }).item;
  return isItemLike(item) ? item : null;
}

function dropsEntry(entry: unknown, matches: Matcher): boolean {
  if (isItemLike(entry)) return matches(entry);
  const item = hitItem(entry);
  return item !== null && matches(item);
}

/**
 * La donnée en cache, sans les titres visés — PURE et immuable : la même référence
 * quand rien ne change (TanStack ne re-rend alors rien). Descend dans les tableaux
 * et les objets (pages d'une grille infinie, sections de la recherche) ; un
 * `TotalRecordCount` voisin perd ce qui a été retiré ; un meilleur résultat visé
 * (`top.hit.item`) devient `null`. Exportée pour les tests.
 */
export function withoutItems<T>(data: T, matches: Matcher, depth = 0): T {
  if (depth > 6 || data === null || typeof data !== "object") return data;
  if (Array.isArray(data)) {
    let changed = false;
    const next: unknown[] = [];
    for (const entry of data) {
      if (dropsEntry(entry, matches)) { changed = true; continue; }
      const kept = withoutItems(entry, matches, depth + 1);
      if (kept !== entry) changed = true;
      next.push(kept);
    }
    return (changed ? next : data) as T;
  }
  if (isItemLike(data)) return data;
  const record = data as Record<string, unknown>;
  let changed = false;
  const next: Record<string, unknown> = { ...record };
  for (const [key, value] of Object.entries(record)) {
    if (key === "top" && hitItem((value as { hit?: unknown } | null)?.hit) !== null) {
      const item = hitItem((value as { hit: unknown }).hit);
      if (item !== null && matches(item)) { next[key] = null; changed = true; }
      continue;
    }
    const kept = withoutItems(value, matches, depth + 1);
    if (kept === value) continue;
    next[key] = kept;
    changed = true;
    if (Array.isArray(value) && key === "Items" && typeof record.TotalRecordCount === "number") {
      next.TotalRecordCount = Math.max(0, record.TotalRecordCount - (value.length - (kept as unknown[]).length));
    }
  }
  return (changed ? next : data) as T;
}

/** Le titre, ou un de ses descendants (épisode d'une série, saison) — identifiants comparés sans tirets. */
export function deletedItemMatcher(ids: readonly string[]): Matcher {
  const gone = new Set(ids.map((id) => id.replace(/-/g, "").toLowerCase()));
  const hit = (value: unknown) => typeof value === "string" && gone.has(value.replace(/-/g, "").toLowerCase());
  return (item) => hit(item.Id) || hit(item.SeriesId) || hit(item.SeasonId);
}

/** Les titres partis quittent les données en cache — à chaque lot, pour que la grille suive. */
export function dropDeletedFromCaches(qc: QueryClient, removedIds: readonly string[]): void {
  if (removedIds.length === 0) return;
  const matches = deletedItemMatcher(removedIds);
  for (const query of qc.getQueryCache().findAll()) {
    const prefix = query.queryKey[0];
    if (prefix === "item" || prefix === DELETABLE_INDEX_KEY) continue;
    const data = query.state.data;
    if (data === undefined) continue;
    const next = withoutItems(data, matches);
    if (next !== data) qc.setQueryData(query.queryKey, next);
  }
  for (const id of removedIds) {
    // Montée (fiche en train de se refermer) : seulement périmée ; sinon, oubliée.
    qc.invalidateQueries({ queryKey: ["item", id], refetchType: "none" });
    qc.removeQueries({ queryKey: ["item", id], type: "inactive" });
  }
}

/** Après une suppression (même partielle) : les titres partis quittent tous les caches, puis tout se relit. */
export function forgetDeletedItems(qc: QueryClient, removedIds: readonly string[]): void {
  if (removedIds.length === 0) return;
  dropDeletedFromCaches(qc, removedIds);
  invalidateAllMediaQueries(qc);
  qc.invalidateQueries({ queryKey: [DELETABLE_INDEX_KEY] });
  // Les recos et le héros se recomposent au serveur, qui vient d'oublier ces titres ;
  // les listes d'épisodes hors `LIST_QUERY_PREFIXES` se relisent aussi.
  for (const prefix of ["reco", "reco-page", "hero-artwork", "library-items", "all-episodes", "series-episodes"]) {
    qc.invalidateQueries({ queryKey: [prefix] });
  }
}
