import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View, type ScrollView, type StyleProp, type ViewStyle } from "react-native";
import Animated, { interpolate, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, type AnimatedRef, type SharedValue } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { gridLineKey, gridLineReprises, gridLineReveal, gridLineTurns, gridLineUnderRailFade, reduceGridLine } from "@tentacle-tv/tv-core";
import { MediaCard } from "../../cards/MediaCard";
import type { CardFocusWatch } from "../../cards/CardPreviewTile";
import type { CardModel } from "../../cards/cardTypes";
import { FocusSection, type FocusSectionReveal } from "../../focus/FocusSection";
import { motionTo } from "../../motion/motion";
import { useRowPreviewRoom } from "../../rows/rowPreviewRoom";
import type { GridMotion } from "./gridMotion";
import { useGridLineDrop, type GridLinePush } from "./gridLinePush";
import { GridReprise } from "./GridReprise";

/**
 * Une LIGNE de grille, devenue un CARROUSEL de l'accueil sans titre (tv-core
 * `cards/trailerPreviewGrid.ts`) : une piste horizontale qui va du bord de
 * l'écran à l'autre, ses affiches à leurs colonnes au repos. Quand l'aperçu
 * d'une affiche démarre, sa cellule DEVIENT la grande carte (`MediaCard`
 * `previewable` : la légende et le pied passent dessous) et la ligne la met
 * EN TÊTE, collée à la navigation — la ligne TOURNE : la place au bout est
 * remplie par les REPRISES, le début de la même ligne, atténué et non
 * focalisable (`GridReprise`). La dernière affiche reste en butée. Le
 * défilement, la place et le départ du focus sont ceux des rangées
 * (`rowPreviewRoom`), menés par la règle des grilles (tv-core
 * `trailerPreviewGridLine.ts`, qui délègue à `trailerPreviewRowHead.ts`).
 *
 * La ligne garde sa hauteur de repos (`height`) : ce que la grande carte gagne
 * déborde vers le bas, et les lignes du dessous descendent d'autant
 * (`gridLinePush`) — la liste recyclée ne relaie rien. La page descend si la
 * ligne agrandie dépasse en bas (le port `previewRevealPort` de la grille).
 *
 * Une affiche sortie à gauche, sous la navigation, s'atténue au fil du
 * défilement de la ligne (tv-core `gridLineUnderRailFade`) — elle et sa
 * légende ; jamais transparente : GAUCHE y mène. Focalisée, elle est pleine.
 *
 * Recyclée (FlashList), la ligne qui reçoit d'autres affiches revient à sa
 * première colonne, sans animation, et oublie la place posée au bout.
 */

/** La largeur de la scène. */
const SCREEN_WIDTH = 1920;

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
  const track = useAnimatedRef<Animated.ScrollView>();
  // Le défilement de la piste, sur le fil d'interface : l'atténuation le suit image par image ;
  // la règle de tête le relit côté JS au moment de ses évènements.
  const offset = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    offset.value = event.contentOffset.x;
  });
  const scrollX = useMemo(() => ({ get current() { return offset.value; } }), [offset]);
  const cardCount = line.cards.length;
  // La règle des rangées joue sa piste par la même référence animée (`rowGlide`).
  const room = useRowPreviewRoom({ track: track as unknown as AnimatedRef<ScrollView>, scrollX, cardWidth: width, inset: TV_STAGE.contentLeft, cardCount, reduce: reduceGridLine });
  // Les reprises paraissent avec une grande carte en tête, jamais avec celle de la dernière (en butée).
  const reduced = useReducedMotion();
  const repriseShown = useSharedValue(0);
  const turns = gridLineTurns({ cardCount, cardWidth: width, gap: TV_STAGE.row.gap, inset: TV_STAGE.contentLeft, viewportWidth: SCREEN_WIDTH, rightMargin: TV_STAGE.safe.x });
  const pitch = width + TV_STAGE.row.gap;
  const reprises = useMemo(() => (turns ? gridLineReprises(room.reserve, cardCount, pitch) : []), [turns, room.reserve, cardCount, pitch]);
  const { onRewind, onCardFocus, onPreviewExpand, onPreviewCollapse } = room;
  // Recyclée pour une autre ligne : elle revient à sa première colonne.
  const shown = useRef(index);
  useEffect(() => {
    if (shown.current === index) return;
    shown.current = index;
    track.current?.scrollTo({ x: 0, y: 0, animated: false });
    onRewind();
    repriseShown.value = 0;
  }, [index, track, onRewind, repriseShown]);
  const watch = useCallback<CardFocusWatch>((onOutrun) => motion.watchFocus(stride, onOutrun), [motion, stride]);
  const onExpand = useCallback(
    (at: number, tileWidth: number, grow: number) => {
      onPreviewExpand(at, tileWidth, grow);
      push.expand(index, grow);
      repriseShown.value = motionTo(turns && at < cardCount - 1 ? 1 : 0, "unfold", reduced);
    },
    [onPreviewExpand, push, index, repriseShown, turns, cardCount, reduced],
  );
  const onCollapse = useCallback(
    (at: number) => {
      onPreviewCollapse(at);
      push.collapse(index);
    },
    [onPreviewCollapse, push, index],
  );
  const drop = useGridLineDrop(push, index);
  // Les reprises occupent la place au bout : seul ce qui en dépasse reste en retrait.
  const trailing = Math.max(0, room.reserve - reprises.length * pitch);
  const trackContent = useMemo(() => [styles.content, { paddingRight: TV_STAGE.safe.x + trailing }], [trailing]);
  return (
    <Animated.View style={[styles.line, drop]}>
      {/* `rowReveal` : en revenant vers la gauche, la carte focalisée s'arrête au retrait de la
          ligne, jamais sous le rail (Apple TV, `TentacleRowScroller.m` ; Android le fait déjà). */}
      <FocusSection focusKey={gridLineKey(focusPrefix, index)} reveal={LINE_REVEALS[gridLineReveal(index)]} rowReveal>
        <View ref={room.rowRef} collapsable={false} style={{ height }}>
          <Animated.ScrollView
            ref={track}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.track}
            onScroll={onScroll}
            scrollEventThrottle={16}
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
                offset={offset}
                onCardFocus={onCardFocus}
                onExpand={onExpand}
                onCollapse={onCollapse}
                {...handlers}
              />
            ))}
            {reprises.map((column, i) => (
              <GridReprise key={`r${i}`} card={line.cards[column]} width={width} shown={repriseShown} />
            ))}
          </Animated.ScrollView>
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
  /** Le défilement de la ligne : sortie sous la navigation, l'affiche s'atténue. */
  offset: SharedValue<number>;
  onCardFocus: (column: number, focused: boolean) => void;
  onExpand: (column: number, tileWidth: number, grow: number) => void;
  onCollapse: (column: number) => void;
}

const Cell = memo(function Cell({ card, index, column, width, focusPrefix, watch, offset, onCardFocus, onExpand, onCollapse, onPressCard, onLongPressCard, onFocusCard, onWarm }: CellProps) {
  const onPress = useCallback(() => onPressCard?.(card), [card, onPressCard]);
  const onLongPress = useCallback(() => onLongPressCard?.(card), [card, onLongPressCard]);
  const focusedNow = useSharedValue(false);
  const fade = useMemo(() => gridLineUnderRailFade({ inset: TV_STAGE.contentLeft, cardWidth: width }), [width]);
  const center = TV_STAGE.contentLeft + column * (width + TV_STAGE.row.gap) + width / 2;
  const under = useAnimatedStyle(() => ({
    opacity: focusedNow.value ? 1 : interpolate(center - offset.value, fade.centers, fade.opacities, "clamp"),
  }));
  const onFocusChange = useCallback(
    (focused: boolean) => {
      focusedNow.value = focused;
      onCardFocus(column, focused);
      if (!focused) return;
      onFocusCard?.(card);
      onWarm?.(index);
    },
    [card, index, column, onCardFocus, onFocusCard, onWarm, focusedNow],
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
      cellStyle={under as StyleProp<ViewStyle>}
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
