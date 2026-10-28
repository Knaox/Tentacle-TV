/**
 * Octave mobile — une liste de titres (playlist, « Titres likés ») virtualisée, triée et cherchée par la
 * règle du bureau (`useListOrder`), où l'on GLISSE un titre à sa place par sa poignée — en mode « Modifier »
 * SEULEMENT : hors de ce mode, ni poignée ni glisser, et chaque rangée se balaie. Rangées de hauteur
 * FIXE : le geste sait où tombe chaque rangée. La lecture suit l'ordre
 * AFFICHÉ (« Lire » joue ce qu'on voit). La tête de page (`header`) et l'état vide passent en en-tête et pied.
 */

import { useCallback, useMemo, useRef, type ReactElement } from "react";
import { AccessibilityInfo, FlatList, View, type ListRenderItem } from "react-native";
import Animated, { useAnimatedScrollHandler, type SharedValue } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import type { ReorderBlock } from "@tentacle-tv/api-client";
import { rowShift, type ListRow } from "@tentacle-tv/shared/octave";
import { TRACK_ROW_HEIGHT, usePagesCurrentKey, usePagesPlayer } from "../../pages";
import { playFrom } from "../../pages/env/playFrom";
import { ReorderRow } from "./ReorderRow";
import { useRowReorder } from "./useRowReorder";

interface Props {
  rows: readonly ListRow[];
  contextId: string;
  gutter: number;
  scrollY: SharedValue<number>;
  header: ReactElement;
  footer?: ReactElement | null;
  bottomInset: number;
  /** `null` : pas de glisser ici (serveur d'avant, liste d'un autre) ; sinon pourquoi il est bloqué, ou rien. */
  reorder: { block: ReorderBlock | null; onMove: (from: number, to: number) => void } | null;
  /** Le mode « Modifier » : la seule porte des poignées. */
  editing: boolean;
  /** Mode « Modifier » d'une playlist modifiable : le « – » de chaque rangée. */
  onRemove?: (row: ListRow) => void;
}

const AnimatedList = Animated.createAnimatedComponent(FlatList<ListRow>);

export function ReorderableTrackList({ rows, contextId, gutter, scrollY, header, footer, bottomInset, reorder, editing, onRemove }: Props) {
  const { t } = useTranslation("musicLists");
  const player = usePagesPlayer();
  const current = usePagesCurrentKey();
  const listRef = useRef<FlatList<ListRow>>(null);
  const viewport = useRef<View>(null);
  const tracks = useMemo(() => rows.map((r) => r.track), [rows]);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  // Le défilement DANS la liste de titres (la tête de page retirée) : celui que le glisser compte.
  const readOffset = useCallback(() => scrollY.value, [scrollY]);
  const canDrag = editing && reorder !== null && reorder.block === null;
  const onMove = useCallback((from: number, to: number) => reorder?.onMove(from, to), [reorder]);
  const { drag, lift, handlers } = useRowReorder({
    count: rows.length,
    rowHeight: TRACK_ROW_HEIGHT,
    enabled: canDrag,
    onMove,
    listRef: listRef as never,
    readOffset,
    viewport,
    rowsVersion: rows,
  });
  // Hors ligne, seuls les titres gardés sur l'appareil partent (la règle de m5, `playFrom`).
  const play = useCallback((index: number) => playFrom(player, tracks, index, contextId), [contextId, player, tracks]);
  const step = useCallback(
    (index: number, delta: -1 | 1) => {
      const to = index + delta;
      if (!canDrag || to < 0 || to >= rows.length) return;
      onMove(index, to);
      const title = rows[index]?.track.title ?? "";
      AccessibilityInfo.announceForAccessibility(t("moved", { title, position: to + 1 }));
    },
    [canDrag, onMove, rows, t],
  );
  const remove = useCallback((index: number) => {
    const row = rows[index];
    if (row) onRemove?.(row);
  }, [onRemove, rows]);

  const renderItem = useCallback<ListRenderItem<ListRow>>(
    ({ item, index }) => (
      <ReorderRow
        track={item.track}
        index={index}
        list={tracks}
        contextId={contextId}
        playing={current === item.track.key}
        onPlay={play}
        gutter={gutter}
        shift={drag ? rowShift(index, drag.from, drag.over, TRACK_ROW_HEIGHT) : 0}
        dragging={drag !== null}
        active={drag?.from === index}
        lift={lift}
        handle={canDrag ? handlers(index) : undefined}
        onStep={step}
        onRemove={onRemove ? remove : undefined}
      />
    ),
    [canDrag, contextId, current, drag, gutter, handlers, lift, onRemove, play, remove, step, tracks],
  );

  return (
    <View ref={viewport} style={{ flex: 1 }} collapsable={false}>
      <AnimatedList
        ref={listRef}
        data={rows as ListRow[]}
        keyExtractor={(r) => r.rowKey}
        renderItem={renderItem}
        extraData={drag}
        ListHeaderComponent={header}
        ListFooterComponent={footer ?? null}
        onScroll={onScroll}
        scrollEventThrottle={16}
        scrollEnabled={drag === null}
        contentContainerStyle={{ paddingBottom: bottomInset }}
        initialNumToRender={14}
        maxToRenderPerBatch={12}
        windowSize={9}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </View>
  );
}
