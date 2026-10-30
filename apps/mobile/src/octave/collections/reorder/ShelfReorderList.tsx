/**
 * Octave mobile — le mode « RÉORDONNER » d'une section de la bibliothèque (« Vos favoris », ou toutes les
 * playlists) : la grille cède la place à une liste de rangées à poignée, comme Apple Music. On glisse par la
 * poignée (la liste de tri partagée, `ReorderList` : retour haptique à chaque place franchie et au
 * lâcher, défilement près des bords), ou par « Monter / Descendre » au lecteur d'écran. Chaque lâcher part
 * au serveur (le geste partagé `shelf.move`, optimiste, le dernier gagne) : « Terminé » ne fait que refermer.
 */

import { useCallback, useMemo, type ReactElement } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { typography, useTheme } from "@/theme";
import { OCTAVE_TOP_BAR_HEIGHT, type OctavePageScroll } from "../../layout/useOctavePageScroll";
import { useOctaveLayout } from "../../layout/useOctaveLayout";
import { GlassTextButton } from "../../playlists/screens/BarButtons";
import { ReorderList, type ReorderSlot } from "../../reorder/ReorderList";
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

const keyOf = (item: ShelfReorderItem) => item.key;

export function ShelfReorderList({ items, title, gutter, scroll, onMove, onDone }: Props) {
  const { t } = useTranslation("musicFavorites");
  const theme = useTheme();
  const layout = useOctaveLayout();
  const { scrollY, scrollProps } = scroll;
  const { onScroll, ...rest } = scrollProps;
  const move = useCallback(
    (from: number, to: number) => {
      const item = items[from];
      if (item) onMove(item.key, to);
    },
    [items, onMove],
  );
  const announce = useCallback(
    (from: number, to: number) => {
      AccessibilityInfo.announceForAccessibility(t("reorder.moved", { name: items[from]?.name ?? "", position: to + 1, total: items.length }));
    },
    [items, t],
  );
  const renderRow = useCallback(
    (item: ShelfReorderItem, _index: number, slot: ReorderSlot) => <ShelfReorderRow name={item.name} subtitle={item.subtitle} art={item.art} gutter={gutter} slot={slot} />,
    [gutter],
  );
  const edgeInsets = useMemo(() => ({ top: layout.topInset + OCTAVE_TOP_BAR_HEIGHT, bottom: Math.max(0, layout.bottomInset - 24) }), [layout.bottomInset, layout.topInset]);
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
    <ReorderList
      data={items}
      keyOf={keyOf}
      rowHeight={SHELF_REORDER_ROW_HEIGHT}
      renderRow={renderRow}
      onMove={move}
      scrollY={scrollY}
      onScroll={onScroll}
      scrollProps={rest}
      header={header}
      edgeInsets={edgeInsets}
      onStepped={announce}
    />
  );
}

const styles = StyleSheet.create({
  header: { gap: 6, paddingBottom: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { flex: 1, minWidth: 0 },
});
