/**
 * Le catalogue de recherche du SERVEUR, et son moteur — un seul pour tous les
 * comptes : le texte cherchable (titres, casting, genres) est le même pour
 * tous. Ce qui change d'un compte à l'autre, c'est ce qu'il a le droit de voir,
 * tenu à part (`userAccess.ts`) sans rien réindexer.
 *
 * # Quand il se relève
 *
 * - au démarrage, en fond (`prewarmSearchCatalog`), pour que la première
 *   recherche ne l'attende pas ;
 * - 30 s après un `LibraryChanged` — les scans en envoient des salves : une
 *   seule relève, INCRÉMENTALE (ce que Jellyfin a enregistré depuis la
 *   précédente, marge de cinq minutes pour l'horloge), puis réindexation en
 *   mémoire ;
 * - en entier toutes les six heures : c'est le seul moment où un titre
 *   SUPPRIMÉ quitte l'index. D'ici là il n'apparaît à personne — les droits
 *   de chaque compte, relevés à part, ne le contiennent plus.
 *
 * Tant qu'aucun moteur n'existe, `currentEngine()` rend `null` et la recherche
 * répond par Jellyfin seul (`fallback.ts`) : jamais d'attente.
 */

import { fetchCatalogItems, type CatalogItem } from "./catalogSource";
import { SearchEngine } from "./engine";

const FULL_REBUILD_MS = 6 * 3600_000;
const CHANGE_DEBOUNCE_MS = 30_000;
const CLOCK_MARGIN_MS = 5 * 60_000;
/** Un échec de relève ne se retente pas avant une minute. */
const RETRY_AFTER_MS = 60_000;

let engine: SearchEngine | null = null;
let catalog: Map<string, CatalogItem> | null = null;
let fullAt = 0;
let incrementalSince = 0;
let building: Promise<void> | null = null;
let changeTimer: NodeJS.Timeout | null = null;
let failedAt = 0;

async function rebuild(incremental: boolean): Promise<void> {
  const startedAt = Date.now();
  const since = incremental && catalog !== null ? new Date(incrementalSince - CLOCK_MARGIN_MS) : null;
  const fetched = await fetchCatalogItems(since);
  if (fetched === null) {
    failedAt = Date.now();
    return;
  }
  const next = since === null || catalog === null ? new Map<string, CatalogItem>() : new Map(catalog);
  for (const item of fetched) next.set(item.id, item);
  const built = new SearchEngine([...next.values()]);
  catalog = next;
  engine = built;
  incrementalSince = startedAt;
  if (since === null) fullAt = startedAt;
  console.info(
    `[search] index ${since === null ? "complet" : "incrémental"} — ${built.size} titres, ` +
      `${built.persons.size} personnes, ${fetched.length} relevés en ${Date.now() - startedAt} ms`,
  );
}

function launch(incremental: boolean): Promise<void> {
  if (building !== null) return building;
  building = rebuild(incremental)
    .catch((err: unknown) => {
      failedAt = Date.now();
      console.warn(`[search] relève du catalogue en échec — ${String(err)}`);
    })
    .finally(() => { building = null; });
  return building;
}

/**
 * Le moteur courant, ou `null` s'il n'existe pas encore (une construction est
 * alors lancée). Un moteur de plus de six heures se reconstruit en fond.
 */
export function currentEngine(): SearchEngine | null {
  const now = Date.now();
  if (now - failedAt >= RETRY_AFTER_MS) {
    if (engine === null) void launch(false);
    else if (now - fullAt >= FULL_REBUILD_MS) void launch(false);
  }
  return engine;
}

/** Sur `LibraryChanged` : une relève incrémentale, une seule par salve. */
export function markCatalogChanged(): void {
  if (changeTimer !== null) clearTimeout(changeTimer);
  changeTimer = setTimeout(() => {
    changeTimer = null;
    void launch(engine !== null);
  }, CHANGE_DEBOUNCE_MS);
}

/** Au démarrage du serveur : le moteur se construit avant la première recherche. */
export function prewarmSearchCatalog(): Promise<void> {
  return launch(false);
}

/** Attend la construction en cours, s'il y en a une — pour les tests et les outils. */
export function catalogSettled(): Promise<void> {
  return building ?? Promise.resolve();
}

export function resetSearchCatalogForTests(): void {
  engine = null;
  catalog = null;
  fullAt = 0;
  incrementalSince = 0;
  building = null;
  failedAt = 0;
  if (changeTimer !== null) clearTimeout(changeTimer);
  changeTimer = null;
}
