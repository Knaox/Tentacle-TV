/**
 * Octave mobile — une ÉTAGÈRE : un titre (et « Tout afficher »), puis une rangée
 * horizontale de cartes, virtualisée (`FlatList` horizontale, fenêtre courte).
 * L'attente a la forme exacte de la rangée (`ShelfSkeleton`). Une étagère vide
 * ne s'écrit pas. Les premières cartes arrivent l'une après l'autre (`enterMotion`) ; un nouvel ordre remonte
 * la rangée (`listOrder`).
 */

import { memo, type ReactElement, type ReactNode } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui";
import { typography, useTheme } from "@/theme";
import { useFirstEnter } from "../../layout/enterMotion";
import { usePageMetrics } from "./pageStyle";
import { clipsOffscreenCells } from "../../layout/listClipping";
import { listOrderIdentity } from "../../layout/listOrder";
import { useShelfWarmup } from "../env/albumWarmupScope";
import type { MusicAlbum } from "@tentacle-tv/shared/music";

interface ShelfProps<T> {
  title: string;
  hint?: string;
  items: readonly T[];
  keyOf: (item: T) => string;
  render: (item: T, width: number) => ReactElement;
  onSeeAll?: () => void;
  /** Largeur d'une carte (par défaut celle des pages). */
  width?: number;
  /** L'album d'une carte, pour le préparer quand elle s'arrête à l'écran (`albumWarmupScope.tsx`). */
  albumOf?: (item: T) => MusicAlbum | null;
}

export function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  const theme = useTheme();
  const { gutter } = usePageMetrics();
  return (
    <View style={[styles.head, { paddingHorizontal: gutter }]}>
      <View style={styles.headText}>
        <Text style={[typography.subtitle, { color: theme.colors.text.primary }]} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {hint ? <Text style={[typography.caption, { color: theme.colors.text.tertiary, marginTop: 2 }]}>{hint}</Text> : null}
      </View>
      {action}
    </View>
  );
}

function ShelfInner<T>({ title, hint, items, keyOf, render, onSeeAll, width, albumOf }: ShelfProps<T>) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const { gutter, card } = usePageMetrics();
  const w = width ?? card;
  const enterOnce = useFirstEnter();
  // Un nouvel ordre (écoutes relues) = une rangée neuve : jamais une cellule déplacée en pleine entrée (`listOrder.ts`).
  const order = listOrderIdentity(items.map((item) => keyOf(item)));
  const { ref, ...warmup } = useShelfWarmup(albumOf);
  if (items.length === 0) return null;
  const action = onSeeAll ? (
    <Pressable onPress={onSeeAll} hitSlop={10} accessibilityRole="button" style={styles.seeAll}>
      <Text style={[typography.caption, { color: theme.colors.text.secondary, fontWeight: "600" }]}>{t("common.seeAll")}</Text>
    </Pressable>
  ) : undefined;
  return (
    <View ref={ref} collapsable={false}>
      <SectionTitle title={title} hint={hint} action={action} />
      <FlatList
        key={order}
        {...warmup}
        horizontal
        data={items as T[]}
        keyExtractor={keyOf}
        renderItem={({ item, index }) => <Animated.View entering={enterOnce(keyOf(item), index)}>{render(item, w)}</Animated.View>}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: gutter, gap: 12 }}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={3}
        removeClippedSubviews={clipsOffscreenCells(Platform.OS)}
        decelerationRate="fast"
        snapToInterval={w + 12}
        snapToAlignment="start"
      />
    </View>
  );
}

export const Shelf = memo(ShelfInner) as typeof ShelfInner;

/** `albumOf` d'une étagère dont chaque carte EST un album. */
export const albumSelf = (album: MusicAlbum): MusicAlbum => album;

/** L'attente d'une étagère : un titre, et des cartes à leur place. */
export function ShelfSkeleton({ round }: { round?: boolean }) {
  const { gutter, card } = usePageMetrics();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Skeleton width={160} height={20} radius={6} style={{ marginHorizontal: gutter, marginBottom: 12 }} />
      <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: gutter, overflow: "hidden" }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: card, gap: 8 }}>
            <Skeleton width={card} height={card} radius={round ? card / 2 : 10} />
            <Skeleton width={card * 0.7} height={12} radius={4} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12, gap: 12 },
  headText: { flex: 1, minWidth: 0 },
  seeAll: { minHeight: 32, justifyContent: "center" },
});
