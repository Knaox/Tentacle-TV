import { useRef, useState } from "react";
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from "react-native";

/**
 * « Il y a la suite en dessous » — de quoi le dire à qui ne le devine pas.
 *
 * Une feuille coincée à son premier palier montre un contenu coupé net, sans
 * rien qui l'annonce : ni barre de défilement (masquée partout dans le hors
 * ligne), ni ombre, ni fondu. Ce hook rend l'état à afficher, et l'appelant en
 * fait ce qu'il veut — un fondu de bas, ici.
 */

/** Sous ce reste de course, on est « en bas » : un pixel d'arrondi ne compte pas. */
const END_SLOP = 12;

export interface ScrollOverflow {
  /** Le contenu déborde ET il reste quelque chose sous la zone visible. */
  more: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
  onContentSizeChange: (width: number, height: number) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

export function useScrollOverflow(): ScrollOverflow {
  const sizes = useRef({ view: 0, content: 0, offset: 0 });
  const [more, setMore] = useState(false);

  const settle = (): void => {
    const { view, content, offset } = sizes.current;
    const next = content - view - offset > END_SLOP;
    setMore((prev) => (prev === next ? prev : next));
  };

  return {
    more,
    onLayout: (event) => {
      sizes.current.view = event.nativeEvent.layout.height;
      settle();
    },
    onContentSizeChange: (_width, height) => {
      sizes.current.content = height;
      settle();
    },
    onScroll: (event) => {
      sizes.current.offset = event.nativeEvent.contentOffset.y;
      settle();
    },
  };
}
