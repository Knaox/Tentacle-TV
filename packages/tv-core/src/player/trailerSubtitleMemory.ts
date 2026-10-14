/**
 * Le sous-titre RETENU d'une bande-annonce à la suivante : la règle vit dans
 * `@tentacle-tv/shared` (`trailers/player/trailerSubtitleMemory.ts`), commune
 * à tous les lecteurs. Les téléviseurs n'imposent jamais de sous-titres sans
 * choix retenu (`trailerRememberedSubtitle`) ; le web et le bureau partent
 * sur la langue du serveur (`trailerStartSubtitle`, non réexporté ici).
 */

export {
  TRAILER_SUBTITLE_KEY_PREFIX, trailerRememberedSubtitle, trailerSubtitleKey, trailerSubtitleMemoryOf,
} from "@tentacle-tv/shared";
