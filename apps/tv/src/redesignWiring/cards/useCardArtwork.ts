import { useMemo } from "react";
import { cardArtworkFor, type CardArtworkPixels } from "@tentacle-tv/tv-core";
import { useCardMetrics } from "../../redesign/cards/cardSizeMode";
import { RENDER } from "../../redesign/render/renderProfile";

/**
 * Les pixels des images des cartes à demander, à la taille des cartes
 * réglée : ceux du profil de rendu de l'appareil, agrandis avec la grande
 * taille (tv-core `cardArtworkFor`) — la taille normale et la petite gardent
 * les images d'avant, déjà en cache.
 */
export function useCardArtwork(): CardArtworkPixels {
  const { size } = useCardMetrics();
  return useMemo(() => cardArtworkFor(RENDER.cardArtwork, size), [size]);
}
