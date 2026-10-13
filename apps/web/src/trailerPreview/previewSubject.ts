import {
  trailerPreviewSubjectOfItem,
  trailerPreviewSubjectOfTitle,
  type MediaItem,
  type TrailerPreviewMediaType,
  type TrailerPreviewSubject,
} from "@tentacle-tv/shared";

/**
 * Le sujet de l'aperçu d'une carte de la bibliothèque : un film, une série —
 * un épisode ou une saison valent leur SÉRIE. `null` : pas d'aperçu
 * (collection, musique). Le visage d'un titre hors bibliothèque
 * (`externalMarkerFace`, `ext:movie:603`) vaut son identité TMDB.
 */
export function previewSubjectOf(
  item: Pick<MediaItem, "Id" | "Type" | "SeriesId" | "ParentId"> | null | undefined,
): TrailerPreviewSubject | null {
  return trailerPreviewSubjectOfItem(item);
}

/** Le sujet de l'aperçu d'un titre hors bibliothèque (cartes de Vigie, recherche, saga) — `null` sans identité TMDB. */
export function previewSubjectOfTitle(
  title: { mediaType: TrailerPreviewMediaType; tmdbId: number } | null | undefined,
): TrailerPreviewSubject | null {
  return trailerPreviewSubjectOfTitle(title);
}
