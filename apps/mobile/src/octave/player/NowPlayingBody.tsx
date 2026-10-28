/**
 * Octave (mobile) — le contenu du lecteur plein écran : l'en-tête (poignée, refermer, file), la pochette OU la
 * file, le titre et ses gestes (cœur, playlist, menu : `NowPlayingActions`), la position, les commandes, puis la
 * transition douce (pastille → panneau). Téléphone en
 * colonne, tablette et paysage côte à côte (`nowPlayingLayout`).
 */

import { memo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View, type GestureResponderHandlers } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown, ListMusic } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { CrossfadeChip, CrossfadePanel } from "./CrossfadeControl";
import { NowPlayingActions } from "./NowPlayingActions";
import { NowPlayingArtwork } from "./NowPlayingArtwork";
import { QueueList } from "./QueueList";
import { NowPlayingSourceButton } from "./source/NowPlayingSourceButton";
import { SeekBar } from "./SeekBar";
import { TransportControls } from "./TransportControls";
import { usePlayerSelector } from "./OctavePlayerContext";
import { closeNowPlaying } from "./nowPlayingStore";
import { nowPlayingArtworkSize, nowPlayingLayout } from "./nowPlayingLayout";
import { useOctaveColors } from "../theme/octaveColors";

interface Props {
  headerHandlers: GestureResponderHandlers;
  onDrag: (dy: number) => void;
  onDragEnd: (dy: number, vy: number) => void;
}

export const NowPlayingBody = memo(function NowPlayingBody({ headerHandlers, onDrag, onDragEnd }: Props) {
  const { t } = useTranslation("music");
  const colors = useOctaveColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const layout = nowPlayingLayout(width, height);
  const [showQueue, setShowQueue] = useState(false);
  const [fadeOpen, setFadeOpen] = useState(false);
  const usableH = height - insets.top - insets.bottom;
  const artSize = nowPlayingArtworkSize(layout, layout === "split" ? width - insets.left - insets.right : width, usableH);
  const split = layout === "split";

  const header = (
    <View {...headerHandlers} style={styles.header}>
      <View style={[styles.grabber, { backgroundColor: colors.textTertiary }]} />
      <View style={styles.headerRow}>
        <IconButton label={t("player.close")} onPress={closeNowPlaying}>
          <ChevronDown size={28} color={colors.text} />
        </IconButton>
        <NowPlayingSourceButton />
        {split ? <View style={styles.iconSpace} /> : (
          <IconButton label={t("player.queue")} onPress={() => setShowQueue((v) => !v)} active={showQueue}>
            <ListMusic size={24} color={showQueue ? colors.accentText : colors.text} />
          </IconButton>
        )}
      </View>
    </View>
  );

  const controls = (
    <View style={styles.controls}>
      <TrackTitle />
      <SeekBar />
      <TransportControls compact={split && height < 500} />
      <View style={styles.bottomRow}>
        <CrossfadeChip open={fadeOpen} onToggle={() => setFadeOpen((v) => !v)} />
      </View>
    </View>
  );

  // Le réglage du fondu se pose PAR-DESSUS le bas du lecteur (la mise en page ne bouge pas) ; le voile le referme.
  const fadeLayer = fadeOpen ? (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={[StyleSheet.absoluteFill, styles.fadeScrim]} onPress={() => setFadeOpen(false)} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      <View style={[styles.fadeDock, { paddingBottom: Math.max(16, insets.bottom + 8), paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }, split && styles.fadeDockSplit]}>
        <CrossfadePanel onClose={() => setFadeOpen(false)} />
      </View>
    </View>
  ) : null;

  if (split) {
    return (
      <View style={[styles.fill, { paddingTop: insets.top, paddingBottom: Math.max(16, insets.bottom), paddingLeft: insets.left + 24, paddingRight: insets.right + 24 }]}>
        {header}
        <View style={styles.splitRow}>
          <View style={[styles.splitArt, { width: artSize }]}>
            <NowPlayingArtwork size={artSize} onDrag={onDrag} onDragEnd={onDragEnd} />
          </View>
          <View style={styles.splitSide}>
            {controls}
            {height >= 640 && <View style={styles.splitQueue}><QueueList /></View>}
          </View>
        </View>
        {fadeLayer}
      </View>
    );
  }

  return (
    <View style={[styles.fill, { paddingTop: insets.top, paddingBottom: Math.max(16, insets.bottom + 8) }]}>
      {header}
      <View style={styles.stage}>
        {showQueue ? (
          <Animated.View key="queue" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={styles.queueStage}>
            <QueueList />
          </Animated.View>
        ) : (
          <Animated.View key="art" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
            <NowPlayingArtwork size={artSize} onDrag={onDrag} onDragEnd={onDragEnd} />
          </Animated.View>
        )}
      </View>
      <View style={styles.columnControls}>{controls}</View>
      {fadeLayer}
    </View>
  );
});

const TrackTitle = memo(function TrackTitle() {
  const colors = useOctaveColors();
  const title = usePlayerSelector((s) => s.current?.title ?? "");
  const artist = usePlayerSelector((s) => s.current?.artists.map((a) => a.name).join(", ") ?? "");
  const album = usePlayerSelector((s) => s.current?.album?.title ?? null);
  return (
    <View style={styles.titleRow}>
      <View style={styles.titles} accessible accessibilityRole="header">
        <Text numberOfLines={2} style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text numberOfLines={1} style={[styles.artist, { color: colors.textSecondary }]}>{album ? `${artist} · ${album}` : artist}</Text>
      </View>
      <NowPlayingActions />
    </View>
  );
});

function IconButton({ label, onPress, active, children }: { label: string; onPress: () => void; active?: boolean; children: ReactNode }) {
  const colors = useOctaveColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.icon, (pressed || active) && { backgroundColor: colors.pressed }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active === undefined ? undefined : { selected: active }}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 12, paddingTop: 6 },
  grabber: { alignSelf: "center", width: 38, height: 5, borderRadius: 3, opacity: 0.6, marginBottom: 6 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  iconSpace: { width: 44 },
  stage: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  queueStage: { alignSelf: "stretch", flex: 1, paddingTop: 8 },
  columnControls: { paddingHorizontal: 24 },
  controls: { gap: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  titles: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  artist: { fontSize: 16 },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", minHeight: 44 },
  splitRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 40 },
  splitArt: { alignItems: "center", justifyContent: "center" },
  splitSide: { flex: 1, maxWidth: 520, alignSelf: "stretch", justifyContent: "center", gap: 20 },
  splitQueue: { flexShrink: 1, maxHeight: 320 },
  fadeScrim: { backgroundColor: "rgba(0,0,0,0.45)" },
  fadeDock: { position: "absolute", left: 0, right: 0, bottom: 0 },
  fadeDockSplit: { left: undefined, width: 440 },
});
