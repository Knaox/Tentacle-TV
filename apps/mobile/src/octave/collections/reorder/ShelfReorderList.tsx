/**
 * Octave mobile — le mode « RÉORDONNER » d'une section de la bibliothèque (« Vos favoris », ou toutes les
 * playlists) : la grille cède la place à une liste de rangées à poignée, comme Apple Music. On glisse par la
 * poignée (le glisser des listes de titres, `useRowReorder` : retour haptique à chaque place franchie et au
 * lâcher, défilement près des bords), ou par « Monter / Descendre » au lecteur d'écran. Chaque lâcher part
 * au serveur (le geste partagé `shelf.move`, optimiste, le dernier gagne) : « Terminé » ne fait que refermer.
 */

import { useCallback, useRef, type ReactElement } from "react";
import { AccessibilityInfo, FlatList, StyleSheet, Text, View, type ListRenderItem } from "react-native";
import Animated from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { rowShift } from "@tentacle-tv/shared/octave";
import { typography, useTheme } from "@/theme";
import type { OctavePageScroll } from "../../layout/useOctavePageScroll";
import { GlassTextButton } from "../../playlists/screens/BarButtons";
import { useRowReorder } from "../../playlists/reorder/useRowReorder";
import { SHELF_REORDER_ROW_HEIGHT, ShelfReorderRow } from "./ShelfReorderRow";

export interface ShelfReorderItem {
  key: string;
  name: string;
  subtitle: string | null;
  art: ReactElement;
}

interface Props {
  items: readonly ShelfReorderItem[];
  title: string;
  gutter: number;
  scroll: OctavePageScroll;
  onMove: (key: string, to: number) => void;
  onDone: () => void;
}

const AnimatedList = Animated.createAnimatedComponent(FlatList<ShelfReorderItem>);

export function ShelfReorderList({ items, title, gutter, scroll, onMove, onDone }: Props) {
  const { t } = useTranslation("musicFavorites");
  const theme = useTheme();
  const listRef = useRef<FlatList<ShelfReorderItem>>(null);
  const viewport = useRef<View>(null);
  const { scrollY, scrollProps } = scroll;
  const readOffset = useCallback(() => scrollY.value, [scrollY]);
  const move = useCallback(
    (from: number, to: number) => {
      const item = items[from];
      if (item) onMove(item.key, to);
    },
    [items, onMove],
  );
  const { drag, lift, handlers } = useRowReorder({
    count: items.length,
    rowHeight: SHELF_REORDER_ROW_HEIGHT,
    enabled: true,
    onMove: move,
    listRef: listRef as never,
    readOffset,
    viewport,
    rowsVersion: items,
  });
  const step = useCallback(
    (index: number, delta: -1 | 1) => {
      const to = index + delta;
      if (to < 0 || to >= items.length) return;
      move(index, to);
      AccessibilityInfo.announceForAccessibility(t("reorder.moved", { name: items[index]?.name ?? "", position: to + 1, total: items.length }));
    },
    [items, move, t],
  );
  const renderItem = useCallback<ListRenderItem<ShelfReorderItem>>(
    ({ item, index }) => (
      <ShelfReorderRow
        index={index}
        name={item.name}
        subtitle={item.subtitle}
        art={item.art}
        gutter={gutter}
        shift={drag ? rowShift(index, drag.from, drag.over, SHELF_REORDER_ROW_HEIGHT) : 0}
        dragging={drag !== null}
        active={drag?.from === index}
        lift={lift}
        handle={handlers(index)}
        onStep={step}
      />
    ),
    [drag, gutter, handlers, lift, step],
  );
  const header = (
    <View style={[styles.header, { paddingHorizontal: gutter }]}>
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" numberOfLines={1} style={[typography.title, styles.title, { color: theme.colors.text.primary }]}>
          {title}
        </Text>
        <GlassTextButton label={t("reorder.done")} strong onPress={onDone} />
      </View>
      <Text style={[typography.caption, { color: theme.colors.text.tertiary }]}>{t("reorder.hint")}</Text>
    </View>
  );
  return (
    <View ref={viewport} style={styles.fill} collapsable={false}>
      <AnimatedList
        ref={listRef}
        {...scrollProps}
        data={items as ShelfReorderItem[]}
        keyExtractor={(i) => i.key}
        renderItem={renderItem}
        extraData={drag}
        ListHeaderComponent={header}
        scrollEnabled={drag === null}
        initialNumToRender={14}
        windowSize={9}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { gap: 6, paddingBottom: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { flex: 1, minWidth: 0 },
});
