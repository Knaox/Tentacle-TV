import { useSyncExternalStore } from "react";
import type { ArtworkPalette } from "../color/artworkPalette";

/**
 * La lumière de ce qui a le FOCUS, tenue hors du rendu de l'écran : une carte
 * qui prend le focus change la lumière du fond, et seul le fond se redessine
 * (`LiveAmbientBackdrop`) — ni l'écran câblé et ses crochets, ni la vue et ses
 * rangées. Avant, la lumière était un état de l'écran : chaque pas du focus
 * redessinait tout l'écran pour changer une couleur.
 *
 * `get()` : la lumière de la carte focalisée, `null` quand rien n'en impose
 * (le fond prend alors celle de la vue — le héros, la première carte).
 */
export interface AmbientSource {
  get(): ArtworkPalette | null;
  subscribe(listener: () => void): () => void;
}

const noSubscription = () => () => {};
const nothing = () => null;

/** La lumière de `source`, sinon `fallback` ; sans source, `fallback`. */
export function useAmbientOf(source: AmbientSource | undefined, fallback: ArtworkPalette): ArtworkPalette {
  const focused = useSyncExternalStore(source?.subscribe ?? noSubscription, source?.get ?? nothing);
  return focused ?? fallback;
}
