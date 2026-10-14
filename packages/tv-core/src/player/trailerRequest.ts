/**
 * Ce que la bande-annonce DEMANDE au moteur, et la qualité au lancement : les
 * règles vivent dans `@tentacle-tv/shared` (`trailers/player/trailerChoices.ts`),
 * communes à tous les lecteurs. Réexportées ici pour les téléviseurs.
 */

export { trailerEngineRequest, trailerInitialQuality } from "@tentacle-tv/shared";
export type { TrailerEngineRequest } from "@tentacle-tv/shared";
