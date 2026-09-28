import type { MediaItem } from "../types/media";
import type { NextEpisodeResult } from "../watchState";

/**
 * Quelle saison afficher à l'ouverture d'une liste d'épisodes, et laquelle
 * marquer comme « en cours » — la même règle sur toutes les plateformes.
 *
 * Le défaut qu'elle corrige : la saison se choisissait UNE fois, dès l'arrivée
 * des saisons. L'état de visionnage, qui lit toute la série, arrive après sur
 * une longue série ; la liste restait alors sur la première saison du serveur
 * — souvent « Spéciaux » — au lieu de celle qu'on regarde. Tant que l'état est
 * attendu, la réponse est donc « rien encore » (`seasonId` indéfini), jamais
 * une saison provisoire qui sauterait ensuite sous les yeux.
 *
 * `provisionalSeasonId` sert à gagner ce temps d'attente sans rien afficher :
 * la première vraie saison qui reste à voir, d'après les compteurs que
 * Jellyfin sert avec les saisons. C'est presque toujours la bonne — on peut
 * précharger ses épisodes pendant que l'état de visionnage arrive.
 */

type SeasonLike = Pick<MediaItem, "Id" | "IndexNumber" | "UserData">;

export interface SeasonSelectionInput {
  seasons: readonly SeasonLike[] | undefined;
  /** Saison imposée par l'appelant : celle de l'épisode ouvert, ou du lecteur. */
  preferredSeasonId?: string;
  /** L'état de visionnage de la série, quand la liste le suit (fiche série). */
  watchState?: NextEpisodeResult;
  /** L'état de visionnage est attendu et pas encore arrivé. */
  watchPending?: boolean;
}

export interface SeasonSelection {
  /** La saison à afficher — indéfinie tant qu'on attend l'état de visionnage. */
  seasonId: string | undefined;
  /** La saison de l'épisode à reprendre ou à commencer : sa pastille est marquée. */
  currentSeasonId: string | undefined;
  /** Le meilleur pari pendant l'attente, à précharger (jamais à afficher). */
  provisionalSeasonId: string | undefined;
}

/** Les spéciaux (saison 0) ne sont pas un début de série. */
const isRegular = (season: SeasonLike) => (season.IndexNumber ?? 0) > 0;

export function resolveSeasonSelection(input: SeasonSelectionInput): SeasonSelection {
  const { seasons, preferredSeasonId, watchState, watchPending } = input;
  if (!seasons || seasons.length === 0) {
    return { seasonId: undefined, currentSeasonId: undefined, provisionalSeasonId: undefined };
  }
  const known = (id: string | undefined): id is string => !!id && seasons.some((s) => s.Id === id);

  const resumeSeasonId = watchState && watchState.type !== "completed" ? watchState.episode.SeasonId : undefined;
  const currentSeasonId = known(resumeSeasonId) ? resumeSeasonId : undefined;
  const firstRegular = seasons.find(isRegular) ?? seasons[0];
  const firstUnwatched = seasons.find((s) => isRegular(s) && s.UserData?.Played !== true);
  const provisionalSeasonId = (firstUnwatched ?? firstRegular).Id;

  if (known(preferredSeasonId)) return { seasonId: preferredSeasonId, currentSeasonId, provisionalSeasonId };
  if (watchPending) return { seasonId: undefined, currentSeasonId, provisionalSeasonId };
  if (currentSeasonId) return { seasonId: currentSeasonId, currentSeasonId, provisionalSeasonId };
  // Série terminée, jamais ouverte ou état indisponible : la première VRAIE saison.
  return { seasonId: firstRegular.Id, currentSeasonId, provisionalSeasonId };
}

/**
 * Les saisons voisines d'une saison, dans l'ordre du serveur : ce qu'on
 * précharge pour qu'un changement de saison soit immédiat. La suivante
 * d'abord — c'est le sens où l'on avance dans une série.
 */
export function adjacentSeasonIds(seasons: readonly Pick<MediaItem, "Id">[] | undefined, seasonId: string | undefined): string[] {
  if (!seasons || !seasonId) return [];
  const index = seasons.findIndex((s) => s.Id === seasonId);
  if (index < 0) return [];
  return [seasons[index + 1]?.Id, seasons[index - 1]?.Id].filter((id): id is string => !!id);
}
