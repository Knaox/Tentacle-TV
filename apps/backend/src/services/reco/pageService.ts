import { isPoolGenerating, poolStatus } from "./generationJob";
import { computePageFlags } from "./pageFlags";
import { buildSnapshotOnce, pokePage } from "./pageJobs";
import type { PageRebuildReason } from "./pageJobs";
import { applyServeExclusions, dedupeServedRows, filterRowItems, isThemedRow, snapshotStaleReason } from "./pageRows";
import { PAGE_ROW_MIN_ITEMS } from "./pageBuilder";
import type { StaleReason } from "./pageRows";
import { readGlobalsStamp, readSnapshot, touchSnapshot } from "./pageSnapshot";
import { isRebuilding } from "./profileBuilder";
import { filterKeyOf } from "./providerFilter";
import { rightsFilterFor } from "./recoRights";
import type { RecoRowItem } from "./rowItem";
import { serveContext } from "./serveContext";
import { trendingHeadItems, withTrendingHead } from "./trendingHead";
import type { RecoState } from "./serveContext";
import type { RecoFeatured, RecoWhy } from "./recoPageTypes";

/** Le contrat de GET /api/reco/page — la page entière, en une réponse. */
export interface RecoPage {
  state: RecoState;
  signalCount: number;
  generating: boolean;
  refining: boolean;
  exploring: boolean;
  /** Date de construction du snapshot servi. */
  generatedAt: string | null;
  poolGeneratedAt: string | null;
  tmdbConfigured: boolean;
  personalized: boolean;
  /** Le filtre appliqué (ids canonisés), null = toutes les plateformes. */
  filter: { providers: number[] } | null;
  /** Rangées AVEC leurs items — les vides sont omises. */
  rows: Array<{ key: string; seedTitle?: string; items: RecoRowItem[]; why?: RecoWhy }>;
  /** Le titre « à la une » (contrat recoPageTypes) ; absent : rien à mettre en avant. */
  featured?: RecoFeatured;
}

function rebuildReasonOf(reason: StaleReason): PageRebuildReason {
  return reason === "age" || reason === "state" ? "stale" : reason;
}

/**
 * Le chemin CHAUD : contexte une fois, snapshot en une lecture, exclusions
 * du moment, drapeaux — une dizaine de millisecondes. Un snapshot manquant
 * (première visite, filtre jamais vu) se construit à la volée, une fois ;
 * un snapshot périmé est SERVI quand même et se reconstruit en fond.
 */
export async function servePage(
  userId: string,
  providers: number[] | null,
  themes = false,
  trendingNow = false,
): Promise<RecoPage> {
  const filterKey = filterKeyOf(providers);
  const ctx = await serveContext(userId);
  const personalized = ctx.state === "warming" || ctx.state === "ready";
  const [stored, pool, globalsGeneratedAt] = await Promise.all([
    readSnapshot(userId, filterKey),
    poolStatus(userId, { kick: personalized }),
    readGlobalsStamp(),
  ]);
  const snapshot = stored ?? (await buildSnapshotOnce(userId, ctx, filterKey, providers));

  const reason = snapshotStaleReason(snapshot, {
    now: new Date(),
    state: ctx.state,
    poolGeneratedAt: pool.stamp?.generatedAt.toISOString() ?? null,
    profileComputedAt: ctx.profileComputedAt,
    settingsUpdatedAt: ctx.settingsUpdatedAt,
    globalsGeneratedAt,
  });
  if (reason) pokePage(userId, rebuildReasonOf(reason));

  // Les exclusions du MOMENT (note posée à l'instant, « ne plus me proposer »)
  // et le réglage « bibliothèque seule » s'appliquent au service : le
  // snapshot peut dater, ce qu'il montre ne trahit jamais un réglage.
  let rows = applyServeExclusions(snapshot.rows, ctx.exclude);
  if (!ctx.includeVigie) rows = filterRowItems(rows, (item) => !!item.jellyfinItemId);
  // Les droits du compte, au service aussi (cf. recoRights) : « À la une » en découle.
  rows = filterRowItems(rows, await rightsFilterFor(userId, rows.flatMap((row) => row.items)));
  // Sans thèmes : la page du snapshot, déjà sans doublon. Avec : « Films pour vous »
  // garde ses films, les rangées suivantes ne les répètent pas.
  rows = themes ? dedupeServedRows(rows, PAGE_ROW_MIN_ITEMS) : rows.filter((row) => !isThemedRow(row.key));
  // « À la une » : le titre tel que la page le sert ENCORE (exclusions du moment comprises).
  const featuredRow = snapshot.featured ? rows.find((r) => r.key === snapshot.featured!.rowKey) : undefined;
  const featuredItem = featuredRow?.items.find((i) => i.key === snapshot.featured!.key);
  // « Tendances actuelles » en tête (`?trendingNow=1`), APRÈS « À la une » : la tête
  // ne lui retire pas son titre. Servie au moment même — jamais dans un snapshot.
  if (trendingNow) rows = withTrendingHead(rows, await trendingHeadItems(userId, ctx, providers));

  const flags = computePageFlags({
    state: ctx.state,
    bootstrapping: ctx.bootstrapping,
    rebuilding: isRebuilding(userId),
    poolAbsent: personalized && pool.stamp === null,
    poolGenerating: isPoolGenerating(userId),
    snapshotPoolPreliminary: snapshot.poolPreliminary,
    snapshotBehindPool: reason === "pool",
  });
  touchSnapshot(userId, filterKey);

  return {
    state: ctx.state,
    signalCount: ctx.signalCount,
    ...flags,
    generatedAt: snapshot.builtAt,
    poolGeneratedAt: snapshot.poolGeneratedAt,
    tmdbConfigured: ctx.tmdbConfigured,
    personalized: ctx.personalized,
    filter: providers ? { providers } : null,
    rows,
    ...(featuredItem ? { featured: { item: featuredItem, rowKey: featuredRow!.key } } : {}),
  };
}
