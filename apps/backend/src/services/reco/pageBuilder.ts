import { getSeerrConfig } from "../seerConfig";
import { getWatchProviderDirectory, providerRefOf } from "../tmdb/providerDirectory";
import type { ProviderRef } from "../tmdb/providerNormalize";
import { attachProviders } from "./attachProviders";
import { libraryExclusionKeys } from "./candidates/exclusions";
import type { LibraryIndex } from "./candidates/libraryIndex";
import { getLibraryIndexMemo } from "./candidates/libraryMemo";
import { buildCommunityRow } from "./communityRow";
import { requestPoolRelief } from "./generationJob";
import type { PoolEntry, PoolPayload } from "./generationJob";
import { GLOBAL_ROW_KEYS, buildGlobalRow, fallbackRowList, weaveGlobalRows } from "./globalRows";
import { dropThinRows, gateGlobalRow } from "./pageRows";
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
  /** Vigie servie : réglage effectif du compte ET plugin présent (le banc l'émule). */
  vigieAvailable: boolean;
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
  // L'index lu ici peut être plus frais que celui du contexte (absent au
  // premier contact) : vus, favoris et Ma liste sortent aussi de la page.
  for (const key of libraryExclusionKeys(library.entries)) ctx.exclude.add(key);

  // Tendances et pouls du serveur : la matière est la même pour tous, mais
  // seul ce qui ressemble au compte passe (cf. gateGlobalRow) ; « les mieux
  // notés » garde l'ordre des notes, c'est son titre.
  const globalRows = new Map<string, SnapshotRow>();
  for (const key of GLOBAL_ROW_KEYS) {
    const built = await buildGlobalRow(userId, key, ctx);
    const items = gateGlobalRow(key, built.items, row?.pool ?? null);
    await attachProviders(items);
    globalRows.set(key, { key, items });
    await yieldToLoop();
  }
  if (ctx.community) {
    const community = await buildCommunityRow(userId, library, ctx.exclude, !ctx.includeVigie, row?.pool ?? null);
    const items = gateGlobalRow("community", community.items, row?.pool ?? null);
    await attachProviders(items);
    globalRows.set("community", { key: "community", items });
  }

  const directory = await getWatchProviderDirectory();
  const now = new Date();
  return {
    userId,
    ctx,
    pool: row?.pool ?? null,
    poolStamp: row?.stamp ?? null,
    library,
    // `ctx.includeVigie` est déjà le réglage EFFECTIF (faux sans Vigie, cf.
    // vigieSetting) ; le second terme reste une ceinture si le plugin se coupe
    // entre le contexte et la page.
    vigieAvailable: ctx.includeVigie && getSeerrConfig() !== null,
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
  const { vigieAvailable } = base;
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
  // Un titre n'apparaît qu'UNE fois dans la page : une rangée qui ne ferait que
  // répéter prend les rangs suivants (« Disponible dans votre bibliothèque » sur un
  // serveur sans Vigie), et une rangée trop mince n'est pas servie.
  const rows: SnapshotRow[] = [];
  const shown = new Set<string>();
  const themed: Array<{ at: number; key: string; seedTitle?: string }> = [];
  for (const { key, seedTitle } of order) {
    // Une rangée À THÈME (« Avec {acteur} ») se construit en DERNIER, à sa place.
    if (view && key.startsWith("person:")) {
      themed.push({ at: rows.length, key, seedTitle });
      continue;
    }
    // « Films pour vous » (à thème) suit « Pour vous » sans en répéter un titre, et
    // n'en retire aucun aux rangées suivantes : sans thèmes, la page n'a pas de trou
    // (avec, le service retire ses films des rangées suivantes, cf. dedupeServedRows).
    if (view && key === "forYouMovies") {
      const built = buildRow(view, key, { ...buildOpts, exclude: new Set([...buildOpts.exclude, ...shown]) });
      if (built && built.items.length >= PAGE_ROW_MIN_ITEMS) rows.push({ key, items: built.items });
      continue;
    }
    let row: SnapshotRow | null = null;
    const global = base.globalRows.get(key);
    if (global) {
      const items = (wanted ? global.items.filter((i) => itemMatchesFilter(i.providers, wanted)) : global.items).filter((i) => !shown.has(i.key));
      row = { key, items };
    } else if (view) {
      const built = buildRow(view, key, { ...buildOpts, exclude: new Set([...buildOpts.exclude, ...shown]) });
      if (built) row = { key, seedTitle: seedTitle ?? built.seedTitle, items: built.items, ...(built.why ? { why: built.why } : {}) };
      await yieldToLoop();
    }
    if (!row || row.items.length < PAGE_ROW_MIN_ITEMS) continue;
    rows.push(row);
    for (const item of row.items) shown.add(item.key);
  }
  // Les rangées à thème ne reprennent AUCUN titre de la page : servies (`?themes=1`)
  // ou non, la page n'a ni doublon ni trou. Chacune reprend sa place.
  let inserted = 0;
  for (const { at, key, seedTitle } of themed) {
    const built = view ? buildRow(view, key, { ...buildOpts, exclude: new Set([...buildOpts.exclude, ...shown]) }) : null;
    if (!built || built.items.length < PAGE_ROW_MIN_ITEMS) continue;
    rows.splice(at + inserted++, 0, { key, seedTitle: seedTitle ?? built.seedTitle, items: built.items, ...(built.why ? { why: built.why } : {}) });
    for (const item of built.items) shown.add(item.key);
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
    ...featuredOf(rows),
  };
}

/** Une rangée de moins de titres n'est pas une rangée (une « Tendances » d'un seul titre). */
export const PAGE_ROW_MIN_ITEMS = 6;

/** Correspondance minimale d'un titre « à la une ». */
const FEATURED_MIN_MATCH = 70;

/** Le titre « à la une » : le premier de « Pour vous » qui a un visuel large et une correspondance franche. */
function featuredOf(rows: readonly SnapshotRow[]): { featured?: { key: string; rowKey: string } } {
  const forYou = rows.find((r) => r.key === "forYou");
  const item = forYou?.items.find((i) => (i.backdropPath || i.jellyfinItemId) && (i.match ?? 0) >= FEATURED_MIN_MATCH && !i.exploration);
  return item ? { featured: { key: item.key, rowKey: "forYou" } } : {};
}
