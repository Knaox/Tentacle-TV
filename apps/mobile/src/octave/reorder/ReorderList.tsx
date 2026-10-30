/**
 * Octave mobile — LA liste réordonnable par glisser (le composant de TRI partagé : titres d'une playlist,
 * « Titres likés », file d'attente du lecteur, rubriques et playlists favorites de la bibliothèque). Rangées
 * de hauteur FIXE, virtualisées à la main : seules les rangées visibles (et une marge) sont montées, la
 * fenêtre ne change qu'au franchissement d'un paquet de rangées (`rowWindow`, jamais un rendu par image), et
 * la rangée TENUE reste toujours montée — c'est ce qui garantit qu'un glisser se termine (`useReorderDrag`).
 *
 * La rangée ne sait rien du geste : elle reçoit sa poignée (`ReorderSlot.handle`, à étaler sur la vue de la
 * poignée, 44 pt) et « Monter / Descendre » pour le lecteur d'écran. `onMove(from, to)` : rangs de `data`.
 */

import { useCallback, useMemo, useRef, useState, type ReactElement } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type ScrollViewProps } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useComposedEventHandler,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { useTheme } from "@/theme";
import { ReorderCell, type ReorderSlot } from "./ReorderCell";
import { decodeWindow, windowCode } from "./reorderWorklets";
import { useReorderDrag } from "./useReorderDrag";

export type { ReorderSlot } from "./ReorderCell";

const BLOCK = 8;
const OVERSCAN = 12;
const NO_INSETS = { top: 0, bottom: 0 };

type ScrollHandler = ReturnType<typeof useAnimatedScrollHandler>;

export interface ReorderListProps<T> {
  data: readonly T[];
  keyOf: (item: T) => string;
  rowHeight: number;
  renderRow: (item: T, index: number, slot: ReorderSlot) => ReactElement;
  /** `null` : l'ordre ne se change pas ici (aucune poignée). */
  onMove: ((from: number, to: number) => void) | null;
  /** Le défilement (fil d'interface), écrit par la liste ; la page peut s'en servir (tête qui s'efface). */
  scrollY: SharedValue<number>;
  /** Un gestionnaire de défilement de plus (mémoire de la page, balayage refermé…). */
  onScroll?: ScrollHandler;
  scrollProps?: Omit<ScrollViewProps, "onScroll" | "children" | "scrollEnabled">;
  header?: ReactElement | null;
  footer?: ReactElement | null;
  /** Ce que des barres recouvrent en haut et en bas de la liste : le défilement automatique part de leur bord. */
  edgeInsets?: { top: number; bottom: number };
  /** Ce qui, hors des éléments, change le rendu des rangées (sélection, titre en cours…). */
  extraData?: unknown;
  /** Après « Monter / Descendre » (lecteur d'écran) : l'annonce de la nouvelle place. */
  onStepped?: (from: number, to: number) => void;
  /** Les places permises à une rangée (sa section) ; toute la liste sinon. */
  bounds?: (index: number) => { min: number; max: number };
}

export function ReorderList<T>({ data, keyOf, rowHeight, renderRow, onMove, scrollY, onScroll, scrollProps, header, footer, edgeInsets = NO_INSETS, extraData, onStepped, bounds }: ReorderListProps<T>) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const viewport = useRef<View>(null);
  const listTop = useSharedValue(0);
  const viewportH = useSharedValue(0);
  const contentH = useSharedValue(0);
  const maxScroll = useSharedValue(0);
  const zero = useSharedValue(0);
  const count = data.length;

  // Une version par liste affichée : le geste en cours ne vaut que pour elle.
  const versions = useRef({ data, n: 0 });
  if (versions.current.data !== data) versions.current = { data, n: versions.current.n + 1 };
  const version = versions.current.n;

  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const move = useCallback((from: number, to: number) => moveRef.current?.(from, to), []);
  const drag = useReorderDrag({
    count,
    rowHeight,
    enabled: onMove !== null,
    onMove: move,
    scrollRef,
    scrollY,
    maxScroll,
    viewport,
    edgeInsets,
    version,
    bounds,
  });

  const own = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });
  const scrollHandler = useComposedEventHandler(onScroll ? [own, onScroll] : [own]);

  // La fenêtre montée, recalculée au franchissement d'un paquet de rangées seulement.
  const [range, setRange] = useState(() => ({ first: 0, last: Math.min(count - 1, BLOCK * 2 + OVERSCAN - 1) }));
  const applyWindow = useCallback((code: number) => setRange(decodeWindow(code)), []);
  useAnimatedReaction(
    () => windowCode(scrollY.value, viewportH.value || 900, listTop.value, rowHeight, count, BLOCK, OVERSCAN),
    (code, prev) => {
      if (code !== prev) runOnJS(applyWindow)(code);
    },
    [count, rowHeight],
  );

  const onRowsLayout = useCallback((e: LayoutChangeEvent) => {
    listTop.value = e.nativeEvent.layout.y;
  }, [listTop]);
  const onViewportLayout = useCallback((e: LayoutChangeEvent) => {
    viewportH.value = e.nativeEvent.layout.height;
    maxScroll.value = Math.max(0, contentH.value - e.nativeEvent.layout.height);
  }, [contentH, maxScroll, viewportH]);
  const onContentSize = useCallback((_w: number, h: number) => {
    contentH.value = h;
    maxScroll.value = Math.max(0, h - viewportH.value);
  }, [contentH, maxScroll, viewportH]);

  const step = useCallback(
    (index: number, delta: -1 | 1) => {
      const to = index + delta;
      const allowed = bounds?.(index) ?? { min: 0, max: count - 1 };
      if (!moveRef.current || to < allowed.min || to > allowed.max) return;
      moveRef.current(index, to);
      onStepped?.(index, to);
    },
    [bounds, count, onStepped],
  );

  const indices = useMemo(() => {
    const out: number[] = [];
    const last = Math.min(range.last, count - 1);
    for (let i = Math.max(0, range.first); i <= last; i++) out.push(i);
    if (drag.heldKey !== null) {
      const heldIndex = data.findIndex((item) => keyOf(item) === drag.heldKey);
      if (heldIndex >= 0 && (heldIndex < range.first || heldIndex > last)) out.push(heldIndex);
    }
    return out;
  }, [count, data, drag.heldKey, keyOf, range]);

  const liftedBackground = theme.colors.surface.s2;
  return (
    <View ref={viewport} style={styles.fill} collapsable={false} onTouchEnd={drag.onTouchEnd} onTouchCancel={drag.onTouchCancel}>
      <Animated.ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        scrollEventThrottle={16}
        {...scrollProps}
        onScroll={scrollHandler}
        scrollEnabled={!drag.active}
        onLayout={onViewportLayout}
        onContentSizeChange={onContentSize}
      >
        {header ?? null}
        <View onLayout={onRowsLayout} style={{ height: count * rowHeight }}>
          {indices.map((index) => {
            const item = data[index] as T;
            const key = keyOf(item);
            const lifted = drag.heldKey === key;
            return (
              <ReorderCell
                key={key}
                item={item}
                index={index}
                rowHeight={rowHeight}
                version={version}
                values={drag.values}
                lift={lifted ? drag.values.lift : zero}
                lifted={lifted}
                reduced={reduced}
                liftedBackground={liftedBackground}
                handle={drag.handlers(index, key)}
                onStep={step}
                renderRow={renderRow}
                extraData={extraData}
              />
            );
          })}
        </View>
        {footer ?? null}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
