import { getSeerrConfig } from "../seerConfig";
import { getWatchProviderDirectory, providerRefOf } from "../tmdb/providerDirectory";
import type { ProviderRef } from "../tmdb/providerNormalize";
import { attachProviders } from "./attachProviders";
import type { LibraryIndex } from "./candidates/libraryIndex";
import { getLibraryIndexMemo } from "./candidates/libraryMemo";
import { buildCommunityRow } from "./communityRow";
import { requestPoolRelief } from "./generationJob";
import type { PoolEntry, PoolPayload } from "./generationJob";
import { GLOBAL_ROW_KEYS, buildGlobalRow, fallbackRowList, weaveGlobalRows } from "./globalRows";
import { dropThinRows } from "./pageRows";
import { SNAPSHOT_VERSION, readGlobalsStamp } from "./pageSnapshot";
import type { PageSnapshot, SnapshotRow } from "./pageSnapshot";
import { readPoolRow } from "./poolStore";
import type { PoolStamp } from "./poolStore";
import { FILTERED_ROW_MIN_ITEMS, expandFamilies, itemMatchesFilter, providerIdsMatch } from "./providerFilter";
import { availableRows, buildRow } from "./rowBuilder";
import type { RowBuildOptions } from "./rowBuilder";
import { utcDayStamp } from "./seedRotation";
import type { ServeContext } from "./serveContext";

/**
 * Le constructeur de page : depuis le pool (lu UNE fois par reconstruction,
 * partagé par tous les snapshots du compte), les rangées globales et la
 * communautaire, il produit un snapshot par filtre. ZÉRO réseau, jamais dans
 * une requête. Le filtre s'applique AVANT la sélection : le pool est réduit
 * aux entrées disponibles, puis les rangées se construisent dessus — pleines,
 * et les « Parce que… » n'existent que si le sous-ensemble les remplit.
 */
export interface PageBuildBase {
  userId: string;
  ctx: ServeContext;
  pool: PoolPayload | null;
  poolStamp: PoolStamp | null;
  library: LibraryIndex;
  /** trending / serverPulse / bestOfLibrary / community — plateformes posées. */
  globalRows: Map<string, SnapshotRow>;
  /** Les plateformes de la région (élargissement des familles par le nom). */
  regional: ReadonlyArray<{ id: number; name: string }>;
  providerRefOf: (id: number) => ProviderRef;
  builtAt: string;
  dayKey: string;
  globalsGeneratedAt: string | null;
}

/** Rend la main à la boucle d'événements entre deux rangées : une
 *  reconstruction ne bloque jamais une requête plus de quelques ms. */
export function yieldToLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export async function prepareBuildBase(userId: string, ctx: ServeContext): Promise<PageBuildBase> {
  const personalized = ctx.state === "warming" || ctx.state === "ready";
  const row = personalized ? await readPoolRow(userId) : null;
  if (row?.pool.preliminary) requestPoolRelief(userId);
  const library = await getLibraryIndexMemo(userId);

  const globalRows = new Map<string, SnapshotRow>();
  for (const key of GLOBAL_ROW_KEYS) {
    const built = await buildGlobalRow(userId, key, ctx);
    await attachProviders(built.items);
    globalRows.set(key, { key, items: built.items });
    await yieldToLoop();
  }
  if (ctx.community) {
    const community = await buildCommunityRow(userId, library, ctx.exclude, !ctx.includeVigie, row?.pool ?? null);
    await attachProviders(community.items);
    globalRows.set("community", { key: "community", items: community.items });
  }

  const directory = await getWatchProviderDirectory();
  const now = new Date();
  return {
    userId,
    ctx,
    pool: row?.pool ?? null,
    poolStamp: row?.stamp ?? null,
    library,
    globalRows,
    regional: directory.providers,
    providerRefOf,
    builtAt: now.toISOString(),
    dayKey: utcDayStamp(now),
    globalsGeneratedAt: await readGlobalsStamp(),
  };
}

/** Pur : les entrées du pool disponibles sur le filtre — l'inconnu est exclu. */
export function filterPoolEntries(entries: readonly PoolEntry[], wanted: ReadonlySet<number>): PoolEntry[] {
  return entries.filter((e) => providerIdsMatch(e.providers, wanted));
}

export async function buildPageSnapshot(base: PageBuildBase, filter: number[] | null): Promise<PageSnapshot> {
  const { ctx } = base;
  const wanted = filter ? expandFamilies(filter, base.regional) : null;
  const personalized = (ctx.state === "warming" || ctx.state === "ready") && base.pool !== null;
  const vigieAvailable = ctx.includeVigie && getSeerrConfig() !== null;
  const inLibraryOnly = !ctx.includeVigie;

  let order: Array<{ key: string; seedTitle?: string }>;
  let view: PoolPayload | null = null;
  if (personalized && base.pool) {
    const entries = wanted ? filterPoolEntries(base.pool.entries, wanted) : base.pool.entries;
    view = entries === base.pool.entries ? base.pool : { ...base.pool, entries };
    let keys = availableRows(view, { vigieAvailable, inLibraryOnly, userId: base.userId, dayStamp: base.dayKey });
    if (!ctx.community) keys = keys.filter((r) => r.key !== "community");
    order = weaveGlobalRows(keys, ctx);
  } else {
    order = fallbackRowList(ctx);
  }

  const buildOpts: RowBuildOptions = {
    exclude: ctx.exclude,
    vigieAvailable,
    inLibraryOnly,
    lambda: ctx.lambda,
    profile: ctx.profile,
    providerRefOf: base.providerRefOf,
  };
  const rows: SnapshotRow[] = [];
  for (const { key, seedTitle } of order) {
    let row: SnapshotRow | null = null;
    const global = base.globalRows.get(key);
    if (global) {
      const items = wanted ? global.items.filter((i) => itemMatchesFilter(i.providers, wanted)) : global.items;
      row = { key, items };
    } else if (view) {
      const built = buildRow(view, key, buildOpts);
      if (built) row = { key, seedTitle: seedTitle ?? built.seedTitle, items: built.items };
      await yieldToLoop();
    }
    if (row && row.items.length > 0) rows.push(row);
  }

  return {
    version: SNAPSHOT_VERSION,
    builtAt: base.builtAt,
    dayKey: base.dayKey,
    state: ctx.state,
    poolGeneratedAt: base.poolStamp?.generatedAt.toISOString() ?? null,
    poolPreliminary: base.pool?.preliminary === true,
    profileComputedAt: ctx.profileComputedAt,
    settingsUpdatedAt: ctx.settingsUpdatedAt,
    globalsGeneratedAt: base.globalsGeneratedAt,
    filter: filter ? { providers: filter } : null,
    rows: wanted ? dropThinRows(rows, FILTERED_ROW_MIN_ITEMS) : rows,
  };
}
