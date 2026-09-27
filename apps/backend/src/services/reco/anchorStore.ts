import { getPrisma } from "../db";
import type { Anchor, MeasuredViewing } from "./anchors";
import type { FacetEntry } from "./facets";

/**
 * Stockage des ancres (colonne taste_profiles.anchors) et lecture des
 * visionnages mesurés qui les nourrissent.
 */

/** Une ancre stockée : ses facettes ne voyagent que si TMDB ne les connaît
 *  pas (repli Jellyfin) — les autres se relisent dans le cache TMDB. */
export interface StoredAnchor extends Anchor {
  facets?: FacetEntry[];
}

/** Ancres gardées : au-delà, des titres vus une fois il y a longtemps. */
export const ANCHORS_MAX = 600;

export function serializeAnchors(anchors: readonly StoredAnchor[]): string {
  return JSON.stringify(anchors.slice(0, ANCHORS_MAX));
}

/** Les ancres d'un profil ; null = profil d'avant les ancres (ou illisible). */
export function parseAnchors(raw: string | null | undefined): StoredAnchor[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (a): a is StoredAnchor =>
        !!a && typeof a === "object" && typeof (a as StoredAnchor).key === "string" &&
        typeof (a as StoredAnchor).weight === "number"
    );
  } catch {
    return null;
  }
}

/** Part du film qui fait d'une séance un visionnage. */
const FULL_VIEW_SHARE = 0.6;

/**
 * Jours distincts où chaque FILM a été regardé à au moins 60 %, d'après le
 * collecteur de temps (watch_segments) — la preuve d'un revisionnage, là où
 * le compteur Jellyfin monte à chaque lecture d'essai.
 */
export async function measuredViewings(userId: string): Promise<Map<string, MeasuredViewing>> {
  const rows = await getPrisma().watchSegment.findMany({
    where: { jellyfinUserId: userId, itemType: "Movie" },
    select: { itemId: true, seconds: true, runtimeSeconds: true, startedAt: true },
  });
  const byItem = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const day = row.startedAt.toISOString().slice(0, 10);
    const days = byItem.get(row.itemId) ?? new Map<string, number>();
    days.set(day, (days.get(day) ?? 0) + row.seconds);
    byItem.set(row.itemId, days);
  }
  const runtimeOf = new Map<string, number>();
  for (const row of rows) {
    if (row.runtimeSeconds) runtimeOf.set(row.itemId, row.runtimeSeconds);
  }
  const out = new Map<string, MeasuredViewing>();
  for (const [itemId, days] of byItem) {
    const runtime = runtimeOf.get(itemId);
    if (!runtime) continue;
    const fullDays = [...days.values()].filter((s) => s >= runtime * FULL_VIEW_SHARE).length;
    if (fullDays > 0) out.set(itemId, { fullDays });
  }
  return out;
}
