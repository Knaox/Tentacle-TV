import type { MediaItem } from "../types/media";
import type { NextEpisodeResult } from "../watchState";

/**
 * Quelle saison afficher à l'ouverture d'une liste d'épisodes, et laquelle
 * marquer comme « en cours » — la même règle sur toutes les plateformes.
 *
 * Le défaut qu'elle corrige : la saison se choisissait UNE fois, dès l'arrivée
 * des saisons. L'état de visionnage, qui lit toute la série, arrive après sur
 * une longue série ; la liste restait alors sur la première saison du serveur
 * — souvent « Spéciaux » — au lieu de celle qu'on regarde.
 *
 * Pendant cette attente (plus d'une seconde sur mille épisodes), la saison
 * PRESSENTIE sert de réponse : le meilleur pari d'après les compteurs que
 * Jellyfin sert avec les saisons, calqué sur la règle de `getNextEpisode` (le
 * successeur de la dernière lecture, pas le premier trou) — la dernière saison
 * entamée, la suivante si elle est finie, la première si tout est vu. C'est la
 * bonne saison dans l'immense majorité des cas ; sinon (on a sauté des saisons,
 * on revoit la série), l'état de visionnage la corrige en arrivant. Avec
 * `provisional: false`, l'attente ne montre rien (téléviseur : une liste qui
 * changerait sous le focus de la télécommande le perdrait).
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
  /** Pendant l'attente, montrer la saison pressentie (vrai par défaut). */
  provisional?: boolean;
}

export interface SeasonSelection {
  /** La saison à afficher — indéfinie pendant l'attente si `provisional` est faux. */
  seasonId: string | undefined;
  /** La saison de l'épisode à reprendre ou à commencer : sa pastille est marquée. */
  currentSeasonId: string | undefined;
  /** Le meilleur pari pendant l'attente — à afficher, ou au moins à précharger. */
  provisionalSeasonId: string | undefined;
}

/** Les spéciaux (saison 0) ne sont pas un début de série. */
const isRegular = (season: SeasonLike) => (season.IndexNumber ?? 0) > 0;

export function resolveSeasonSelection(input: SeasonSelectionInput): SeasonSelection {
  const { seasons, preferredSeasonId, watchState, watchPending, provisional = true } = input;
  if (!seasons || seasons.length === 0) {
    return { seasonId: undefined, currentSeasonId: undefined, provisionalSeasonId: undefined };
  }
  const known = (id: string | undefined): id is string => !!id && seasons.some((s) => s.Id === id);

  const resumeSeasonId = watchState && watchState.type !== "completed" ? watchState.episode.SeasonId : undefined;
  const currentSeasonId = known(resumeSeasonId) ? resumeSeasonId : undefined;
  const firstRegular = seasons.find(isRegular) ?? seasons[0];
  const provisionalSeasonId = guessResumeSeason(seasons, firstRegular) ?? firstRegular.Id;

  if (known(preferredSeasonId)) return { seasonId: preferredSeasonId, currentSeasonId, provisionalSeasonId };
  if (watchPending) return { seasonId: provisional ? provisionalSeasonId : undefined, currentSeasonId, provisionalSeasonId };
  if (currentSeasonId) return { seasonId: currentSeasonId, currentSeasonId, provisionalSeasonId };
  // Série terminée, jamais ouverte ou état indisponible : la première VRAIE saison.
  return { seasonId: firstRegular.Id, currentSeasonId, provisionalSeasonId };
}

/**
 * La dernière saison entamée, ou la suivante si elle est finie — et la
 * première si c'était la dernière (série vue : même réponse que l'état
 * « terminée »). Rien si rien n'a été vu.
 */
function guessResumeSeason(seasons: readonly SeasonLike[], firstRegular: SeasonLike): string | undefined {
  const regular = seasons.filter(isRegular);
  const touched = (s: SeasonLike) => s.UserData?.Played === true || (s.UserData?.PlayedPercentage ?? 0) > 0;
  for (let i = regular.length - 1; i >= 0; i--) {
    if (!touched(regular[i])) continue;
    if (regular[i].UserData?.Played !== true) return regular[i].Id;
    return (regular[i + 1] ?? firstRegular).Id;
  }
  return undefined;
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
