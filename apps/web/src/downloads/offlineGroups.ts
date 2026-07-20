/**
 * Regroupement du catalogue hors ligne : films d'un côté, épisodes réunis par
 * SAISON de l'autre (« Rick et Morty · Saison 1 »), triés par numéro.
 *
 * Les numéros viennent de `item_meta` (schéma v5). Un téléchargement hérité
 * peut les avoir NULL le temps du rattrapage : ces épisodes sont placés en fin
 * de liste plutôt qu'exclus, et leur code SxxEyy est simplement masqué.
 */

import type { DownloadEntry } from "./api";

export interface OfflineSeasonGroup {
  /** Clé d'URL stable de la saison. */
  key: string;
  seriesId: string | null;
  seriesName: string;
  seasonId: string | null;
  seasonNumber: number | null;
  episodes: DownloadEntry[];
  /** Item dont les images illustrent le groupe (affiche de série, backdrop). */
  posterItemId: string;
}

export interface OfflineGroups {
  movies: DownloadEntry[];
  seasons: OfflineSeasonGroup[];
}

const LAST = Number.MAX_SAFE_INTEGER;

function seasonKey(entry: DownloadEntry): string {
  // Le seasonId est l'identité la plus fiable ; sinon on retombe sur la série
  // (une saison inconnue vaut mieux qu'un groupe par épisode).
  if (entry.seasonId) return entry.seasonId;
  const series = entry.seriesId ?? entry.seriesName ?? "?";
  return `series:${series}`;
}

/** Ordre de diffusion : saison, puis épisode. Sans numéro → à la fin. */
export function byEpisodeNumber(a: DownloadEntry, b: DownloadEntry): number {
  const seasonDiff = (a.parentIndexNumber ?? LAST) - (b.parentIndexNumber ?? LAST);
  if (seasonDiff !== 0) return seasonDiff;
  const episodeDiff = (a.indexNumber ?? LAST) - (b.indexNumber ?? LAST);
  if (episodeDiff !== 0) return episodeDiff;
  return (a.title ?? "").localeCompare(b.title ?? "");
}

/** Films et groupes de saisons, prêts à afficher (déjà triés). */
export function groupOfflineEntries(entries: DownloadEntry[]): OfflineGroups {
  const movies: DownloadEntry[] = [];
  const byKey = new Map<string, DownloadEntry[]>();

  for (const entry of entries) {
    if (entry.kind === "episode") {
      const key = seasonKey(entry);
      const bucket = byKey.get(key);
      if (bucket) bucket.push(entry);
      else byKey.set(key, [entry]);
    } else {
      movies.push(entry);
    }
  }

  const seasons: OfflineSeasonGroup[] = [...byKey.entries()].map(([key, list]) => {
    const episodes = [...list].sort(byEpisodeNumber);
    const first = episodes[0];
    return {
      key,
      seriesId: first.seriesId,
      seriesName: first.seriesName ?? first.title ?? "",
      seasonId: first.seasonId,
      seasonNumber: episodes.find((e) => e.parentIndexNumber != null)?.parentIndexNumber ?? null,
      episodes,
      posterItemId: first.itemId,
    };
  });

  seasons.sort((a, b) => {
    const byName = a.seriesName.localeCompare(b.seriesName);
    if (byName !== 0) return byName;
    return (a.seasonNumber ?? LAST) - (b.seasonNumber ?? LAST);
  });
  movies.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));

  return { movies, seasons };
}

/** Le groupe correspond-il à la recherche (titre de série, de saison ou d'épisode) ? */
export function seasonGroupMatches(group: OfflineSeasonGroup, needle: string): boolean {
  if (!needle) return true;
  const lower = needle.toLowerCase();
  return (
    group.seriesName.toLowerCase().includes(lower) ||
    group.episodes.some((e) => (e.title ?? "").toLowerCase().includes(lower))
  );
}
