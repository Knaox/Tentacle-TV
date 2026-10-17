import { memo, useCallback, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { REVEAL_NEAREST_MARGIN, gridLineKey, gridLineReveal, trailerPreviewRevealOffset } from "@tentacle-tv/tv-core";
import { MediaCard } from "../../cards/MediaCard";
import type { CardFocusWatch } from "../../cards/CardPreviewTile";
import type { CardModel } from "../../cards/cardTypes";
import { FocusSection, type FocusSectionReveal } from "../../focus/FocusSection";
import { usePreviewReveal } from "../../rows/previewRevealPort";
import type { GridMotion } from "./gridMotion";
import { useGridLineDrop, type GridLinePush } from "./gridLinePush";

/**
 * Une LIGNE de grille, FIXE (décision du 18/10, tv-core
 * `cards/trailerPreviewGrid.ts`) : ses affiches restent à leurs colonnes,
 * elle ne défile ni ne tourne. GAUCHE et DROITE ne font que déplacer le
 * focus ; quand l'aperçu d'une affiche démarre, sa cellule DEVIENT la grande
 * carte (`MediaCard` `previewable` : la légende et le pied passent dessous),
 * à sa place dans sa colonne.
 *
 * La ligne garde sa hauteur de repos (`height`) : ce que la grande carte gagne
 * déborde vers le bas, et les lignes du dessous descendent d'autant
 * (`gridLinePush`) — la liste recyclée ne relaie rien. La page descend si la
 * ligne agrandie dépasse en bas (le port `previewRevealPort` de la grille,
 * tv-core `trailerPreviewRevealOffset`).
 */

/** La hauteur de la scène. */
const SCREEN_HEIGHT = 1080;

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
  /** Les colonnes de la grille : une ligne pleine en a autant. */
  columns: number;
  width: number;
  /** La hauteur de la ligne au repos : l'affiche et sa légende. */
  height: number;
  /** D'une ligne à la suivante : un focus que la page a dépassé ne demande rien (`gridMotion`). */
  stride: number;
  focusPrefix: string;
  motion: GridMotion;
  push: GridLinePush;
  onPressCard?: (card: CardModel) => void;
  onLongPressCard?: (card: CardModel) => void;
  onFocusCard?: (card: CardModel) => void;
  /** Le focus s'y pose : les aperçus autour se préparent. */
  onWarm?: (index: number) => void;
}

export const GridLine = memo(function GridLine({ line, index, columns, width, height, stride, focusPrefix, motion, push, ...handlers }: GridLineProps) {
  const reveal = usePreviewReveal();
  const lineRef = useRef<View>(null);
  const watch = useCallback<CardFocusWatch>((onOutrun) => motion.watchFocus(stride, onOutrun), [motion, stride]);
  const onExpand = useCallback(
    (gain: number) => {
      // Une grande carte moins haute que l'affiche ne fait rien remonter.
      const grow = Math.max(0, gain);
      push.expand(index, grow);
      if (!reveal) return;
      // La ligne telle qu'elle sera : sa hauteur de repos, plus ce que la carte gagne (le pied compris).
      lineRef.current?.measureInWindow((_x, top, _width, rest) => {
        const offset = trailerPreviewRevealOffset({
          top,
          bottom: top + rest + grow,
          viewportHeight: SCREEN_HEIGHT,
          topMargin: REVEAL_NEAREST_MARGIN,
          bottomMargin: REVEAL_NEAREST_MARGIN,
        });
        if (offset !== null) reveal.scrollBy(offset);
      });
    },
    [push, index, reveal],
  );
  const onCollapse = useCallback(() => push.collapse(index), [push, index]);
  const drop = useGridLineDrop(push, index);
  return (
    <Animated.View style={drop}>
      <FocusSection focusKey={gridLineKey(focusPrefix, index)} reveal={LINE_REVEALS[gridLineReveal(index)]}>
        <View ref={lineRef} collapsable={false} style={[styles.line, { height }]}>
          {line.cards.map((card, i) => (
            // Clé de PLACE : recyclée, la ligne garde ses cartes (`PosterGrid`).
            <Cell
              key={i}
              card={card}
              index={line.start + i}
              column={i}
              columns={columns}
              width={width}
              focusPrefix={focusPrefix}
              watch={watch}
              onExpand={onExpand}
              onCollapse={onCollapse}
              {...handlers}
            />
          ))}
        </View>
      </FocusSection>
    </Animated.View>
  );
});

interface CellProps extends Pick<GridLineProps, "onPressCard" | "onLongPressCard" | "onFocusCard" | "onWarm" | "width" | "focusPrefix" | "columns"> {
  card: CardModel;
  index: number;
  /** Sa colonne dans la ligne (0 : la première). */
  column: number;
  watch: CardFocusWatch;
  onExpand: (grow: number) => void;
  onCollapse: () => void;
}

const Cell = memo(function Cell({ card, index, width, focusPrefix, watch, onExpand, onCollapse, onPressCard, onLongPressCard, onFocusCard, onWarm }: CellProps) {
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
  const onPreviewExpand = useCallback((_tileWidth: number, grow: number) => onExpand(grow), [onExpand]);
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
      onPreviewExpand={onPreviewExpand}
      onPreviewCollapse={onCollapse}
    />
  );
});

const styles = StyleSheet.create({
  // Les affiches à leurs colonnes ; le débord laisse la place à l'agrandissement et à la grande carte.
  line: { flexDirection: "row", gap: TV_STAGE.row.gap, alignItems: "flex-start", overflow: "visible" },
});
