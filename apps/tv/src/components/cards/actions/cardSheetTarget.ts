import type { RecoRowItem } from "@tentacle-tv/api-client";
import type { CardOverlayVariant, MediaItem } from "@tentacle-tv/shared";

/**
 * Ce que vise l'appui long : une carte Jellyfin — affiche 2:3 ou vignette
 * 16:9, la variante du modèle partagé (`cardOverlay.ts`) —, ou une
 * recommandation. Le téléviseur ne montre que les recommandations EN
 * bibliothèque, mais la feuille ne le suppose pas.
 */
export type CardSheetTarget =
  | { kind: "media"; item: MediaItem; variant: "poster" | "landscape" }
  | { kind: "reco"; item: RecoRowItem };

export function sheetVariant(target: CardSheetTarget): CardOverlayVariant {
  return target.kind === "reco" ? "reco" : target.variant;
}

/** L'item Jellyfin de la carte — `null` : recommandation hors bibliothèque. */
export function sheetLibraryId(target: CardSheetTarget): string | null {
  return target.kind === "reco" ? target.item.jellyfinItemId : target.item.Id;
}
