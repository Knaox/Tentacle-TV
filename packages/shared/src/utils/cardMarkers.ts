import type { MediaItem } from "../types/media";

/**
 * Les marqueurs d'une carte média — le modèle UNIQUE que toutes les
 * plateformes rendent (web et bureau, mobile, tvOS / Android TV, webOS).
 *
 * Façon Crunchyroll : une carte dit d'un coup d'œil ce que l'utilisateur en a
 * déjà fait, sans qu'on la survole. Quatre informations, deux emplacements :
 *
 *   • la NOTE, en bas à gauche — la note globale (/10) et, quand l'utilisateur
 *     a noté le titre, SA note, dans la même pastille ;
 *   • les ÉTATS, en haut à droite — dans ma liste, favori, déjà vu — dans une
 *     seule pastille, jamais trois badges épars.
 *
 * Ce module ne décide que du FOND : quoi afficher, dans quel ordre, et avec
 * quel libellé accessible. La forme appartient à chaque plateforme. Deux
 * rendus qui liraient `UserData` chacun de leur côté finiraient par diverger —
 * c'est déjà arrivé aux coches « vu », recopiées trois fois.
 */

/** Un état binaire affiché dans la pastille d'états. */
export type CardStatusKind = "watchlist" | "favorite" | "watched";

/**
 * Ordre d'affichage, de gauche à droite. Le signet d'abord, comme sur
 * Crunchyroll : c'est l'intention (« je veux le voir ») ; le cœur ensuite ;
 * la coche « vu » en dernier, au plus près de l'angle — c'est elle que l'œil
 * cherche d'abord dans une rangée déjà regardée.
 */
export const CARD_STATUS_ORDER: readonly CardStatusKind[] = ["watchlist", "favorite", "watched"];

export interface CardMarkerInput {
  item: MediaItem;
  /** Note globale /10, telle que la rend `cardRatingFor` (null = aucune). */
  communityRating: number | null;
  /** Note de l'utilisateur, 1..10 (1 = une demi-étoile), null s'il n'a pas noté. */
  userScore?: number | null;
  /**
   * Appartenance à Ma liste lue au niveau SÉRIE (Set `watchlist-series-ids`).
   * `undefined` = la carte répond d'elle-même (film) : on lit `UserData.Likes`.
   */
  inWatchlist?: boolean;
  /** Idem pour les favoris (Set `favorite-series-ids`, sinon `UserData.IsFavorite`). */
  isFavorite?: boolean;
}

export interface CardMarkers {
  communityRating: number | null;
  userScore: number | null;
  /** États vrais, dans l'ordre d'affichage. Vide = pas de pastille. */
  statuses: CardStatusKind[];
}

function positive(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** La note utilisateur n'a de sens qu'entre 1 et 10 — tout le reste est ignoré. */
function validScore(score: number | null | undefined): number | null {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  const rounded = Math.round(score);
  return rounded >= 1 && rounded <= 10 ? rounded : null;
}

/**
 * Les marqueurs d'une carte.
 *
 * « Vu » se lit sur `UserData.Played` et rien d'autre : un titre entamé porte
 * sa barre de progression, pas de coche. Pour une série, Jellyfin ne pose
 * `Played` qu'une fois TOUS les épisodes vus — c'est exactement le sens voulu.
 */
export function resolveCardMarkers(input: CardMarkerInput): CardMarkers {
  const { item } = input;
  const data = item.UserData;
  const flags: Record<CardStatusKind, boolean> = {
    watchlist: input.inWatchlist ?? data?.Likes === true,
    favorite: input.isFavorite ?? data?.IsFavorite === true,
    watched: data?.Played === true,
  };
  return {
    communityRating: positive(input.communityRating),
    userScore: validScore(input.userScore),
    statuses: CARD_STATUS_ORDER.filter((kind) => flags[kind]),
  };
}

/** Vrai quand la carte n'a rien à afficher — aucun rendu, aucun calque. */
export function isEmptyCardMarkers(markers: CardMarkers): boolean {
  return markers.communityRating === null && markers.userScore === null && markers.statuses.length === 0;
}

/** « 8.2 » — une décimale, point décimal (le format de toutes les cartes). */
export function formatCommunityRating(rating: number): string {
  return rating.toFixed(1);
}

/**
 * La note utilisateur telle qu'elle s'affiche sur une carte : sur 10, comme la
 * note globale, pour qu'on les compare sans calcul. La saisie se fait en demi-
 * étoiles (1..10) ; « 7 » vaut trois étoiles et demie.
 */
export function formatUserScore(score: number): string {
  return String(score);
}

/** Clé i18n (espace `cards`) et paramètres d'un morceau du libellé accessible. */
export interface CardMarkerLabelPart {
  key: string;
  params?: Record<string, string>;
}

/**
 * Le libellé lu par un lecteur d'écran, morceau par morceau, dans l'ordre
 * visuel. Chaque plateforme traduit puis joint par « , » : un seul texte pour
 * la pastille d'états, plutôt que trois icônes muettes.
 */
export function cardMarkerLabelParts(markers: CardMarkers): CardMarkerLabelPart[] {
  const parts: CardMarkerLabelPart[] = [];
  if (markers.communityRating !== null) {
    parts.push({ key: "communityRating", params: { score: formatCommunityRating(markers.communityRating) } });
  }
  if (markers.userScore !== null) {
    parts.push({ key: "userRating", params: { score: formatUserScore(markers.userScore) } });
  }
  for (const kind of markers.statuses) parts.push({ key: `status.${kind}` });
  return parts;
}
