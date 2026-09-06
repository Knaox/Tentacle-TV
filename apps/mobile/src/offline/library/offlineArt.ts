/**
 * Les visuels du snapshot local, par ordre de préférence, et leur résolution
 * synchrone — une seule liste par usage, au lieu d'une copie par écran.
 */

import { localExists, metaUri } from "../engineApi";

/** Un film : sa propre affiche, sinon celle de sa « série » (collection). */
export const MOVIE_ART = ["primary.jpg", "series-primary.jpg"] as const;
/** Une série : l'affiche de la série, sinon la vignette de l'épisode porteur. */
export const SERIES_ART = ["series-primary.jpg", "primary.jpg"] as const;
/** La vignette d'un épisode, puis la bannière de la série comme repli. */
export const EPISODE_ART = ["primary.jpg", "backdrop.jpg"] as const;
/** La bannière d'une série, sinon son affiche. */
export const BANNER_ART = ["backdrop.jpg", "series-primary.jpg"] as const;
/** La bannière d'un titre, sinon sa vignette (un épisode n'a souvent que la seconde). */
export const ITEM_BANNER_ART = ["backdrop.jpg", "primary.jpg"] as const;

/** URI `file://` du premier candidat présent sur le disque, sinon `null`. */
export function resolveLocalArt(itemId: string, candidates: readonly string[]): string | null {
  for (const name of candidates) {
    const uri = metaUri(itemId, name);
    if (localExists(uri)) return uri;
  }
  return null;
}
