import type { TFunction } from "i18next";
import { parseTitleKey, trailerPreviewSubjectOfTitle, type TrailerPreviewSubject } from "@tentacle-tv/shared";
import { EMPTY_MARKERS, type AbsentModel, type CardModel } from "../../redesign/cards/cardTypes";

/**
 * La carte d'un titre ABSENT de la bibliothèque (Apple TV) : son affiche TMDB,
 * grisée par la vue (`AbsentArtwork`), son année en légende, et son badge —
 * « Pas dans la bibliothèque », ou l'état de sa demande quand le serveur sait
 * en faire. Ni marqueurs ni progression : rien de lui n'est dans Jellyfin.
 * Sa bande-annonce, elle, se montre au focus comme celle de tout titre
 * (`trailer`, par son identité TMDB : le serveur la trouve hors bibliothèque).
 */

const TMDB_IMAGES = "https://image.tmdb.org/t/p/";
/** Une affiche de 240 pt, dessinée à un pixel par point (`GreyscaleImage`). */
const POSTER_SIZE = "w342";

/** L'affiche TMDB d'un chemin (« /abc.jpg »). */
export function tmdbPosterUri(path: string | null | undefined): string | undefined {
  return path ? `${TMDB_IMAGES}${POSTER_SIZE}${path}` : undefined;
}

/** Une adresse d'image TMDB d'une autre taille (une extension en donne de
 *  petites) ramenée à celle d'une affiche de téléviseur ; toute autre adresse
 *  reste telle quelle. */
export function tvPosterUri(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith(TMDB_IMAGES) ? url.replace(/\/t\/p\/w\d+\//, `/t/p/${POSTER_SIZE}/`) : url;
}

/** Le sujet de l'aperçu d'un titre absent, par sa clé TMDB (`movie:603`) — `null` si elle est illisible. */
export function absentTrailerOf(key: string): TrailerPreviewSubject | undefined {
  return trailerPreviewSubjectOfTitle(parseTitleKey(key)) ?? undefined;
}

/** Le badge sans demande possible : le titre n'est pas là, c'est tout. */
export function notInLibrary(t: TFunction): AbsentModel {
  return { label: t("cards:notInLibrary"), tone: "neutral" };
}

export function absentCard(input: {
  id: string;
  title: string;
  year?: number | null;
  posterUri?: string;
  absent: AbsentModel;
  /** La bande-annonce de l'aperçu au focus (`absentTrailerOf`). */
  trailer?: TrailerPreviewSubject;
}): CardModel {
  return {
    id: input.id,
    title: input.title,
    subtitle: input.year ? String(input.year) : undefined,
    posterUri: input.posterUri,
    markers: EMPTY_MARKERS,
    absent: input.absent,
    trailer: input.trailer,
  };
}
