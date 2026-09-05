import type { RecoRowItem } from "../hooks/recoTypes";

// Tailles TMDB demandées AU PLUS PRÈS de l'affichage réel (contrainte perf) :
// w342 couvre une affiche de rangée web jusqu'en Retina, w500 une carte de
// téléviseur à densité 2 ; w92 est la source volontairement dérisoire du halo
// (même philosophie que HeroAmbilight : l'image est floutée ensuite, tout
// détail supplémentaire serait payé pour rien).
const TMDB_IMG = "https://image.tmdb.org/t/p";

export type TmdbPosterSize = "w92" | "w154" | "w185" | "w342" | "w500" | "w780";
export type TmdbBackdropSize = "w300" | "w780" | "w1280";

/** L'affiche d'un item de reco : Jellyfin quand il est en bibliothèque
 *  (métadonnées locales, pas de fuite d'usage vers TMDB), TMDB sinon. */
export function recoPosterUrl(
  item: Pick<RecoRowItem, "jellyfinItemId" | "posterPath">,
  jellyfinImage: (itemId: string) => string,
  size: TmdbPosterSize = "w342"
): string | null {
  if (item.jellyfinItemId) return jellyfinImage(item.jellyfinItemId);
  if (item.posterPath) return `${TMDB_IMG}/${size}${item.posterPath}`;
  return null;
}

/** Source minuscule du halo (~4 Ko) — jamais l'affiche pleine taille. */
export function recoHaloSourceUrl(
  item: Pick<RecoRowItem, "jellyfinItemId" | "posterPath">,
  jellyfinTinyImage: (itemId: string) => string
): string | null {
  if (item.jellyfinItemId) return jellyfinTinyImage(item.jellyfinItemId);
  if (item.posterPath) return `${TMDB_IMG}/w92${item.posterPath}`;
  return null;
}

/** Visuel large d'une diapositive héros : TMDB `w1280` (jamais `original` —
 *  contrainte perf) sinon le backdrop Jellyfin. TMDB d'abord même en
 *  bibliothèque : c'est lui qui est garanti par la sélection des diapositives. */
export function recoBackdropUrl(
  item: Pick<RecoRowItem, "jellyfinItemId" | "backdropPath">,
  jellyfinBackdrop: (itemId: string) => string,
  size: TmdbBackdropSize = "w1280"
): string | null {
  if (item.backdropPath) return `${TMDB_IMG}/${size}${item.backdropPath}`;
  if (item.jellyfinItemId) return jellyfinBackdrop(item.jellyfinItemId);
  return null;
}

/** Source dérisoire du halo du carrousel — même image que le backdrop affiché
 *  (les couleurs suivent), en `w300` (plus petite taille backdrop de TMDB). */
export function recoAmbilightSourceUrl(
  item: Pick<RecoRowItem, "jellyfinItemId" | "backdropPath">,
  jellyfinTinyBackdrop: (itemId: string) => string
): string | null {
  if (item.backdropPath) return `${TMDB_IMG}/w300${item.backdropPath}`;
  if (item.jellyfinItemId) return jellyfinTinyBackdrop(item.jellyfinItemId);
  return null;
}
