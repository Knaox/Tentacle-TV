import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { gridLineKey, gridLineReveal } from "@tentacle-tv/tv-core";
import { MediaCard } from "../../cards/MediaCard";
import type { CardFocusWatch } from "../../cards/CardPreviewTile";
import type { CardModel } from "../../cards/cardTypes";
import { FocusSection, type FocusSectionReveal } from "../../focus/FocusSection";
import { useRowPreviewRoom } from "../../rows/rowPreviewRoom";
import type { GridMotion } from "./gridMotion";
import { useGridLineDrop, type GridLinePush } from "./gridLinePush";

/**
 * Une LIGNE de grille, devenue un CARROUSEL de l'accueil sans titre (tv-core
 * `cards/trailerPreviewGrid.ts`) : une piste horizontale qui va du bord de
 * l'écran à l'autre, ses affiches à leurs colonnes au repos. Quand l'aperçu
 * d'une affiche démarre, sa cellule DEVIENT la grande carte (`MediaCard`
 * `previewable` : la légende et le pied passent dessous) et la ligne la met
 * EN TÊTE, collée à la navigation, ou en butée au bout — la place, le
 * défilement et le départ du focus sont ceux des rangées (`rowPreviewRoom`,
 * tv-core `trailerPreviewRowHead.ts`), sans rien de recopié.
 *
 * La ligne garde sa hauteur de repos (`height`) : ce que la grande carte gagne
 * déborde vers le bas, et les lignes du dessous descendent d'autant
 * (`gridLinePush`) — la liste recyclée ne relaie rien. La page descend si la
 * ligne agrandie dépasse en bas (le port `previewRevealPort` de la grille).
 *
 * Recyclée (FlashList), la ligne qui reçoit d'autres affiches revient à sa
 * première colonne, sans animation, et oublie la place posée au bout.
 */

/** Comment la page montre une ligne (`gridLineReveal`, tv-core). Des objets stables. */
const LINE_REVEALS: Record<"start" | "nearest", FocusSectionReveal> = { start: { mode: "start" }, nearest: { mode: "nearest" } };

export interface GridLineModel {
  start: number;
  cards: CardModel[];
}

export interface GridCarouselLineProps {
  line: GridLineModel;
  /** Sa place dans la grille (0 : la première ligne). */
  index: number;
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

export const GridCarouselLine = memo(function GridCarouselLine({ line, index, width, height, stride, focusPrefix, motion, push, ...handlers }: GridCarouselLineProps) {
  const track = useAnimatedRef<ScrollView>();
  const scrollX = useRef(0);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollX.current = event.nativeEvent.contentOffset.x;
  }, []);
  const room = useRowPreviewRoom({ track, scrollX, cardWidth: width, inset: TV_STAGE.contentLeft, cardCount: line.cards.length });
  const { onRewind, onCardFocus, onPreviewExpand, onPreviewCollapse } = room;
  // Recyclée pour une autre ligne : elle revient à sa première colonne.
  const shown = useRef(index);
  useEffect(() => {
    if (shown.current === index) return;
    shown.current = index;
    track.current?.scrollTo({ x: 0, y: 0, animated: false });
    onRewind();
  }, [index, track, onRewind]);
  const watch = useCallback<CardFocusWatch>((onOutrun) => motion.watchFocus(stride, onOutrun), [motion, stride]);
  const onExpand = useCallback(
    (at: number, tileWidth: number, grow: number) => {
      onPreviewExpand(at, tileWidth, grow);
      push.expand(index, grow);
    },
    [onPreviewExpand, push, index],
  );
  const onCollapse = useCallback(
    (at: number) => {
      onPreviewCollapse(at);
      push.collapse(index);
    },
    [onPreviewCollapse, push, index],
  );
  const drop = useGridLineDrop(push, index);
  const trackContent = useMemo(() => [styles.content, { paddingRight: TV_STAGE.safe.x + room.reserve }], [room.reserve]);
  return (
    <Animated.View style={[styles.line, drop]}>
      <FocusSection focusKey={gridLineKey(focusPrefix, index)} reveal={LINE_REVEALS[gridLineReveal(index)]}>
        <View ref={room.rowRef} collapsable={false} style={{ height }}>
          <ScrollView
            ref={track}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.track}
            onScroll={onScroll}
            onMomentumScrollEnd={onScroll}
            scrollEventThrottle={100}
            onContentSizeChange={room.onContentSizeChange}
            contentContainerStyle={trackContent}
          >
            {line.cards.map((card, i) => (
              // Clé de PLACE : recyclée, la ligne garde ses cartes (`PosterGrid`).
              <Cell
                key={i}
                card={card}
                index={line.start + i}
                column={i}
                width={width}
                focusPrefix={focusPrefix}
                watch={watch}
                onCardFocus={onCardFocus}
                onExpand={onExpand}
                onCollapse={onCollapse}
                {...handlers}
              />
            ))}
          </ScrollView>
        </View>
      </FocusSection>
    </Animated.View>
  );
});

interface CellProps extends Pick<GridCarouselLineProps, "onPressCard" | "onLongPressCard" | "onFocusCard" | "onWarm" | "width" | "focusPrefix"> {
  card: CardModel;
  index: number;
  /** Sa colonne : sa place dans la piste de la ligne. */
  column: number;
  watch: CardFocusWatch;
  onCardFocus: (column: number, focused: boolean) => void;
  onExpand: (column: number, tileWidth: number, grow: number) => void;
  onCollapse: (column: number) => void;
}

const Cell = memo(function Cell({ card, index, column, width, focusPrefix, watch, onCardFocus, onExpand, onCollapse, onPressCard, onLongPressCard, onFocusCard, onWarm }: CellProps) {
  const onPress = useCallback(() => onPressCard?.(card), [card, onPressCard]);
  const onLongPress = useCallback(() => onLongPressCard?.(card), [card, onLongPressCard]);
  const onFocusChange = useCallback(
    (focused: boolean) => {
      onCardFocus(column, focused);
      if (!focused) return;
      onFocusCard?.(card);
      onWarm?.(index);
    },
    [card, index, column, onCardFocus, onFocusCard, onWarm],
  );
  const onPreviewExpand = useCallback((tileWidth: number, grow: number) => onExpand(column, tileWidth, grow), [onExpand, column]);
  const onPreviewCollapse = useCallback(() => onCollapse(column), [onCollapse, column]);
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
      onPreviewCollapse={onPreviewCollapse}
    />
  );
});

const styles = StyleSheet.create({
  // La piste va d'un bord de l'écran à l'autre : la grande carte passe en tête, collée à la navigation.
  line: { marginLeft: -TV_STAGE.contentLeft, marginRight: -TV_STAGE.safe.x },
  // Le débord laisse la place à l'agrandissement, à l'ombre et à ce que la grande carte gagne.
  track: { overflow: "visible" },
  content: { gap: TV_STAGE.row.gap, paddingLeft: TV_STAGE.contentLeft, alignItems: "flex-start" },
});
