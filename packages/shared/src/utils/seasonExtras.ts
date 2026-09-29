import type { MediaItem } from "../types/media";

type SeasonExtrasCounts = Pick<MediaItem, "SpecialFeatureCount" | "LocalTrailerCount" | "RemoteTrailers">;

/**
 * Une saison a-t-elle de quoi remplir une rangée d'extras ?
 *
 * La liste des saisons sert déjà leurs compteurs (`SpecialFeatureCount`,
 * `LocalTrailerCount`) et leurs bandes-annonces distantes (`RemoteTrailers`)
 * — le même `DtoService` côté Jellyfin, de 10.10 à 12.1, que la fiche d'une
 * saison seule. Interroger chaque saison coûtait une à deux requêtes par
 * saison à l'ouverture d'une fiche de série (quarante-six sur une série de
 * vingt-trois saisons), pour des rangées presque toujours vides. Un serveur
 * qui ne renverrait pas le compteur des bonus garde l'ancienne conduite : on
 * demande.
 *
 * Une saison qui n'a QU'UNE bande-annonce locale (`Season 02/trailers/…`)
 * passait à travers : ni bonus, ni bande-annonce distante, rangée jamais
 * montrée, bande-annonce introuvable sur toutes les plateformes.
 */
export function seasonHasExtras(season: SeasonExtrasCounts): boolean {
  return (
    season.SpecialFeatureCount === undefined ||
    season.SpecialFeatureCount > 0 ||
    (season.LocalTrailerCount ?? 0) > 0 ||
    (season.RemoteTrailers?.length ?? 0) > 0
  );
}

/**
 * Quelles listes d'extras LOCAUX demander pour un titre, d'après les compteurs
 * que sa fiche (ou la liste des saisons) sert déjà : aucune requête pour une
 * liste que le compteur dit vide. Sans compteur (serveur qui ne le sert pas,
 * titre pas encore chargé en entier), on demande.
 */
export function localExtrasToFetch(item: Pick<MediaItem, "SpecialFeatureCount" | "LocalTrailerCount"> | undefined): {
  trailers: boolean;
  features: boolean;
} {
  if (!item) return { trailers: false, features: false };
  return {
    trailers: item.LocalTrailerCount === undefined || item.LocalTrailerCount > 0,
    features: item.SpecialFeatureCount === undefined || item.SpecialFeatureCount > 0,
  };
}
