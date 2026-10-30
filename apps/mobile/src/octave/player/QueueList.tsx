/**
 * Octave (mobile) — la FILE dans le lecteur plein écran, en DEUX files dites comme telles (règle partagée
 * `queueFiles.ts`, la même qu'au bureau) : la file d'attente de l'utilisateur (« Lire ensuite », « Ajouter à la
 * file d'attente », avec « Effacer »), puis la suite du contexte (« Suite de l'album »…). Une seule liste
 * virtualisée, en-têtes compris ; un appui saute à ce titre, la croix le retire de la file.
 */

import { memo, useCallback, useMemo } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, View, type ListRenderItem } from "react-native";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { isTrackUnavailable, queueActions, queueContextTitleKey, queueSections, type QueueItem } from "@tentacle-tv/shared/octave";
import { PlayerArtwork } from "./PlayerArtwork";
import { useOctavePlayer, usePlayerSelector } from "./OctavePlayerContext";
import { useOctaveColors } from "../theme/octaveColors";
import { clipsOffscreenCells } from "../layout/listClipping";

const ROW = 60;
const HEADER = 44;

type Row = { kind: "header"; key: string; title: string; clearable: boolean } | { kind: "item"; key: string; item: QueueItem };

export const QueueList = memo(function QueueList() {
  const { t } = useTranslation("music");
  const colors = useOctaveColors();
  const player = useOctavePlayer();
  const queue = usePlayerSelector((s) => s.queue);

  const rows = useMemo<Row[]>(() => {
    const { userQueue, contextQueue } = queueSections(queue);
    const out: Row[] = [];
    if (userQueue.length > 0) {
      out.push({ kind: "header", key: "h:user", title: t("queue.userQueue"), clearable: true });
      for (const item of userQueue) out.push({ kind: "item", key: item.uid, item });
    }
    if (contextQueue.length > 0) {
      out.push({ kind: "header", key: "h:context", title: t(queueContextTitleKey(queue.contextId)), clearable: false });
      for (const item of contextQueue) out.push({ kind: "item", key: item.uid, item });
    }
    return out;
  }, [queue, t]);
  // Les positions de chaque rangée (en-têtes plus bas que les titres) : la liste se virtualise sans mesurer.
  const offsets = useMemo(() => {
    let at = 0;
    return rows.map((row) => {
      const offset = at;
      at += row.kind === "header" ? HEADER : ROW;
      return offset;
    });
  }, [rows]);

  const renderItem = useCallback<ListRenderItem<Row>>(({ item: row }) => {
    if (row.kind === "header") {
      return (
        <View style={styles.header}>
          <Text style={[styles.heading, { color: colors.textSecondary }]} accessibilityRole="header">{row.title}</Text>
          {row.clearable && (
            <Pressable onPress={() => queueActions.clearUserQueue(player)} hitSlop={8} style={styles.clear} accessibilityRole="button" accessibilityLabel={t("queue.clearLabel")}>
              <Text style={[styles.clearText, { color: colors.accentText }]}>{t("queue.clear")}</Text>
            </Pressable>
          )}
        </View>
      );
    }
    const { item } = row;
    return <QueueRow item={item} onPlay={() => queueActions.jumpTo(player, item.uid)} onRemove={() => queueActions.remove(player, item.uid)} removeLabel={t("queue.remove")} />;
  }, [colors, player, t]);

  return (
    <View style={styles.wrap}>
      {rows.length === 0 ? (
        <>
          <Text style={[styles.heading, { color: colors.textSecondary }]}>{t("queue.upNext")}</Text>
          <Text style={[styles.empty, { color: colors.textTertiary }]}>{t("queue.empty")}</Text>
        </>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={renderItem}
          getItemLayout={(_d, index) => ({ length: rows[index]?.kind === "header" ? HEADER : ROW, offset: offsets[index] ?? 0, index })}
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
  // Un titre indisponible reste dans la file, grisé : la file le saute, le toucher le dit (`unavailableTrack.ts`).
  const locked = isTrackUnavailable(item.track);
  return (
    <View style={[styles.row, locked && styles.locked]}>
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
  header: { height: HEADER, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  clear: { minHeight: 44, minWidth: 44, alignItems: "flex-end", justifyContent: "flex-end", paddingBottom: 8 },
  clearText: { fontSize: 14, fontWeight: "600" },
  empty: { fontSize: 14, paddingVertical: 12 },
  row: { height: ROW, flexDirection: "row", alignItems: "center" },
  locked: { opacity: 0.4 },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, height: ROW, borderRadius: 12, paddingHorizontal: 4 },
  texts: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: "600" },
  artist: { fontSize: 13, marginTop: 2 },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
