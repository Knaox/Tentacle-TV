/**
 * Les films d'une SAGA TMDB présents dans la bibliothèque.
 *
 * Jellyfin note sur chaque film la saga à laquelle il appartient
 * (`ProviderIds.TmdbCollection`), mais ne sait pas filtrer dessus. L'index de
 * recherche, lui, relève déjà tout le catalogue : il connaît la saga de chaque
 * film (`CatalogItem.tmdbCollection`). On en tire, une fois par moteur, la
 * table « saga → films ».
 *
 * Mêmes droits que la recherche : seuls les titres que le compte peut voir
 * (`userAccess.ts`). Le client relit ensuite ces titres chez Jellyfin, par
 * leurs identifiants — d'où l'importance du filtre ICI : avec une liste
 * d'`Ids`, Jellyfin n'applique plus celui des bibliothèques autorisées.
 */

import type { SagaMember } from "../../saga/sagaTypes";
import { currentEngine } from "./catalog";
import type { SearchEngine } from "./engine";
import { getUserAccess } from "./userAccess";

/** Le moteur est remplacé à chaque relève : sa table part avec lui. */
const tables = new WeakMap<SearchEngine, Map<string, string[]>>();

function sagaTable(engine: SearchEngine): Map<string, string[]> {
  const known = tables.get(engine);
  if (known !== undefined) return known;
  const table = new Map<string, string[]>();
  for (const item of engine.items.values()) {
    if (item.tmdbCollection === null) continue;
    const films = table.get(item.tmdbCollection);
    if (films === undefined) table.set(item.tmdbCollection, [item.id]);
    else films.push(item.id);
  }
  tables.set(engine, table);
  return table;
}

/** `ready: false` : l'index ou les droits du compte ne sont pas encore relevés. */
export type SagaMembersResult = { ready: false } | { ready: true; members: SagaMember[] };

export async function sagaMembersFor(userId: string, collectionId: number): Promise<SagaMembersResult> {
  const engine = currentEngine();
  if (engine === null) return { ready: false };
  const ids = sagaTable(engine).get(String(collectionId)) ?? [];
  if (ids.length === 0) return { ready: true, members: [] };
  const access = await getUserAccess(userId);
  if (access === null) return { ready: false };
  const members: SagaMember[] = [];
  for (const id of ids) {
    if (!access.items.has(id)) continue;
    const tmdbId = Number(engine.items.get(id)?.tmdbId ?? Number.NaN);
    members.push({ itemId: id, tmdbId: Number.isInteger(tmdbId) && tmdbId > 0 ? tmdbId : null });
  }
  return { ready: true, members };
}
