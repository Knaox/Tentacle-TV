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
 * Transforme une liste d'items « derniers ajouts » (épisodes triés par date
 * d'ajout décroissante + films) en une rangée par RUNS CONSÉCUTIFS :
 *
 *  - on ne regroupe en collection QUE les épisodes d'une même série ajoutés
 *    de façon CONSÉCUTIVE (chevauchement dans le temps d'ajout). Un run de ≥2
 *    épisodes → une tuile série synthétique (`Type: "Series"`, `Id = SeriesId`)
 *    portant `RecentlyAddedCount` = longueur du run (badge « +N ») ;
 *  - un épisode isolé (run de 1, encadré par d'autres séries) → vignette épisode
 *    individuelle. Une même série séparée par d'autres séries apparaît donc
 *    plusieurs fois (ex: Re:Zero ×3 / Rick&Morty / Re:Zero → tuile Re:Zero +3,
 *    tuile Rick&Morty, tuile Re:Zero individuelle) ;
 *  - film / item sans `SeriesId` → poussé tel quel.
 *
 * NE filtre PAS `UserData.Played` : un item vu reste dans le carrousel.
 */
export function groupLatestByRuns(items: MediaItem[], limit = 16): MediaItem[] {
  const out: MediaItem[] = [];
  let i = 0;
  while (i < items.length && out.length < limit) {
    const it = items[i];
    if (it.Type === "Episode" && it.SeriesId) {
      // Étend le run tant que l'item suivant est un épisode de la MÊME série.
      let j = i + 1;
      while (
        j < items.length &&
        items[j].Type === "Episode" &&
        items[j].SeriesId === it.SeriesId
      ) {
        j++;
      }
      const runLength = j - i;
      if (runLength > 1) {
        const run = items.slice(i, j);
        const grouped: MediaItem = {
          Id: it.SeriesId,
          Name: it.SeriesName ?? it.Name,
          Type: "Series",
          RecentlyAddedCount: runLength,
          /**
           * `UserData` SYNTHÉTIQUE — sans lui la vignette n'a aucun état à
           * montrer. Ses boutons (vu / Ma liste / Favoris) lisent l'item, et une
           * tuile fabriquée ici n'en portait pas : ils restaient éteints quoi
           * qu'on fasse, y compris après un rechargement, puisque le
           * regroupement les refabriquait vides à chaque fois.
           *
           * Seul `Played` est déduit, et il l'est des épisodes du run : « ces N
           * nouveaux épisodes sont vus ». C'est tout ce que cette réponse sache.
           *
           * `IsFavorite` et `Likes` sont des drapeaux de SÉRIE, qu'un épisode ne
           * porte pas — les recopier d'un épisode serait faux. Personne ne les
           * lit ici : l'appartenance d'une série à Ma liste / Favoris se lit
           * dans les Sets `watchlist-series-ids` / `favorite-series-ids`
           * (cf. `seriesStateId`). Les compteurs sont là pour le type.
           */
          UserData: {
            PlaybackPositionTicks: 0,
            PlayCount: 0,
            IsFavorite: false,
            Played: run.every((ep) => ep.UserData?.Played === true),
          },
        };
        out.push(grouped);
      } else {
        out.push(it); // épisode isolé → vignette individuelle
      }
      i = j;
    } else {
      out.push(it); // film / autre
      i++;
    }
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
