/**
 * Regroupement du catalogue hors ligne, sur deux niveaux : films d'un côté ;
 * de l'autre les épisodes réunis par SAISON, puis les saisons réunies par
 * SÉRIE.
 *
 * Le second niveau existe parce qu'une série de six saisons occupait six
 * cartes côte à côte dans le catalogue, à côté des films : c'est la série
 * qu'on cherche, la saison ne vient qu'après.
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

/**
 * Ce qu'une vignette doit montrer de la progression.
 *
 * Même convention qu'en ligne (`PosterTile`) : une coche quand c'est vu, une
 * barre sinon — jamais les deux. La barre reste muette sous 1 %, `CardProgressBar`
 * s'en charge.
 */
export interface OfflineWatchState {
  watched: boolean;
  /** Pourcentage, ou `null` quand la durée est inconnue. */
  percent: number | null;
}

export function watchStateOf(entry: DownloadEntry): OfflineWatchState {
  if (entry.played) return { watched: true, percent: null };
  const runtime = entry.runtimeTicks ?? 0;
  if (runtime <= 0 || entry.positionTicks <= 0) return { watched: false, percent: null };
  return { watched: false, percent: Math.min(100, (entry.positionTicks / runtime) * 100) };
}

/**
 * État d'un GROUPE (saison, série) : vu quand tout l'est.
 *
 * Un groupe partiellement vu ne porte pas de barre : la fraction d'épisodes
 * regardés et l'avancement dans un épisode ne sont pas la même grandeur, les
 * mélanger dans une seule barre mentirait. C'est aussi ce que fait Jellyfin.
 */
export function groupWatchState(entries: DownloadEntry[]): OfflineWatchState {
  const watched = entries.length > 0 && entries.every((entry) => entry.played);
  return { watched, percent: null };
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

/** Une série et ses saisons téléchargées. */
export interface OfflineSeriesGroup {
  /** Clé d'URL stable. */
  key: string;
  seriesId: string | null;
  seriesName: string;
  /** Saisons triées par numéro, celles sans numéro à la fin. */
  seasons: OfflineSeasonGroup[];
  episodeCount: number;
  /** Item dont les images illustrent la série (affiche verticale, bannière). */
  posterItemId: string;
}

function seriesKey(group: OfflineSeasonGroup): string {
  // L'identifiant de série est l'identité la plus fiable ; à défaut le nom,
  // qui regroupe au moins ce qui s'affiche pareil.
  if (group.seriesId) return group.seriesId;
  return `name:${group.seriesName}`;
}

/**
 * Réunit les saisons par série. L'entrée est la sortie de
 * `groupOfflineEntries`, donc déjà triée — l'ordre des saisons en découle.
 */
export function groupSeasonsBySeries(seasons: OfflineSeasonGroup[]): OfflineSeriesGroup[] {
  const byKey = new Map<string, OfflineSeasonGroup[]>();
  for (const season of seasons) {
    const key = seriesKey(season);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(season);
    else byKey.set(key, [season]);
  }

  const series: OfflineSeriesGroup[] = [...byKey.entries()].map(([key, list]) => {
    const ordonnees = [...list].sort((a, b) => (a.seasonNumber ?? LAST) - (b.seasonNumber ?? LAST));
    const first = ordonnees[0];
    return {
      key,
      seriesId: first.seriesId,
      seriesName: first.seriesName,
      seasons: ordonnees,
      episodeCount: ordonnees.reduce((total, s) => total + s.episodes.length, 0),
      posterItemId: first.posterItemId,
    };
  });

  series.sort((a, b) => a.seriesName.localeCompare(b.seriesName));
  return series;
}

/** La série correspond-elle à la recherche (son titre, ou celui d'un épisode) ? */
export function seriesGroupMatches(group: OfflineSeriesGroup, needle: string): boolean {
  if (!needle) return true;
  return group.seasons.some((season) => seasonGroupMatches(season, needle));
}

/**
 * « Saison 2 », ou le repli quand le numéro manque encore.
 *
 * Ici plutôt que dans un composant : les deux écrans du catalogue hors ligne en
 * ont besoin, et les faire dépendre l'un de l'autre lierait leurs deux chunks.
 */
export function seasonLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  seasonNumber: number | null,
): string {
  return seasonNumber != null
    ? t("downloads:seasonLabel", { num: seasonNumber })
    : t("downloads:seasonUnknown");
}
