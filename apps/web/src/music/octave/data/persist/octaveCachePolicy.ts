/**
 * Octave — CE QUI se garde sur l'appareil, et COMBIEN de temps (règle pure).
 *
 * Une recherche déjà faite, un album ou un artiste hors bibliothèque déjà
 * ouvert se rouvrent sans attendre, même après un redémarrage : leur page est
 * gardée (IndexedDB), rendue au cache de requêtes au montage d'Octave, puis
 * revalidée en silence comme toute donnée périmée (la page Recherche ne
 * réordonne jamais ce qu'elle montre). Le cœur ne sait pas d'où viennent ces
 * pages : il garde les clés `["music", …]` de l'extension telles quelles.
 *
 * - Recherche (`external-search`) : seulement FINIE (dernière page `complete`)
 *   et jamais provisoire — un classement qui allait changer ne se fige pas ;
 *   gardée 3 jours.
 * - Vue album / artiste / playlist (`external`) : une réponse non vide ; 14 jours.
 */

export const SEARCH_MAX_AGE_MS = 3 * 24 * 3_600_000;
export const ENTITY_MAX_AGE_MS = 14 * 24 * 3_600_000;
/** Bornes du stockage (LRU par dernière utilisation) : ~150 pages, quelques Mo. */
export const MAX_ENTRIES = 150;
export const MAX_BYTES = 6 * 1024 * 1024;

export type PersistKind = "search" | "entity";

export interface StoredEntry {
  /** La clé de requête, sérialisée (`JSON.stringify(queryKey)`). */
  id: string;
  owner: string;
  kind: PersistKind;
  data: unknown;
  /** Quand la donnée a été reçue (`dataUpdatedAt`). */
  savedAt: number;
  /** Dernière fois qu'elle a été rendue au cache ou réécrite (éviction). */
  usedAt: number;
  /** Taille estimée (JSON), pour le budget. */
  bytes: number;
}

export function persistKindOf(queryKey: unknown): PersistKind | null {
  if (!Array.isArray(queryKey) || queryKey[0] !== "music") return null;
  if (queryKey[1] === "external-search") return "search";
  if (queryKey[1] === "external") return "entity";
  return null;
}

interface PageLike {
  complete?: unknown;
  provisional?: unknown;
}

/** Une recherche infinie (`{ pages }`) finie et sûre. */
function finishedSearch(data: unknown): boolean {
  const pages = (data as { pages?: unknown } | null)?.pages;
  if (!Array.isArray(pages) || pages.length === 0) return false;
  const last = pages[pages.length - 1] as PageLike | null;
  if (!last || last.complete !== true) return false;
  return !pages.some((p) => (p as PageLike | null)?.provisional === true);
}

/** La donnée de cette clé mérite-t-elle d'être gardée telle qu'elle est ? */
export function persistable(kind: PersistKind, data: unknown): boolean {
  if (data === null || data === undefined) return false;
  return kind === "search" ? finishedSearch(data) : typeof data === "object";
}

export function maxAgeOf(kind: PersistKind): number {
  return kind === "search" ? SEARCH_MAX_AGE_MS : ENTITY_MAX_AGE_MS;
}

export function expired(entry: Pick<StoredEntry, "kind" | "savedAt">, now: number): boolean {
  return now - entry.savedAt > maxAgeOf(entry.kind);
}

/**
 * Les identifiants à retirer pour tenir les bornes : d'abord les expirées et
 * celles d'un autre compte, puis les moins récemment utilisées.
 */
export function evictionPlan(entries: readonly StoredEntry[], owner: string, now: number, maxEntries = MAX_ENTRIES, maxBytes = MAX_BYTES): string[] {
  const drop: string[] = [];
  const kept: StoredEntry[] = [];
  for (const e of entries) {
    if (e.owner !== owner || expired(e, now)) drop.push(e.id);
    else kept.push(e);
  }
  kept.sort((a, b) => b.usedAt - a.usedAt);
  let bytes = 0;
  kept.forEach((e, i) => {
    bytes += e.bytes;
    if (i >= maxEntries || bytes > maxBytes) drop.push(e.id);
  });
  return drop;
}
