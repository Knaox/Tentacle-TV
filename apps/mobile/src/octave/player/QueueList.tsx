/**
 * Octave (mobile) — la FILE dans le lecteur plein écran : le titre en cours, puis ce qui suit (liste
 * virtualisée) ; un appui saute à ce titre, la croix le retire de la file.
 */

import { memo, useCallback } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, View, type ListRenderItem } from "react-native";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { queueActions, upcoming, type QueueItem } from "@tentacle-tv/shared/octave";
import { PlayerArtwork } from "./PlayerArtwork";
import { useOctavePlayer, usePlayerSelector } from "./OctavePlayerContext";
import { useOctaveColors } from "../theme/octaveColors";
import { clipsOffscreenCells } from "../layout/listClipping";

const ROW = 60;

export const QueueList = memo(function QueueList() {
  const { t } = useTranslation("music");
  const colors = useOctaveColors();
  const player = useOctavePlayer();
  const queue = usePlayerSelector((s) => s.queue);
  const items = upcoming(queue);

  const renderItem = useCallback<ListRenderItem<QueueItem>>(({ item }) => (
    <QueueRow item={item} onPlay={() => queueActions.jumpTo(player, item.uid)} onRemove={() => queueActions.remove(player, item.uid)} removeLabel={t("queue.remove")} />
  ), [player, t]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: colors.textSecondary }]}>{t("queue.upNext")}</Text>
      {items.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textTertiary }]}>{t("queue.empty")}</Text>
      ) : (
        <FlatList
          data={items as QueueItem[]}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          getItemLayout={(_d, index) => ({ length: ROW, offset: ROW * index, index })}
          initialNumToRender={10}
          windowSize={5}
          removeClippedSubviews={clipsOffscreenCells(Platform.OS)}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
});

const QueueRow = memo(function QueueRow({ item, onPlay, onRemove, removeLabel }: { item: QueueItem; onPlay: () => void; onRemove: () => void; removeLabel: string }) {
  const colors = useOctaveColors();
  const artist = item.track.artists.map((a) => a.name).join(", ");
  return (
    <View style={styles.row}>
      <Pressable onPress={onPlay} style={({ pressed }) => [styles.main, pressed && { backgroundColor: colors.pressed }]} accessibilityRole="button" accessibilityLabel={`${item.track.title} — ${artist}`}>
        <PlayerArtwork url={item.track.artworkUrl} size={44} radius={8} />
        <View style={styles.texts}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{item.track.title}</Text>
          <Text numberOfLines={1} style={[styles.artist, { color: colors.textSecondary }]}>{artist}</Text>
        </View>
      </Pressable>
      <Pressable onPress={onRemove} hitSlop={6} style={styles.remove} accessibilityRole="button" accessibilityLabel={removeLabel}>
        <X size={18} color={colors.textTertiary} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 120 },
  heading: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
  empty: { fontSize: 14, paddingVertical: 12 },
  row: { height: ROW, flexDirection: "row", alignItems: "center" },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, height: ROW, borderRadius: 12, paddingHorizontal: 4 },
  texts: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: "600" },
  artist: { fontSize: 13, marginTop: 2 },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
