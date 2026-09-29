import type { MediaItem } from "../types/media";

/**
 * Une saison a-t-elle de quoi remplir une rangée d'extras ?
 *
 * La liste des saisons sert déjà leurs compteurs (`SpecialFeatureCount`) et
 * leurs bandes-annonces (`RemoteTrailers`) — le même `DtoService` côté
 * Jellyfin 10.11 que la fiche d'une saison seule. Interroger chaque saison
 * coûtait une à deux requêtes par saison à l'ouverture d'une fiche de série
 * (quarante-six sur une série de vingt-trois saisons), pour des rangées
 * presque toujours vides. Un serveur qui ne renverrait pas le compteur garde
 * l'ancienne conduite : on demande.
 */
export function seasonHasExtras(season: Pick<MediaItem, "SpecialFeatureCount" | "RemoteTrailers">): boolean {
  return season.SpecialFeatureCount === undefined || season.SpecialFeatureCount > 0 || (season.RemoteTrailers?.length ?? 0) > 0;
}
