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
