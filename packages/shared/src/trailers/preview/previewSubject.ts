import type { MediaItem } from "../../types/media";
import { trailerPreviewPath, type TrailerPreviewMediaType } from "../trailerPreview";

/**
 * DE QUOI une carte montrerait la bande-annonce — ce que le client demande au
 * serveur (`GET /api/trailers/preview`, contrat `trailerPreview.ts`), qui
 * choisit et vérifie la vidéo :
 *
 *   - `item` : un titre de la bibliothèque (son identifiant Jellyfin) ;
 *   - `tmdb` : un titre hors bibliothèque (cartes de Vigie, recherche,
 *     filmographie, saga), connu par son identité TMDB.
 *
 * Un épisode ou une saison se demande PAR LUI-MÊME : le serveur suit son
 * catalogue (sa saison d'abord, puis le repli), comme le bouton et les extras
 * de sa fiche — un serveur d'avant le ramène de lui-même à sa série. Une
 * collection, un album ou une piste : rien.
 */
export type TrailerPreviewSubject =
  | { kind: "item"; itemId: string }
  | { kind: "tmdb"; tmdbId: number; mediaType: TrailerPreviewMediaType };

/** Le visage `MediaItem` d'un titre hors bibliothèque (`externalMarkerFace`) : `ext:movie:603`. */
const EXTERNAL_FACE_ID = /^ext:(movie|tv):(\d+)$/;

/**
 * Le sujet de l'aperçu d'une carte de la bibliothèque — `null` quand la carte
 * n'en a pas (collection, musique). Le visage d'un
 * titre hors bibliothèque (`ext:movie:603`) vaut son identité TMDB.
 */
export function trailerPreviewSubjectOfItem(
  item: Pick<MediaItem, "Id" | "Type" | "SeriesId" | "ParentId"> | null | undefined,
): TrailerPreviewSubject | null {
  if (!item?.Id) return null;
  const external = EXTERNAL_FACE_ID.exec(item.Id);
  if (external) {
    return trailerPreviewSubjectOfTitle({ mediaType: external[1] as TrailerPreviewMediaType, tmdbId: Number(external[2]) });
  }
  switch (item.Type) {
    case "Movie":
    case "Series":
    case "Season":
    case "Episode":
      return { kind: "item", itemId: item.Id };
    default:
      return null;
  }
}

/** Le sujet de l'aperçu d'un titre hors bibliothèque — `null` sans identité TMDB valable. */
export function trailerPreviewSubjectOfTitle(
  title: { mediaType: TrailerPreviewMediaType; tmdbId: number } | null | undefined,
): TrailerPreviewSubject | null {
  if (!title) return null;
  if (title.mediaType !== "movie" && title.mediaType !== "tv") return null;
  if (!Number.isSafeInteger(title.tmdbId) || title.tmdbId <= 0) return null;
  return { kind: "tmdb", tmdbId: title.tmdbId, mediaType: title.mediaType };
}

/**
 * La clé stable d'un sujet — celle du cache de la requête, de la mémoire des
 * échecs et de l'arbitre « un seul aperçu à la fois ». Deux cartes du même
 * titre (une rangée, une grille) partagent ainsi la même réponse.
 */
export function trailerPreviewSubjectKey(subject: TrailerPreviewSubject): string {
  return subject.kind === "item" ? `item:${subject.itemId}` : `tmdb:${subject.mediaType}:${subject.tmdbId}`;
}

/**
 * Le chemin de la demande pour ce sujet et la langue de l'interface — `null`
 * pour un sujet que le contrat refuse d'avance (identifiant illisible) : rien
 * à demander, aucune requête. `dailymotion` : le client lit aussi un aperçu
 * Dailymotion (AlloCiné).
 */
export function trailerPreviewSubjectPath(
  subject: TrailerPreviewSubject,
  lang: string | undefined,
  options: { dailymotion?: boolean } = {},
): string | null {
  const extra = options.dailymotion ? { dailymotion: true } : {};
  return subject.kind === "item"
    ? trailerPreviewPath({ itemId: subject.itemId, lang, ...extra })
    : trailerPreviewPath({ tmdbId: subject.tmdbId, mediaType: subject.mediaType, lang, ...extra });
}
