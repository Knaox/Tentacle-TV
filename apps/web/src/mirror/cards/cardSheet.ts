import type { RecoReason } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Ce qu'ouvre l'appui long d'une carte de la bibliothèque : la carte
 * appuyée, sous la variante de son survol (`resolveCardOverlay`).
 */
export interface MediaSheetTarget {
  kind: "media";
  /** `poster` : le toucher de la carte ouvre la fiche ; `landscape` : il lance la lecture. */
  variant: "poster" | "landscape";
  /** L'item de la carte : rendu tout de suite, puis relu en entier (`useMediaItem`). */
  item: MediaItem;
  /** Une recommandation déjà en bibliothèque garde ses raisons sous le bandeau. */
  reasons?: readonly RecoReason[];
}

export type CardSheetTarget = MediaSheetTarget;

/** Le titre de la feuille, pour les lecteurs d'écran. */
export function cardSheetTitle(target: CardSheetTarget): string {
  return target.item.Name;
}
