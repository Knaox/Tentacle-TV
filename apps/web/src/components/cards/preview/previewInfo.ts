import {
  formatDuration,
  formatEpisodeCode,
  qualityBadgesOf,
  type MediaItem,
  type QualityBadge,
} from "@tentacle-tv/shared";

/**
 * Ce que le BANDEAU de la mini-carte dit du titre, sous ses actions — règle
 * pure, lue sur l'item de la carte, sinon sur sa FICHE (`["item", id]`, que
 * `usePreviewArt` lit déjà pour le logo) : jamais une requête de plus. Rien
 * d'inconnu n'est écrit.
 *
 * Trois lignes au plus sous le titre, toujours dans le même ordre :
 *
 *   1. un ÉPISODE (carte d'un épisode : Reprendre, Prochains épisodes) : son
 *      code et son titre — sinon les FAITS : année, classification, note
 *      globale, durée (ou saisons), qualité — l'ordre de la bannière ;
 *   2. un titre COMMENCÉ : la progression et le temps vu sur la durée — sinon
 *      les faits d'un épisode, ou les GENRES (trois au plus).
 */

/** La part vue d'un titre commencé (film, épisode) — jamais d'une série, dont la part compte des épisodes. */
export interface PreviewProgress {
  /** De 0 à 100, ni 0 ni 100 (un titre fini ou pas commencé n'a pas de progression). */
  percent: number;
  watchedTicks: number;
  totalTicks: number;
}

export interface PreviewFacts {
  year: number | null;
  /** La classification, sans le préfixe du pays (« FR-12 » → « 12 ») ; rien pour un « NR ». */
  rating: string | null;
  /**
   * La note GLOBALE /10 — celle que l'affiche porte au repos et que la
   * mini-carte recouvre : elle passe dans le bandeau.
   */
  community: number | null;
  /** La durée d'un film ou d'un épisode (« 2h 33min »). */
  runtime: string | null;
  /** Le nombre de saisons d'une série. */
  seasons: number | null;
  /** Les badges de qualité (4K, plage, Atmos) — seulement quand l'item porte ses flux. */
  quality: readonly QualityBadge[];
}

export interface PreviewInfo {
  episode: { code: string; title: string | null } | null;
  facts: PreviewFacts;
  genres: readonly string[];
  progress: PreviewProgress | null;
}

const NO_QUALITY: readonly QualityBadge[] = [];
const NO_GENRES: readonly string[] = [];
const MAX_GENRES = 3;
/** « Not Rated », « Unrated » : une absence de classification, pas une classification. */
const UNRATED = /^(?:nr|ur|unrated|not rated)$/i;
/**
 * Le préfixe de PAYS des classifications de Jellyfin (« FR-12 », « DE-16 ») —
 * jamais celui d'un système de classification (« PG-13 », « TV-MA », « NC-17 »).
 */
const COUNTRY_PREFIX = /^(?!PG-|TV-|NC-)[A-Z]{2}-(?=\S)/;

/** La classification telle qu'elle s'écrit dans le bandeau. */
export function previewRatingOf(raw: string | null | undefined): string | null {
  const rating = raw?.trim().replace(COUNTRY_PREFIX, "") ?? "";
  return rating && !UNRATED.test(rating) ? rating : null;
}

/** La progression d'un film ou d'un épisode commencé, lue dans ses données d'utilisateur. */
export function previewProgressOf(item: MediaItem | null): PreviewProgress | null {
  if (!item || (item.Type !== "Movie" && item.Type !== "Episode")) return null;
  const data = item.UserData;
  const total = item.RunTimeTicks ?? 0;
  if (!data || data.Played === true || total <= 0) return null;
  const position = data.PlaybackPositionTicks ?? 0;
  const percent = data.PlayedPercentage ?? (position > 0 ? (position / total) * 100 : 0);
  if (!(percent > 0 && percent < 100)) return null;
  return { percent, watchedTicks: position > 0 ? position : (total * percent) / 100, totalTicks: total };
}

/** La première valeur annoncée : celle de la carte, sinon celle de la fiche. */
function first<T>(card: MediaItem | null, detail: MediaItem | null, read: (item: MediaItem) => T | null | undefined): T | null {
  return (card ? read(card) : null) ?? (detail ? read(detail) : null) ?? null;
}

/**
 * Le bandeau d'un titre : `card` est l'item de la carte (l'épisode d'une
 * vignette, le film ou la série d'une affiche), `detail` sa fiche quand elle
 * est là. Sans item ni fiche (titre hors bibliothèque), l'année donnée par la
 * carte seulement (`fallbackYear`).
 */
export function previewInfoOf(card: MediaItem | null, detail: MediaItem | null, fallbackYear: number | null = null): PreviewInfo {
  // La fiche n'est celle de la carte que si elle porte son identifiant.
  const fiche = detail && (!card || detail.Id === card.Id) ? detail : null;
  const subject = card ?? fiche;
  const isEpisode = subject?.Type === "Episode";
  const isSeries = subject?.Type === "Series";
  const genres = first(card, fiche, (item) => (item.Genres?.length ? item.Genres : null)) ?? NO_GENRES;
  return {
    episode: isEpisode && subject
      ? {
          code: formatEpisodeCode(subject.ParentIndexNumber, subject.IndexNumber, { style: "padded" }),
          title: subject.Name?.trim() || null,
        }
      : null,
    facts: {
      year: first(card, fiche, (item) => item.ProductionYear) ?? fallbackYear,
      rating: first(card, fiche, (item) => previewRatingOf(item.OfficialRating)),
      community: first(card, fiche, (item) => (item.CommunityRating && item.CommunityRating > 0 ? item.CommunityRating : null)),
      runtime: isSeries ? null : first(card, fiche, (item) => formatDuration(item.RunTimeTicks)),
      seasons: isSeries ? first(card, fiche, (item) => (item.ChildCount && item.ChildCount > 0 ? item.ChildCount : null)) : null,
      quality: first(card, fiche, (item) => qualityBadgesOf(item) ?? null) ?? NO_QUALITY,
    },
    genres: genres.length > MAX_GENRES ? genres.slice(0, MAX_GENRES) : genres,
    progress: previewProgressOf(card) ?? (card ? null : previewProgressOf(fiche)),
  };
}

/** Le bandeau dit-il quelque chose de la ligne des faits ? */
export function previewFactsEmpty(facts: PreviewFacts): boolean {
  return facts.year === null && facts.rating === null && facts.community === null && facts.runtime === null
    && facts.seasons === null && facts.quality.length === 0;
}
