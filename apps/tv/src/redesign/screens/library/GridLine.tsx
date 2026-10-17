import { memo, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { gridLineKey, gridLineReveal } from "@tentacle-tv/tv-core";
import { MediaCard } from "../../cards/MediaCard";
import type { CardModel } from "../../cards/cardTypes";
import type { CardFocusWatch } from "../../cards/useCardPreviewFocus";
import { FocusSection, type FocusSectionReveal } from "../../focus/FocusSection";
import type { GridMotion } from "./gridMotion";

/**
 * Une LIGNE de grille, FIXE (tv-core `cards/trailerPreviewGrid.ts`) : ses
 * affiches restent à leurs colonnes, elle ne défile ni ne tourne, rien n'y
 * grandit. GAUCHE et DROITE ne font que déplacer le focus ; l'aperçu de
 * l'affiche focalisée se joue dans la zone fixe en haut de l'écran.
 */

/** Comment la page montre une ligne (`gridLineReveal`, tv-core). Des objets stables. */
const LINE_REVEALS: Record<"start" | "nearest", FocusSectionReveal> = { start: { mode: "start" }, nearest: { mode: "nearest" } };

export interface GridLineModel {
  start: number;
  cards: CardModel[];
}

export interface GridLineProps {
  line: GridLineModel;
  /** Sa place dans la grille (0 : la première ligne). */
  index: number;
  width: number;
  /** La hauteur de la ligne : l'affiche et sa légende. */
  height: number;
  /** D'une ligne à la suivante : un focus que la page a dépassé ne demande rien (`gridMotion`). */
  stride: number;
  focusPrefix: string;
  motion: GridMotion;
  onPressCard?: (card: CardModel) => void;
  onLongPressCard?: (card: CardModel) => void;
  onFocusCard?: (card: CardModel) => void;
  /** Le focus s'y pose : les aperçus autour se préparent. */
  onWarm?: (index: number) => void;
}

export const GridLine = memo(function GridLine({ line, index, width, height, stride, focusPrefix, motion, ...handlers }: GridLineProps) {
  const watch = useCallback<CardFocusWatch>((onOutrun) => motion.watchFocus(stride, onOutrun), [motion, stride]);
  return (
    <FocusSection focusKey={gridLineKey(focusPrefix, index)} reveal={LINE_REVEALS[gridLineReveal(index)]}>
      <View style={[styles.line, { height }]}>
        {line.cards.map((card, i) => (
          // Clé de PLACE : recyclée, la ligne garde ses cartes (`PosterGrid`).
          <Cell key={i} card={card} index={line.start + i} width={width} focusPrefix={focusPrefix} watch={watch} {...handlers} />
        ))}
      </View>
    </FocusSection>
  );
});

interface CellProps extends Pick<GridLineProps, "onPressCard" | "onLongPressCard" | "onFocusCard" | "onWarm" | "width" | "focusPrefix"> {
  card: CardModel;
  index: number;
  watch: CardFocusWatch;
}

const Cell = memo(function Cell({ card, index, width, focusPrefix, watch, onPressCard, onLongPressCard, onFocusCard, onWarm }: CellProps) {
  const onPress = useCallback(() => onPressCard?.(card), [card, onPressCard]);
  const onLongPress = useCallback(() => onLongPressCard?.(card), [card, onLongPressCard]);
  const onFocusChange = useCallback(
    (focused: boolean) => {
      if (!focused) return;
      onFocusCard?.(card);
      onWarm?.(index);
    },
    [card, index, onFocusCard, onWarm],
  );
  return (
    <MediaCard
      card={card}
      variant="poster"
      width={width}
      origin="center"
      focusKey={`${focusPrefix}:${index}`}
      onPress={onPressCard ? onPress : undefined}
      onLongPress={onLongPressCard ? onLongPress : undefined}
      onFocusChange={onFocusChange}
      previewable
      previewWatch={watch}
    />
  );
});

const styles = StyleSheet.create({
  // Les affiches à leurs colonnes ; le débord laisse la place à l'agrandissement du focus et à son ombre.
  line: { flexDirection: "row", gap: TV_STAGE.row.gap, alignItems: "flex-start", overflow: "visible" },
});
