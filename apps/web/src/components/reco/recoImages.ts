import type { RecoRowItem } from "@tentacle-tv/api-client";

// Tailles TMDB demandées AU PLUS PRÈS de l'affichage réel (contrainte perf) :
// w342 couvre une affiche de rangée jusqu'en Retina ; w92 est la source
// volontairement dérisoire du halo (même philosophie que HeroAmbilight :
// l'image est floutée ensuite, tout détail supplémentaire serait payé pour rien).
const TMDB_IMG = "https://image.tmdb.org/t/p";

/** L'affiche d'un item de reco : Jellyfin quand il est en bibliothèque
 *  (métadonnées locales, pas de fuite d'usage vers TMDB), TMDB sinon. */
export function recoPosterUrl(
  item: Pick<RecoRowItem, "jellyfinItemId" | "posterPath">,
  jellyfinImage: (itemId: string) => string
): string | null {
  if (item.jellyfinItemId) return jellyfinImage(item.jellyfinItemId);
  if (item.posterPath) return `${TMDB_IMG}/w342${item.posterPath}`;
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
  jellyfinBackdrop: (itemId: string) => string
): string | null {
  if (item.backdropPath) return `${TMDB_IMG}/w1280${item.backdropPath}`;
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
