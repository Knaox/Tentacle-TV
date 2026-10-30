/**
 * Octave (mobile) — la FILE dans le lecteur plein écran, en DEUX files dites comme telles (règle partagée
 * `queueFiles.ts`, la même qu'au bureau) : la file d'attente de l'utilisateur (« Lire ensuite », « Ajouter à la
 * file d'attente », avec « Effacer »), puis la suite du contexte (« Suite de l'album »…). Une seule liste
 * virtualisée, en-têtes compris (la liste de tri partagée, `ReorderList`) ; un appui saute à ce titre, la croix
 * le retire de la file, la POIGNÉE le glisse à sa place DANS sa file (comme Apple Music, sans mode à ouvrir).
 */

import { memo, useCallback, useMemo } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { GripVertical, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { isTrackUnavailable, queueActions, queueContextTitleKey, type QueueItem } from "@tentacle-tv/shared/octave";
import { PlayerArtwork } from "./PlayerArtwork";
import { useOctavePlayer, usePlayerSelector } from "./OctavePlayerContext";
import { useOctaveColors } from "../theme/octaveColors";
import { ReorderList, type ReorderSlot } from "../reorder/ReorderList";
import { queueRows, type QueueRow } from "./queueRows";

/** Toutes les rangées, titres de file compris, ont la même hauteur : le glisser sait où tombe chacune. */
const ROW = 60;
const keyOf = (row: QueueRow) => row.key;

export const QueueList = memo(function QueueList() {
  const { t } = useTranslation("music");
  const { t: tl } = useTranslation("musicLists");
  const colors = useOctaveColors();
  const player = useOctavePlayer();
  const queue = usePlayerSelector((s) => s.queue);

  const scrollY = useSharedValue(0);
  const model = useMemo(() => queueRows(queue), [queue]);
  const contextTitle = t(queueContextTitleKey(queue.contextId));

  const onMove = useCallback((from: number, to: number) => {
    const move = model.moveOf(from, to);
    if (move) queueActions.move(player, move.uid, move.toIndex);
  }, [model, player]);
  const announce = useCallback((from: number, to: number) => {
    const row = model.rows[from];
    if (row?.kind === "item") AccessibilityInfo.announceForAccessibility(tl("moved", { title: row.item.track.title, position: to - model.bounds(from).min + 1 }));
  }, [model, tl]);

  const renderRow = useCallback((row: QueueRow, _index: number, slot: ReorderSlot) => {
    if (row.kind === "header") {
      return (
        <View style={styles.header}>
          <Text style={[styles.heading, { color: colors.textSecondary }]} accessibilityRole="header">{row.section === "user" ? t("queue.userQueue") : contextTitle}</Text>
          {row.clearable && (
            <Pressable onPress={() => queueActions.clearUserQueue(player)} hitSlop={8} style={styles.clear} accessibilityRole="button" accessibilityLabel={t("queue.clearLabel")}>
              <Text style={[styles.clearText, { color: colors.accentText }]}>{t("queue.clear")}</Text>
            </Pressable>
          )}
        </View>
      );
    }
    return <QueueEntryRow item={row.item} slot={slot} />;
  }, [colors, contextTitle, player, t]);

  return (
    <View style={styles.wrap}>
      {model.rows.length === 0 ? (
        <>
          <Text style={[styles.heading, { color: colors.textSecondary }]}>{t("queue.upNext")}</Text>
          <Text style={[styles.empty, { color: colors.textTertiary }]}>{t("queue.empty")}</Text>
        </>
      ) : (
        <ReorderList
          data={model.rows}
          keyOf={keyOf}
          rowHeight={ROW}
          renderRow={renderRow}
          onMove={onMove}
          scrollY={scrollY}
          scrollProps={SCROLL_PROPS}
          bounds={model.bounds}
          onStepped={announce}
        />
      )}
    </View>
  );
});

const SCROLL_PROPS = { showsVerticalScrollIndicator: false } as const;

/** Une entrée : appui = la lire, croix = la retirer, poignée = la glisser (et « Monter / Descendre »). */
const QueueEntryRow = memo(function QueueEntryRow({ item, slot }: { item: QueueItem; slot: ReorderSlot }) {
  const { t } = useTranslation("music");
  const colors = useOctaveColors();
  const player = useOctavePlayer();
  const artist = item.track.artists.map((a) => a.name).join(", ");
  // Un titre indisponible reste dans la file, grisé : la file le saute, le toucher le dit (`unavailableTrack.ts`).
  const locked = isTrackUnavailable(item.track);
  return (
    <View style={[styles.row, locked && styles.locked]}>
      <Pressable onPress={() => queueActions.jumpTo(player, item.uid)} style={({ pressed }) => [styles.main, pressed && { backgroundColor: colors.pressed }]} accessibilityRole="button" accessibilityLabel={`${item.track.title} — ${artist}`}>
        <PlayerArtwork url={item.track.artworkUrl} size={44} radius={8} />
        <View style={styles.texts}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{item.track.title}</Text>
          <Text numberOfLines={1} style={[styles.artist, { color: colors.textSecondary }]}>{artist}</Text>
        </View>
      </Pressable>
      <Pressable onPress={() => queueActions.remove(player, item.uid)} hitSlop={6} style={styles.remove} accessibilityRole="button" accessibilityLabel={t("queue.remove")}>
        <X size={18} color={colors.textTertiary} />
      </Pressable>
      {slot.handle ? (
        <View
          {...slot.handle}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t("listOrder.handle", { title: item.track.title })}
          accessibilityActions={[
            { name: "increment", label: t("queue.moveUp") },
            { name: "decrement", label: t("queue.moveDown") },
          ]}
          onAccessibilityAction={(e) => slot.onStep(e.nativeEvent.actionName === "increment" ? -1 : 1)}
          style={styles.handle}
        >
          <GripVertical size={20} color={slot.lifted ? colors.accentText : colors.textTertiary} />
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 120 },
  heading: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
  header: { height: ROW, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
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
  handle: { width: 44, height: ROW, alignItems: "center", justifyContent: "center", marginRight: -10 },
});
