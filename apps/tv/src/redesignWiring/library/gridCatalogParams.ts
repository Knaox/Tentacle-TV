import type { CatalogFilters } from "@tentacle-tv/api-client";
import { catalogParams, hasPlatformFilter, type LibraryFilterState } from "../../hooks/libraryCatalogParams";

/**
 * Le catalogue tel que la GRILLE de la refonte le demande (Apple TV) — la
 * seule fabrique de ses paramètres, lue par l'écran ET par le préchargement
 * de la navigation : une clé de cache différente, et le préchargement ne
 * servirait à rien (cf. `libraryCatalogParams`).
 *
 * Par rapport au modèle commun (`catalogParams`, celui d'Android TV) :
 * - des champs minimaux (`grid`) : la grille ne lit ni les sources (les puces
 *   de qualité des cartes d'Android TV), ni rien d'autre que l'affiche, le
 *   titre, l'année, les marqueurs. Mesuré sur Jellyfin 10.11 : une page de 30
 *   films passe de 229 à 30 Kio, de 130 à 95 ms ;
 * - des pages de 60 titres (dix lignes) : sans les sources, une page coûte
 *   au serveur à peu près le même temps quelle que soit sa taille (~100 ms
 *   de 30 à 120 titres), et chaque frontière de page est une attente de moins
 *   quand on fait défiler vite.
 *
 * Plateformes actives : rien ne change — le post-filtre compare les studios
 * et l'identifiant TMDB de chaque titre, que seuls les champs complets
 * apportent.
 */

/** Une page de la grille : dix lignes de six affiches. */
export const GRID_PAGE_SIZE = 60;

export function gridCatalogParams(filters: LibraryFilterState): CatalogFilters {
  const base = catalogParams(filters);
  return hasPlatformFilter(filters) ? base : { ...base, fields: "grid", limit: GRID_PAGE_SIZE };
}
