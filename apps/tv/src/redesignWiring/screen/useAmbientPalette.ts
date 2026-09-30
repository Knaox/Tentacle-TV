import { useCallback, useEffect, useState } from "react";
import type { CardModel } from "../../redesign/cards/cardTypes";
import type { ArtworkPalette } from "../../redesign/color/artworkPalette";
import type { FocusStore } from "../focus/focusStore";

/**
 * La lumière du fond d'un écran à rangées : celle de la carte qui a le focus ;
 * rendue à celle du héros dès qu'un de ses boutons le reprend. La palette
 * d'une carte vient d'un cache par empreinte (`cardArtwork.ts`) : la même
 * œuvre redonne le même objet, et le fond ne se redessine pas pour rien.
 */
export function useAmbientPalette(focus: FocusStore): {
  focusedPalette: ArtworkPalette | null;
  onFocusCard: (rowKey: string, card: CardModel) => void;
} {
  const [focusedPalette, setFocusedPalette] = useState<ArtworkPalette | null>(null);
  useEffect(
    () =>
      focus.subscribe((key, focused) => {
        if (focused && key.startsWith("hero:")) setFocusedPalette(null);
      }),
    [focus],
  );
  const onFocusCard = useCallback((_rowKey: string, card: CardModel) => {
    if (card.palette) setFocusedPalette(card.palette);
  }, []);
  return { focusedPalette, onFocusCard };
}
