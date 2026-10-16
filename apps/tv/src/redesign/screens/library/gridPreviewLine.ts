import { useCallback, useEffect, useMemo, useRef } from "react";
import { makeMutable, useAnimatedStyle, useReducedMotion, useSharedValue, type SharedValue } from "react-native-reanimated";
import { gridTrailerPreviewPlace, gridTrailerPreviewSpread, gridTrailerPreviewWarmWindow } from "@tentacle-tv/tv-core";
import { CARD_FOCUS_SCALE } from "../../cards/cardFocus";
import { PREVIEW_FOCUS_LIFT, type CardGrowthDriver } from "../../cards/CardPreviewTile";
import type { CardModel } from "../../cards/cardTypes";
import { useCardPreviewWarm } from "../../cards/trailerPreviewPort";
import { motionTo } from "../../motion/motion";
import type { GridMotion } from "./gridMotion";

/**
 * L'aperçu au focus dans une LIGNE de grille (Apple TV, Android TV) : la
 * grande carte d'une affiche prend trois colonnes et reste dans la bande de
 * sa ligne (tv-core `gridTrailerPreviewPlace`) ; les autres affiches de la
 * ligne glissent par colonnes entières (`gridTrailerPreviewSpread`), au même
 * rythme qu'elle grandit. Rien ne bouge en hauteur : ni les lignes du
 * dessous, ni la page, ni la liste recyclée (FlashList ne relaie rien).
 *
 * La ligne MÈNE la croissance : une valeur par colonne (celle de la grande
 * carte de chaque affiche), la colonne qui grandit, et où chacune glisse.
 * Chaque affiche lit ces valeurs sur le fil d'interface (`useGridCellPreview`
 * → `CardShell` `glide`) : une grande carte qui s'ouvre ne redessine rien.
 */

/** La légende d'une affiche de grille au repos (`MediaCard`) : 14 de marge, le
 *  titre (24) et l'année (22) à 1,21 em la ligne (Inter), 2 entre les deux. */
const CAPTION_HEIGHT = 72;

export interface GridPreviewLine {
  /** La colonne de l'affiche qui grandit (ou se replie), -1 : aucune. */
  column: SharedValue<number>;
  /** La croissance de la grande carte de chaque colonne (0 → 1). */
  progress: readonly SharedValue<number>[];
  /** De combien de colonnes chaque affiche glisse, et celles qui s'effacent. */
  offsets: SharedValue<number[]>;
  hidden: SharedValue<boolean[]>;
  /** Le mouvement de la grille (`gridMotion`) et le pas d'une ligne : un focus dépassé ne demande rien. */
  motion: GridMotion;
  lineStride: number;
  expand(column: number): void;
  collapse(column: number): void;
}

/** Ce que mène une ligne de `columns` affiches. Une ligne recyclée garde le sien. */
export function useGridPreviewLine(columns: number, motion: GridMotion, lineStride: number): GridPreviewLine {
  const reduced = useReducedMotion();
  const column = useSharedValue(-1);
  const offsets = useSharedValue<number[]>([]);
  const hidden = useSharedValue<boolean[]>([]);
  // Une valeur par colonne, faites une fois pour la vie de la ligne (le nombre
  // de colonnes ne change pas à chaud : la grille se remonte).
  const progress = useMemo(() => Array.from({ length: columns }, () => makeMutable(0)), [columns]);
  return useMemo<GridPreviewLine>(
    () => ({
      column,
      progress,
      offsets,
      hidden,
      motion,
      lineStride,
      expand(at) {
        const spread = gridTrailerPreviewSpread({ column: at, columns });
        offsets.value = spread.offsets;
        hidden.value = spread.hidden;
        column.value = at;
        progress[at].value = motionTo(1, "unfold", reduced);
      },
      collapse(at) {
        progress[at].value = motionTo(0, "unfold", reduced);
      },
    }),
    [column, progress, offsets, hidden, motion, lineStride, columns, reduced],
  );
}

/**
 * Ce que la ligne donne à l'affiche de sa colonne `column` : la place de sa
 * grande carte, sa croissance, et son glissement quand une voisine grandit —
 * vers la place que lui fait la règle, en s'effaçant si elle sort par la
 * gauche (sous la navigation).
 */
export function useGridCellPreview(line: GridPreviewLine, column: number, columns: number, cardWidth: number, gap: number): CardGrowthDriver {
  const { column: grown, progress, offsets, hidden } = line;
  const stride = cardWidth + gap;
  const glide = useAnimatedStyle(() => {
    const at = grown.value;
    if (at < 0 || at === column) return { opacity: 1, transform: [{ translateX: 0 }] };
    const p = progress[at]?.value ?? 0;
    const fade = hidden.value[column] ? Math.min(1, p * 2) : 0;
    return { opacity: 1 - fade, transform: [{ translateX: (offsets.value[column] ?? 0) * stride * p }] };
  });
  return useMemo(() => {
    const cardHeight = Math.round(cardWidth * 1.5);
    const place = gridTrailerPreviewPlace({
      column,
      columns,
      cardWidth,
      cardHeight,
      gap,
      focusScale: CARD_FOCUS_SCALE,
      lift: PREVIEW_FOCUS_LIFT,
      // La légende descend de la moitié de l'agrandissement (l'affiche grandit depuis son centre).
      captionBottom: cardHeight + (cardHeight * (CARD_FOCUS_SCALE - 1)) / 2 + CAPTION_HEIGHT,
    });
    return {
      ...place,
      progress: progress[column],
      expand: () => line.expand(column),
      collapse: () => line.collapse(column),
      glide,
      watchFocus: (onOutrun: (outrun: boolean) => void) => line.motion.watchFocus(line.lineStride, onOutrun),
    };
  }, [line, progress, column, columns, cardWidth, gap, glide]);
}

/**
 * La préparation des aperçus autour du focus d'une grille : sa ligne et la
 * suivante (tv-core `gridTrailerPreviewWarmWindow`), qui REMPLACENT ce qui
 * attend encore. Elle part quand la grille se POSE (`gridMotion`) : ni pendant
 * un défilement, même quand tvOS ne prévient plus l'app de ses focus (flèche
 * tenue). Rend ce que la grille appelle à chaque focus. Les cartes se lisent
 * par référence : une page de plus ne change pas le gestionnaire.
 */
export function useGridPreviewWarm(cards: readonly CardModel[], columns: number, motion: GridMotion): (index: number) => void {
  const warm = useCardPreviewWarm();
  const latest = useRef(cards);
  latest.current = cards;
  const pending = useRef<number | null>(null);
  useEffect(() => {
    if (!warm) return undefined;
    return motion.onSettled(() => {
      const index = pending.current;
      if (index === null) return;
      pending.current = null;
      const list = latest.current;
      const [start, end] = gridTrailerPreviewWarmWindow(index, list.length, columns);
      warm(
        list.slice(start, end).flatMap((card) => (card.trailer ? [card.trailer] : [])),
        { replace: true },
      );
    });
  }, [warm, columns, motion]);
  return useCallback(
    (index: number) => {
      pending.current = index;
      motion.focused();
    },
    [motion],
  );
}
