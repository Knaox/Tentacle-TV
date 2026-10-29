/**
 * Octave (mobile) — le MINI-LECTEUR, posé par la coquille au-dessus de la barre d'onglets (téléphone) ou en bas
 * du contenu (tablette) : pochette, titre, artiste, Lecture/Pause, Suivant, filet de progression, en verre.
 * Gestes : un appui ou un glissé vers le haut ouvre le lecteur ; un balayage de côté change de titre (gauche :
 * suivant, droite : précédent), le contenu suit le doigt. Les boutons restent là pour qui ne glisse pas. La croix
 * arrête la lecture et vide la file (`StopButton`).
 * Rien en cours : rien du tout (la coquille ne garde aucune place).
 */

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { haptic } from "@/utils/haptics";
import { Pause, Play, SkipForward } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { GlassSurface } from "@/components/ui";
import { PlayerArtwork } from "./PlayerArtwork";
import { ProgressLine } from "./ProgressLine";
import { StopButton } from "./StopButton";
import { useOctavePlayer, usePlayerSelector } from "./OctavePlayerContext";
import { openNowPlaying } from "./nowPlayingStore";
import { decideOpen, decideSwipe, gestureAxis, rubberBand } from "./playerGestures";
import { useOctaveColors } from "../theme/octaveColors";

export interface MiniPlayerProps {
  layout: "phone" | "tablet";
}

const HEIGHT = 64;
const SPRING = { damping: 20, stiffness: 240, mass: 0.8 } as const;

export const MiniPlayer = memo(function MiniPlayer({ layout }: MiniPlayerProps) {
  const current = usePlayerSelector((s) => s.current);
  if (current === null) return null;
  return <MiniPlayerBar layout={layout} />;
});

const MiniPlayerBar = memo(function MiniPlayerBar({ layout }: MiniPlayerProps) {
  const { t } = useTranslation("music");
  const colors = useOctaveColors();
  const player = useOctavePlayer();
  const reduceMotion = useReducedMotion();
  const current = usePlayerSelector((s) => s.current);
  const wantsPlay = usePlayerSelector((s) => s.wantsPlay);
  const notice = usePlayerSelector((s) => (s.error === "noSource" ? "noSource" : s.error === "engine" ? "engineError" : s.notice));
  const hasNext = usePlayerSelector((s) => s.queue.cursor < s.queue.items.length - 1 || s.queue.repeat !== "off");
  const [width, setWidth] = useState(0);
  const offset = useSharedValue(0);
  const live = useRef({ width, hasNext, reduceMotion });
  live.current = { width, hasNext, reduceMotion };

  const change = useCallback((outcome: "next" | "previous") => {
    haptic("select");
    if (outcome === "next") player.next();
    else player.previous();
  }, [player]);

  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => gestureAxis(g.dx, g.dy) !== null,
    onPanResponderMove: (_e, g) => {
      if (gestureAxis(g.dx, g.dy) !== "horizontal") return;
      offset.value = rubberBand(g.dx, g.dx > 0 || live.current.hasNext);
    },
    onPanResponderRelease: (_e, g) => {
      const { width: w, hasNext: canNext, reduceMotion: still } = live.current;
      if (gestureAxis(g.dx, g.dy) === "vertical") {
        offset.value = withSpring(0, SPRING);
        if (decideOpen(g.dy, g.vy)) openNowPlaying();
        return;
      }
      const outcome = decideSwipe(g.dx, g.vx, w);
      if (outcome === "stay" || (outcome === "next" && !canNext) || still) {
        offset.value = withSpring(0, SPRING);
        if (outcome !== "stay" && (outcome === "previous" || canNext)) change(outcome);
        return;
      }
      const out = outcome === "next" ? -w : w;
      offset.value = withTiming(out, { duration: 150 }, (done) => {
        if (!done) return;
        runOnJS(change)(outcome);
        offset.value = -out * 0.6;
        offset.value = withSpring(0, SPRING);
      });
    },
    onPanResponderTerminate: () => {
      offset.value = withSpring(0, SPRING);
    },
  }), [offset, change]);

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
    opacity: width === 0 ? 1 : 1 - Math.min(0.6, Math.abs(offset.value) / width),
  }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const artist = current?.artists.map((a) => a.name).join(", ") ?? "";
  const subtitle = notice ? t(`player.${notice}`) : artist;

  return (
    <View onLayout={onLayout} style={[styles.outer, layout === "tablet" && styles.tablet]} {...responder.panHandlers}>
      <GlassSurface radius={20} tier="overlay" tint="strong" interactive style={styles.glass}>
        <Animated.View style={[styles.row, slide]}>
          <Pressable
            style={styles.open}
            onPress={openNowPlaying}
            accessibilityRole="button"
            accessibilityLabel={t("player.open")}
            accessibilityHint={current ? `${current.title} — ${artist}` : undefined}
          >
            <PlayerArtwork url={current?.artworkUrl} size={44} radius={10} />
            <View style={styles.texts}>
              <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{current?.title ?? ""}</Text>
              <Text numberOfLines={1} style={[styles.artist, { color: notice ? colors.accentText : colors.textSecondary }]}>{subtitle}</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => player.togglePlay()}
            hitSlop={6}
            style={({ pressed }) => [styles.button, pressed && { backgroundColor: colors.pressed }]}
            accessibilityRole="button"
            accessibilityLabel={t(wantsPlay ? "player.pause" : "player.play")}
          >
            {wantsPlay ? <Pause color={colors.text} fill={colors.text} size={22} /> : <Play color={colors.text} fill={colors.text} size={22} />}
          </Pressable>
          <Pressable
            onPress={() => player.next()}
            disabled={!hasNext}
            hitSlop={6}
            style={({ pressed }) => [styles.button, pressed && { backgroundColor: colors.pressed }, !hasNext && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel={t("player.next")}
            accessibilityState={{ disabled: !hasNext }}
          >
            <SkipForward color={colors.text} fill={colors.text} size={20} />
          </Pressable>
          <StopButton shape="close" />
        </Animated.View>
        {width > 0 && (
          <View style={styles.progress}>
            <ProgressLine width={width - 32} />
          </View>
        )}
      </GlassSurface>
    </View>
  );
});

const styles = StyleSheet.create({
  outer: {},
  tablet: { maxWidth: 720, alignSelf: "center", width: "100%" },
  glass: { height: HEIGHT, overflow: "hidden" },
  row: { flex: 1, flexDirection: "row", alignItems: "center", paddingLeft: 10, paddingRight: 4, gap: 2 },
  open: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  texts: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: "600", letterSpacing: -0.2 },
  artist: { fontSize: 13, marginTop: 2 },
  button: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.4 },
  progress: { position: "absolute", left: 16, right: 16, bottom: 4 },
});
