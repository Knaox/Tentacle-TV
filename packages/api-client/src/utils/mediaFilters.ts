import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Keep only the most recently played episode per series in the Resume feed,
 * and exclude items the user has marked as fully watched.
 *
 * Jellyfin's /Items/Resume endpoint returns episodes sorted by `DatePlayed`
 * descending, so the first occurrence of a given `SeriesId` IS the latest
 * watched episode. Movies and items without a series ID pass through.
 *
 * Items where `UserData.Played === true` are filtered out: they may still
 * be present in the cached list right after an optimistic "mark as watched"
 * (the server-side refresh hasn't replaced the list yet), but they no longer
 * belong in "Reprendre la lecture" — the user is done with them.
 */
export function dedupResumeBySeries(items: MediaItem[]): MediaItem[] {
  const seenSeries = new Set<string>();
  const out: MediaItem[] = [];
  for (const it of items) {
    if (it.UserData?.Played === true) continue;
    if (it.Type === "Episode" && it.SeriesId) {
      if (seenSeries.has(it.SeriesId)) continue;
      seenSeries.add(it.SeriesId);
    }
    out.push(it);
  }
  return out;
}

/**
 * Remove from "Next Up" any episode whose series has another episode
 * actively in progress (mid-playback).
 *
 * Reasoning: if the user is mid-way through S01E05, the row "Prochains
 * épisodes" should NOT advertise S01E06 yet. Once the user finishes
 * S01E05 (or marks it watched), the in-progress entry disappears
 * (`Played === true`) and S01E06 surfaces naturally.
 *
 * Items in `resume` that are `Played === true` are NOT considered
 * in-progress — they've been completed; the next episode should now be visible.
 */
export function filterNextUpAgainstResume(
  nextUp: MediaItem[],
  resume: MediaItem[],
): MediaItem[] {
  const inProgressSeries = new Set<string>();
  for (const it of resume) {
    if (it.UserData?.Played === true) continue;
    if (it.Type === "Episode" && it.SeriesId) {
      inProgressSeries.add(it.SeriesId);
    }
  }
  if (inProgressSeries.size === 0) return nextUp;
  return nextUp.filter(
    (it) => !(it.Type === "Episode" && it.SeriesId && inProgressSeries.has(it.SeriesId)),
  );
}
