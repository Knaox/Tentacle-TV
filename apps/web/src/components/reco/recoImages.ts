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
