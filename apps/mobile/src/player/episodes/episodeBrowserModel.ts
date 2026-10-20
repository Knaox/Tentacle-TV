import type { MediaItem } from "@tentacle-tv/shared";
import { cardProgress } from "../../components/cards/cardProgress";

/**
 * Ce que la liste des épisodes du lecteur montre d'un épisode, quelle que soit
 * sa mise en page (étagère, panneau, sommaire) et d'où qu'il vienne (serveur,
 * appareil) : une forme pure, sans libellé — chaque vue dit les mots.
 */
export interface EpisodeEntry {
  id: string;
  /** Le numéro dans la saison ; absent quand Jellyfin n'en a pas. */
  number?: number;
  title: string;
  overview?: string;
  /** Durée, en minutes entières (une minute au moins) ; absente si inconnue. */
  minutes?: number;
  /** Ce qu'il reste d'un épisode entamé, en minutes entières (une au moins). */
  remainingMinutes?: number;
  /** De 0 à 100 : entamé et non vu (la règle des cartes, `cardProgress`) ; sinon `null`. */
  progress: number | null;
  watched: boolean;
  /** L'épisode en lecture. */
  current: boolean;
}

/** Une saison dans la bande ou la colonne des saisons. */
export interface SeasonEntry {
  id: string;
  label: string;
  /** Le nombre d'épisodes, quand le serveur le dit. */
  count?: number;
  /** Toute la saison est vue. */
  watched: boolean;
  /** La saison de l'épisode en lecture. */
  current: boolean;
}

const TICKS_PER_MINUTE = 600_000_000;

function wholeMinutes(ticks: number): number {
  return Math.max(1, Math.round(ticks / TICKS_PER_MINUTE));
}

/** Un épisode Jellyfin dans la forme de la liste. */
export function toEpisodeEntry(item: MediaItem, currentId: string | undefined): EpisodeEntry {
  const runtime = item.RunTimeTicks ?? 0;
  const progress = cardProgress(item);
  const position = item.UserData?.PlaybackPositionTicks ?? 0;
  const remaining = progress !== null && runtime > 0
    ? Math.max(1, Math.ceil((runtime - (position > 0 ? position : (runtime * progress) / 100)) / TICKS_PER_MINUTE))
    : undefined;
  return {
    id: item.Id,
    number: item.IndexNumber ?? undefined,
    title: item.Name ?? "",
    overview: item.Overview?.trim() || undefined,
    minutes: runtime > 0 ? wholeMinutes(runtime) : undefined,
    remainingMinutes: remaining,
    progress,
    watched: item.UserData?.Played === true,
    current: item.Id === currentId,
  };
}

/** Un épisode gardé sur l'appareil (lecture locale), tel que le catalogue local le liste. */
export interface LocalEpisodeSource {
  itemId: string;
  title: string | null;
  indexNumber: number | null;
  runtimeTicks: number | null;
  positionTicks: number;
}

/**
 * Un épisode de l'appareil dans la forme de la liste. Vu et avancement viennent
 * de la règle du catalogue local (`watchStateOf`, offline-core), passée telle
 * quelle : une seule règle pour la coche et la jauge.
 */
export function toLocalEpisodeEntry(
  source: LocalEpisodeSource,
  watch: { watched: boolean; percent: number | null },
  currentId: string | undefined,
): EpisodeEntry {
  const runtime = source.runtimeTicks ?? 0;
  const progress = !watch.watched && watch.percent !== null && watch.percent > 0 ? watch.percent : null;
  return {
    id: source.itemId,
    number: source.indexNumber ?? undefined,
    title: source.title ?? "",
    minutes: runtime > 0 ? wholeMinutes(runtime) : undefined,
    remainingMinutes: progress !== null && runtime > 0
      ? Math.max(1, Math.ceil((runtime - source.positionTicks) / TICKS_PER_MINUTE))
      : undefined,
    progress,
    watched: watch.watched,
    current: source.itemId === currentId,
  };
}

/** Une saison Jellyfin : vue seulement si elle compte des épisodes (une saison vide n'est pas « vue »). */
export function toSeasonEntry(season: MediaItem, currentSeasonId: string | undefined): SeasonEntry {
  const count = season.RecursiveItemCount ?? season.ChildCount;
  return {
    id: season.Id,
    label: season.Name ?? "",
    count: count ?? undefined,
    watched: season.UserData?.Played === true && count !== 0,
    current: season.Id === currentSeasonId,
  };
}

/** Le rang de l'épisode en lecture, `-1` s'il n'est pas dans la saison montrée. */
export function currentEpisodeIndex(entries: readonly EpisodeEntry[]): number {
  return entries.findIndex((entry) => entry.current);
}

/**
 * Le rang où la liste s'ouvre : l'épisode en lecture, sinon le premier épisode
 * entamé, sinon le premier non vu — jamais le bout d'une saison déjà vue.
 */
export function openingEpisodeIndex(entries: readonly EpisodeEntry[]): number {
  const current = currentEpisodeIndex(entries);
  if (current >= 0) return current;
  const started = entries.findIndex((entry) => entry.progress !== null);
  if (started >= 0) return started;
  const unwatched = entries.findIndex((entry) => !entry.watched);
  return unwatched >= 0 ? unwatched : 0;
}
