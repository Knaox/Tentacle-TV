/**
 * Ce que la bibliothèque montre à UN compte — et ce qu'elle lui cache.
 *
 * Les rangées de recommandations, la saga et Affiner mêlent deux sortes de
 * titres : ceux de la bibliothèque (un `jellyfinItemId`) et des titres
 * extérieurs (TMDB seul, « Demander »). Les deux portent des droits
 * (docs/DROITS-UTILISATEURS.md § 5) :
 *
 * - un titre de la bibliothèque n'est montré que si le compte le VOIT —
 *   un instantané ou un pool calculé avant un changement de politique le
 *   garderait sinon ;
 * - un titre extérieur dont la clé TMDB est DANS la bibliothèque mais cachée
 *   au compte n'est pas « à demander » : c'est le même film, que ses droits lui
 *   interdisent. Sans cette règle, il revenait par TMDB, Vigie ou les voisins,
 *   affiche comprise.
 *
 * Deux sources déjà en mémoire, aucune requête de plus : le catalogue commun
 * de la recherche (`catalog.ts`, toutes les clés TMDB du serveur) et les
 * droits du compte (`userAccess.ts`, relevés au nom du compte, sans `Ids` —
 * Jellyfin y applique note, étiquettes ET bibliothèques).
 */

import { currentEngine } from "./catalog";
import type { SearchEngine } from "./engine";
import { getUserAccess, type UserAccess } from "./userAccess";

export interface LibraryRights {
  /** Ce titre de la bibliothèque est visible au compte. */
  seesItem(itemId: string): boolean;
  /** Ce titre est dans la bibliothèque (le catalogue commun) mais caché au compte —
   *  un titre SUPPRIMÉ depuis n'est pas « caché » : il n'y est plus. */
  hidesItem(itemId: string): boolean;
  /** Ce titre (clé TMDB) est dans la bibliothèque, mais caché au compte. */
  hidesTitle(mediaType: "movie" | "tv", tmdbId: number): boolean;
  /** Ce titre (clé TMDB) est dans la bibliothèque, et le compte en voit une version. */
  seesTitle(mediaType: "movie" | "tv", tmdbId: number): boolean;
}

/** Le moteur est remplacé à chaque relève : sa table part avec lui. */
const tables = new WeakMap<SearchEngine, Map<string, string[]>>();

function keyOf(mediaType: "movie" | "tv", tmdbId: number | string): string {
  return `${mediaType}:${tmdbId}`;
}

/** « movie:603 » → les titres de la bibliothèque qui le portent. */
function tmdbTable(engine: SearchEngine): Map<string, string[]> {
  const known = tables.get(engine);
  if (known !== undefined) return known;
  const table = new Map<string, string[]>();
  for (const item of engine.items.values()) {
    if (item.tmdbId === null) continue;
    const mediaType = item.type === "Movie" ? "movie" : item.type === "Series" ? "tv" : null;
    if (mediaType === null) continue;
    const key = keyOf(mediaType, item.tmdbId);
    const ids = table.get(key);
    if (ids === undefined) table.set(key, [item.id]);
    else ids.push(item.id);
  }
  tables.set(engine, table);
  return table;
}

const normalize = (id: string) => id.replace(/-/g, "").toLowerCase();

/** Les ids du catalogue, normalisés — table refaite avec le moteur. */
const catalogIds = new WeakMap<SearchEngine, Set<string>>();

function catalogOf(engine: SearchEngine): Set<string> {
  const known = catalogIds.get(engine);
  if (known !== undefined) return known;
  const ids = new Set([...engine.items.keys()].map(normalize));
  catalogIds.set(engine, ids);
  return ids;
}

/** Un relevé est remplacé à chaque rafraîchissement : son ensemble part avec lui. */
const visibleSets = new WeakMap<UserAccess, Set<string>>();

function visibleOf(access: UserAccess): Set<string> {
  const known = visibleSets.get(access);
  if (known !== undefined) return known;
  const visible = new Set([...access.items.keys()].map(normalize));
  visibleSets.set(access, visible);
  return visible;
}

/**
 * `null` : le catalogue ou les droits du compte ne sont pas encore relevés
 * (démarrage, Jellyfin muet) — l'appelant ferme alors ce qu'il ne peut pas
 * juger (§ 1 du contrat : fermé à l'échec).
 */
export async function libraryRightsFor(userId: string): Promise<LibraryRights | null> {
  const engine = currentEngine();
  if (engine === null) return null;
  const access = await getUserAccess(userId);
  if (access === null) return null;
  const visible = visibleOf(access);
  const table = tmdbTable(engine);
  return {
    seesItem: (itemId) => visible.has(normalize(itemId)),
    hidesItem: (itemId) => catalogOf(engine).has(normalize(itemId)) && !visible.has(normalize(itemId)),
    hidesTitle: (mediaType, tmdbId) => {
      const ids = table.get(keyOf(mediaType, tmdbId));
      return ids !== undefined && !ids.some((id) => visible.has(normalize(id)));
    },
    seesTitle: (mediaType, tmdbId) => (table.get(keyOf(mediaType, tmdbId)) ?? []).some((id) => visible.has(normalize(id))),
  };
}
