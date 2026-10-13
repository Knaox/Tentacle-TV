import type { PoolPayload } from "./generationJob";
import type { PageSnapshot, SnapshotRow } from "./pageSnapshot";
import type { RecoRowItem } from "./rowItem";
import { utcDayStamp } from "./seedRotation";
import type { RecoState } from "./serveContext";

/** Un snapshot de plus de six heures se reconstruit, même sans autre raison. */
export const SNAPSHOT_MAX_AGE_MS = 6 * 3600_000;

/** Jour UTC « YYYY-MM-DD » — LA clé du tirage quotidien (seedRotation). */
export function utcDayKey(date: Date | string | number): string {
  return utcDayStamp(new Date(date));
}

/** Retire des items d'un snapshot selon un prédicat ; une rangée vidée
 *  disparaît ; jamais de mutation (le snapshot lu peut être partagé). */
export function filterRowItems(
  rows: readonly SnapshotRow[],
  keep: (item: RecoRowItem) => boolean
): SnapshotRow[] {
  const out: SnapshotRow[] = [];
  for (const row of rows) {
    const items = row.items.filter(keep);
    if (items.length > 0) out.push({ ...row, items });
  }
  return out;
}

/**
 * Les exclusions DU MOMENT (note posée il y a dix secondes, « ne plus me
 * proposer ») s'appliquent au service, sur le snapshot : le titre disparaît
 * sans attendre la reconstruction — c'est ce que garantissait la dérivation
 * à chaque requête, sans son coût.
 */
export function applyServeExclusions(rows: readonly SnapshotRow[], exclude: ReadonlySet<string>): SnapshotRow[] {
  if (exclude.size === 0) return [...rows];
  return filterRowItems(rows, (item) => !exclude.has(item.key));
}

/**
 * Ordonne une rangée GLOBALE (tendances, pouls du serveur) selon le goût du
 * compte : les titres que son pool connaît passent devant, du mieux classé
 * au moins bien classé ; les autres suivent dans leur ordre d'origine. Les
 * mêmes titres pour tous, mais plus dans le même ordre.
 */
export function rankByPool<T extends { key: string }>(
  items: readonly T[],
  scoreOf: ReadonlyMap<string, number> | null
): T[] {
  if (!scoreOf || scoreOf.size === 0) return [...items];
  const known = items.filter((i) => scoreOf.has(i.key));
  const rest = items.filter((i) => !scoreOf.has(i.key));
  known.sort((a, b) => scoreOf.get(b.key)! - scoreOf.get(a.key)!);
  return [...known, ...rest];
}

/** Proximité aux goûts exigée d'un titre d'une rangée GLOBALE (tendances, pouls, communauté). */
export const GLOBAL_RELEVANCE_FLOOR = 0.25;
/** Au-delà, l'univers du titre est un univers que le compte évite. */
export const GLOBAL_AVERSION_MAX = 0.5;
/** La correspondance d'un titre servi que le pool ne classe pas (la queue du pool). */
export const GLOBAL_TAIL_MATCH = 50;

/**
 * Les rangées GLOBALES passent par le goût du compte : ce que la famille
 * regarde (le pouls du serveur), ce qui est tendance, ce que les autres
 * regardent aussi n'est montré qu'à qui cela ressemble — un titre que le pool
 * du compte a classé assez proche de ses goûts, d'un univers qu'il n'évite pas,
 * du mieux classé au moins bien. « Les mieux notés de la bibliothèque » garde
 * son ordre (c'est son titre) sous la même porte. Un pool d'avant
 * les ancres (sans proximité) garde l'ancienne règle : réordonner, sans écarter.
 */
export function gateGlobalRow<T extends { key: string; match?: number }>(rowKey: string, items: readonly T[], pool: PoolPayload | null): T[] {
  if (!pool) return [...items];
  const byKey = new Map(pool.entries.map((e) => [e.candidate.key, e]));
  const anchored = pool.entries.some((e) => e.breakdown.relevance !== undefined);
  const averse = (key: string) => (byKey.get(key)?.breakdown.aversion ?? 0) >= GLOBAL_AVERSION_MAX;
  // Tout titre servi porte sa correspondance, ou aucun : hors du pool, c'est la queue.
  const withMatch = (list: T[]): T[] =>
    pool.entries.some((e) => e.match !== undefined) ? list.map((i) => ({ ...i, match: byKey.get(i.key)?.match ?? GLOBAL_TAIL_MATCH })) : list;
  if (!anchored) return rankByPool(items, new Map(pool.entries.map((e) => [e.candidate.key, e.breakdown.total])));
  const kept = items.filter((i) => (byKey.get(i.key)?.breakdown.relevance ?? 0) >= GLOBAL_RELEVANCE_FLOOR && !averse(i.key));
  // « Les mieux notés » garde l'ordre des notes (c'est son titre), mais seulement
  // ce qui ressemble au compte : sinon un spécial TV ou une série d'ados y passaient.
  if (rowKey === "bestOfLibrary") return withMatch(kept);
  return withMatch(kept.sort((a, b) => byKey.get(b.key)!.breakdown.total - byKey.get(a.key)!.breakdown.total));
}

/** Rangées que seul un client qui les sait titrer reçoit (`?themes=1`, RECO_PAGE_THEMES_PARAM). */
export function isThemedRow(key: string): boolean {
  return key === "forYouMovies" || key.startsWith("person:");
}

/**
 * Pur : la page d'un client qui reçoit les rangées à thème — un titre n'y
 * paraît qu'UNE fois, à sa première rangée (« Films pour vous », deuxième,
 * garde ses films ; les rangées suivantes les perdent) ; une rangée devenue
 * trop mince n'est plus servie. « Pour vous », la première, ne perd rien.
 */
export function dedupeServedRows<T extends { key: string; items: ReadonlyArray<{ key: string }> }>(rows: readonly T[], minItems: number): T[] {
  const shown = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const items = row.items.filter((item) => !shown.has(item.key));
    if (out.length > 0 && items.length < minItems) continue;
    for (const item of items) shown.add(item.key);
    out.push(items.length === row.items.length ? row : { ...row, items });
  }
  return out;
}

/** Sous un filtre, une rangée trop mince n'est pas une rangée. */
export function dropThinRows(rows: readonly SnapshotRow[], minItems: number): SnapshotRow[] {
  return rows.filter((row) => row.items.length >= minItems);
}

export type StaleReason = "state" | "pool" | "profile" | "settings" | "globals" | "day" | "age";

export interface StalenessProbe {
  now: Date;
  state: RecoState;
  poolGeneratedAt: string | null;
  profileComputedAt: string | null;
  settingsUpdatedAt: string | null;
  globalsGeneratedAt: string | null;
}

/**
 * Pourquoi un snapshot est périmé — toutes les sondes se lisent sans parser
 * le pool. La raison ne change pas le service (on sert quand même), elle
 * décide de la reconstruction en fond et se lit dans les journaux.
 */
export function snapshotStaleReason(snapshot: PageSnapshot, probe: StalenessProbe): StaleReason | null {
  if (snapshot.state !== probe.state) return "state";
  if (snapshot.poolGeneratedAt !== probe.poolGeneratedAt) return "pool";
  if (snapshot.profileComputedAt !== probe.profileComputedAt) return "profile";
  if (snapshot.settingsUpdatedAt !== probe.settingsUpdatedAt) return "settings";
  if (snapshot.globalsGeneratedAt !== probe.globalsGeneratedAt) return "globals";
  if (snapshot.dayKey !== utcDayKey(probe.now)) return "day";
  const builtAt = Date.parse(snapshot.builtAt);
  if (!Number.isFinite(builtAt) || probe.now.getTime() - builtAt >= SNAPSHOT_MAX_AGE_MS) return "age";
  return null;
}
