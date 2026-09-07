/**
 * Les mises en avant du catalogue hors ligne : ce que la rangée « Reprendre »,
 * le bandeau de l'accueil local et le bouton de lecture d'une série choisissent
 * parmi les titres COMPLETS.
 *
 * Tout est pur et trié de façon stable, pour que l'écran ne saute pas d'un
 * rendu à l'autre : dernier repris d'abord (`lastPlayedAt`), puis dernier
 * ajouté (`createdAt`), les dates nulles en fin.
 */

import type { DownloadListEntry as DownloadEntry } from "../core/listing";
import { byEpisodeNumber, seriesKeyOf } from "./offlineGroups";

/** Un titre complet, entamé et pas encore vu. */
export function isInProgress(entry: DownloadEntry): boolean {
  return entry.status === "complete" && !entry.played && entry.positionTicks > 0;
}

/** Ticks restants avant la fin ; 0 sans durée connue. */
export function remainingTicks(entry: DownloadEntry): number {
  const runtime = entry.runtimeTicks ?? 0;
  if (runtime <= 0) return 0;
  return Math.max(0, runtime - entry.positionTicks);
}

/** Dernier repris d'abord, puis dernier ajouté ; sans date de lecture → après. */
function byRecency(a: DownloadEntry, b: DownloadEntry): number {
  const played = (b.lastPlayedAt ?? -1) - (a.lastPlayedAt ?? -1);
  if (played !== 0) return played;
  return b.createdAt - a.createdAt;
}

const byAdded = (a: DownloadEntry, b: DownloadEntry): number => b.createdAt - a.createdAt;

/** Les titres à reprendre, du plus récent au plus ancien. */
export function pickResumeEntries(entries: readonly DownloadEntry[], max = 12): DownloadEntry[] {
  return entries.filter(isInProgress).sort(byRecency).slice(0, max);
}

/** Une série ne prend qu'une diapositive ; un film vaut pour lui-même. */
function highlightKey(entry: DownloadEntry): string {
  return entry.kind === "episode" ? `series:${seriesKeyOf(entry)}` : `item:${entry.itemId}`;
}

/**
 * Les diapositives du bandeau : les reprises d'abord, puis les derniers titres
 * ajoutés pas encore vus, puis les vus — une entrée par série, `max` au plus.
 * Uniquement des titres complets : le bouton du bandeau doit pouvoir lire.
 */
export function pickHeroEntries(entries: readonly DownloadEntry[], max = 5): DownloadEntry[] {
  const complete = entries.filter((entry) => entry.status === "complete");
  const resume = complete.filter(isInProgress).sort(byRecency);
  const fresh = complete.filter((entry) => !isInProgress(entry) && !entry.played).sort(byAdded);
  const seen = complete.filter((entry) => entry.played).sort(byAdded);

  const out: DownloadEntry[] = [];
  const keys = new Set<string>();
  for (const entry of [...resume, ...fresh, ...seen]) {
    const key = highlightKey(entry);
    if (keys.has(key)) continue;
    keys.add(key);
    out.push(entry);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * L'épisode à lire d'une série : l'entamé le plus récent, sinon le premier non
 * vu dans l'ordre de diffusion, sinon le premier — `null` sans épisode.
 */
export function pickSeriesPlayTarget(episodes: readonly DownloadEntry[]): DownloadEntry | null {
  const ordered = [...episodes].sort(byEpisodeNumber);
  const inProgress = ordered.filter(isInProgress).sort(byRecency);
  if (inProgress[0] !== undefined) return inProgress[0];
  return ordered.find((entry) => !entry.played) ?? ordered[0] ?? null;
}
