import type { MediaItem } from "../types/media";

/** Logo résolu : l'item qui le porte, et son tag — toujours connu. */
export interface ResolvedLogoImage {
  id: string;
  tag: string;
}

/**
 * Le logo d'une œuvre, s'il est ANNONCÉ : le sien, sinon celui dont elle hérite
 * — la série (ou la saison) pour un épisode, `ParentLogoItemId`.
 *
 * `null` = rien d'annoncé : on écrit le titre, sans rien demander. Un logo
 * demandé à l'aveugle (le `SeriesId` d'un épisode) répond 404 pour toute série
 * qui n'en a pas, et le navigateur peint alors l'image cassée et son texte de
 * remplacement à la place du titre.
 *
 * Jellyfin n'annonce un logo, propre ou hérité, que si la requête les demande
 * (`EnableImageTypes` avec `Logo`, ou sans `EnableImageTypes` du tout) : sur une
 * réponse qui les a exclus, l'absence d'annonce ne prouve rien, mais on ne
 * demande pas pour autant.
 */
export function resolveLogoImage(item: MediaItem): ResolvedLogoImage | null {
  const own = item.ImageTags?.Logo;
  if (own) return { id: item.Id, tag: own };
  if (item.ParentLogoItemId && item.ParentLogoImageTag) {
    return { id: item.ParentLogoItemId, tag: item.ParentLogoImageTag };
  }
  return null;
}
