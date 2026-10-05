import { useCallback, useEffect } from "react";
import type { AmbientSource } from "../../redesign/background/ambientSource";
import type { CardModel } from "../../redesign/cards/cardTypes";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";
import { useAmbientStore } from "./ambientStore";

/**
 * La lumière du fond d'un écran à rangées : celle de la carte qui a le focus ;
 * rendue à celle du héros dès qu'un de ses boutons le reprend. La palette
 * d'une carte vient d'un cache par empreinte (`cardArtwork.ts`) : la même
 * œuvre redonne le même objet, et le fond ne se redessine pas pour rien.
 *
 * Tenue HORS du rendu (`ambient`, à passer à la vue) : un pas du focus ne
 * redessine que le fond vivant, plus l'écran câblé et tous ses crochets.
 */
export function useAmbientPalette(focus: FocusStore): {
  ambient: AmbientSource;
  onFocusCard: (rowKey: string, card: CardModel) => void;
} {
  const ambient = useAmbientStore();
  useEffect(
    () =>
      focus.subscribe((key, focused) => {
        if (focused && key.startsWith("hero:")) ambient.set(null);
      }),
    [focus, ambient],
  );
  const onFocusCard = useCallback(
    (_rowKey: string, card: CardModel) => {
      if (card.palette) ambient.set(card.palette);
    },
    [ambient],
  );
  return { ambient, onFocusCard };
}
