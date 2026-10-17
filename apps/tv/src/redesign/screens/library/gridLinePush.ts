import { useMemo } from "react";
import { useAnimatedStyle, useReducedMotion, useSharedValue, type SharedValue } from "react-native-reanimated";
import { motionTo } from "../../motion/motion";

/**
 * Les lignes du DESSOUS glissent quand une ligne de grille grandit (tv-core
 * `cards/trailerPreviewGrid.ts`) : la cellule devenue grande carte gagne en
 * hauteur (l'image, puis la place de son pied), mais la liste recyclée ne doit
 * rien relayer — la ligne garde sa hauteur de repos, ce qu'elle gagne déborde
 * vers le bas, et les lignes suivantes descendent d'autant, sur le MÊME
 * ressort que la grande carte (`unfold`). Une seule ligne grandit à la fois.
 *
 * Tout se lit sur le fil d'interface : une grande carte qui s'ouvre ne
 * redessine aucune ligne.
 */
export interface GridLinePush {
  /** La ligne qui grandit, -1 : aucune. */
  line: SharedValue<number>;
  /** Ce qu'elle gagne en hauteur, au bout de sa croissance. */
  amount: SharedValue<number>;
  /** La croissance (0 → 1). */
  progress: SharedValue<number>;
  expand(line: number, grow: number): void;
  collapse(line: number): void;
}

export function useGridLinePush(): GridLinePush {
  const reduced = useReducedMotion();
  const line = useSharedValue(-1);
  const amount = useSharedValue(0);
  const progress = useSharedValue(0);
  return useMemo<GridLinePush>(
    () => ({
      line,
      amount,
      progress,
      expand(at, grow) {
        line.value = at;
        amount.value = grow;
        progress.value = motionTo(1, "unfold", reduced);
      },
      collapse(at) {
        if (line.value !== at) return;
        progress.value = motionTo(0, "unfold", reduced);
      },
    }),
    [line, amount, progress, reduced],
  );
}

/** Le glissement de la ligne `index` : elle descend si une ligne au-dessus d'elle grandit. */
export function useGridLineDrop(push: GridLinePush, index: number) {
  const { line, amount, progress } = push;
  return useAnimatedStyle(() => {
    const grown = line.value;
    return { transform: [{ translateY: grown >= 0 && index > grown ? amount.value * progress.value : 0 }] };
  });
}
