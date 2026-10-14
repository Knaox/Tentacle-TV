/**
 * Le flux d'une bande-annonce (`GET /api/trailers/resolve`) : la règle vit
 * dans `@tentacle-tv/shared` (`trailers/player/trailerStream.ts`), commune
 * aux téléviseurs, au web et au bureau. Réexportée ici pour les téléviseurs.
 */

export { parseTrailerResolve, trailerQualityUrl, trailerSubtitleUrl } from "@tentacle-tv/shared";
export type { TrailerQualityTrack, TrailerStream, TrailerSubtitleTrack, TrailerTracks } from "@tentacle-tv/shared";
