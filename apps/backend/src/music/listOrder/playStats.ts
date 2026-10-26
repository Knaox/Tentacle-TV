/**
 * Octave — les ÉCOUTES d'un compte (Jellyfin `UserData`), pour trier une liste
 * par « Plus écoutés » ou « Écoutés récemment ». Les favoris en une requête
 * paginée (jamais une URL de 500 identifiants : Jellyfin borne la ligne de
 * requête), gardée une minute ; une playlist les reçoit avec ses entrées.
 */

import { jfAdmin, normalizeId, q, type JfItem, type JfItemsPage } from "../jellyfin/musicJellyfin";

export interface PlayStats {
  plays: number;
  lastPlayedAt: number | null;
}

const TTL_MS = 60_000;
const PAGE = 2000;
const memo = new Map<string, { at: number; stats: Map<string, PlayStats> }>();

export function playStatsOf(item: Pick<JfItem, "UserData">): PlayStats {
  const last = item.UserData?.LastPlayedDate ? Date.parse(item.UserData.LastPlayedDate) : NaN;
  return { plays: item.UserData?.PlayCount ?? 0, lastPlayedAt: Number.isFinite(last) ? last : null };
}

/** Les écoutes des titres favoris du compte ; une carte VIDE si Jellyfin est muet (le tri garde l'ordre naturel). */
export async function likedPlayStats(userId: string, libraryId: string): Promise<ReadonlyMap<string, PlayStats>> {
  const key = normalizeId(userId);
  const known = memo.get(key);
  if (known && Date.now() - known.at < TTL_MS) return known.stats;
  const stats = new Map<string, PlayStats>();
  for (let start = 0; ; start += PAGE) {
    const result = await jfAdmin<JfItemsPage>(
      `/Items?userId=${q(userId)}&ParentId=${q(libraryId)}&Recursive=true&IncludeItemTypes=Audio&IsFavorite=true&Fields=&EnableImages=false&EnableUserData=true&StartIndex=${start}&Limit=${PAGE}`,
      { timeoutMs: 30_000 },
    );
    if (!result.ok) return known?.stats ?? stats;
    const items = result.data.Items ?? [];
    for (const item of items) if (item.Id) stats.set(normalizeId(item.Id), playStatsOf(item));
    if (items.length < PAGE) break;
  }
  memo.set(key, { at: Date.now(), stats });
  return stats;
}

export function resetPlayStatsForTests(): void {
  memo.clear();
}
