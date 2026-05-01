import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Keep only the most recently played episode per series in the Resume feed.
 *
 * Jellyfin's /Items/Resume endpoint returns episodes sorted by `DatePlayed`
 * descending, so the first occurrence of a given `SeriesId` IS the latest
 * watched episode. Movies and items without a series ID pass through unchanged.
 *
 * Why: showing two episodes of the same series in "Reprendre la lecture" feels
 * redundant — the user only ever wants to resume the most recent one.
 */
export function dedupResumeBySeries(items: MediaItem[]): MediaItem[] {
  const seenSeries = new Set<string>();
  const out: MediaItem[] = [];
  for (const it of items) {
    if (it.Type === "Episode" && it.SeriesId) {
      if (seenSeries.has(it.SeriesId)) continue;
      seenSeries.add(it.SeriesId);
    }
    out.push(it);
  }
  return out;
}

/**
 * Remove from "Next Up" any episode whose series is currently being resumed.
 *
 * Reasoning: if the user is mid-way through S01E05, the row "Prochains
 * épisodes" should NOT advertise S01E06 yet — the current episode isn't
 * finished. Once the user finishes S01E05 (or marks it watched), Jellyfin
 * removes it from Resume and S01E06 naturally surfaces here.
 */
export function filterNextUpAgainstResume(
  nextUp: MediaItem[],
  resume: MediaItem[],
): MediaItem[] {
  const inProgressSeries = new Set<string>();
  for (const it of resume) {
    if (it.Type === "Episode" && it.SeriesId) {
      inProgressSeries.add(it.SeriesId);
    }
  }
  if (inProgressSeries.size === 0) return nextUp;
  return nextUp.filter(
    (it) => !(it.Type === "Episode" && it.SeriesId && inProgressSeries.has(it.SeriesId)),
  );
}
