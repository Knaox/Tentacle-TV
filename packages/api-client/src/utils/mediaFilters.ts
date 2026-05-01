import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Build a "smart next-up" list from raw episode data.
 *
 * For each series the user has engaged with (= has at least one watched
 * episode), pick the FIRST unwatched episode in chronological order
 * (season → episode). This solves Jellyfin's NextUp blind spot: when the
 * user has watched later seasons but skipped earlier episodes, Jellyfin's
 * built-in NextUp won't surface those gaps because it tracks "next after
 * last watched", not "first unwatched".
 *
 * @param unwatched All unwatched episodes, sorted by SeriesSortName +
 *                  ParentIndexNumber + IndexNumber.
 * @param engagedEpisodes Watched episodes — used to derive the set of
 *                  series the user has actually started, ordered by recency.
 * @param limit Max items to return (default 12).
 */
export function buildSmartNextUp(
  unwatched: MediaItem[],
  engagedEpisodes: MediaItem[],
  limit = 12,
): MediaItem[] {
  // First unwatched episode per series (relies on caller's pre-sorted input)
  const firstUnwatchedBySeries = new Map<string, MediaItem>();
  for (const ep of unwatched) {
    if (!ep.SeriesId) continue;
    if (firstUnwatchedBySeries.has(ep.SeriesId)) continue;
    firstUnwatchedBySeries.set(ep.SeriesId, ep);
  }

  // Engaged series in order of most-recent engagement.
  // engagedEpisodes is sorted by DatePlayed desc, so the first occurrence
  // of a SeriesId is the most recent watch event for that series.
  const seenSeries = new Set<string>();
  const out: MediaItem[] = [];
  for (const ep of engagedEpisodes) {
    if (!ep.SeriesId || seenSeries.has(ep.SeriesId)) continue;
    seenSeries.add(ep.SeriesId);
    const next = firstUnwatchedBySeries.get(ep.SeriesId);
    if (next) {
      out.push(next);
      if (out.length >= limit) break;
    }
  }
  return out;
}

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
