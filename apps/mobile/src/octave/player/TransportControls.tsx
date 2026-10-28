/**
 * Octave (mobile) — les commandes du lecteur plein écran : aléatoire, précédent, LECTURE (le grand rond au
 * dégradé de la marque), suivant, répétition. L'état actif d'aléatoire et de répétition se dit par la couleur
 * ET par un point sous l'icône (jamais la couleur seule). Zones tactiles ≥ 44 pt, espacées ; chaque bouton
 * s'enfonce à l'appui (`PressableScale`, ressort).
 */

import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { ZoomIn, ZoomOut } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { haptic } from "@/utils/haptics";
import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { queueActions } from "@tentacle-tv/shared/octave";
import { useOctavePlayer, usePlayerSelector } from "./OctavePlayerContext";
import { PressableScale } from "../layout/PressableScale";
import { useOctaveColors } from "../theme/octaveColors";

export const TransportControls = memo(function TransportControls({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("music");
  const colors = useOctaveColors();
  const player = useOctavePlayer();
  const wantsPlay = usePlayerSelector((s) => s.wantsPlay);
  const shuffle = usePlayerSelector((s) => s.queue.shuffle);
  const repeat = usePlayerSelector((s) => s.queue.repeat);
  const hasNext = usePlayerSelector((s) => s.queue.cursor < s.queue.items.length - 1 || s.queue.repeat !== "off");
  const big = compact ? 64 : 76;
  const tap = (fn: () => void) => () => {
    haptic("tap");
    fn();
  };
  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;
  const repeatLabel = repeat === "off" ? "player.repeatOff" : repeat === "all" ? "player.repeatAll" : "player.repeatOne";

  return (
    <View style={styles.row}>
      <Toggle active={shuffle} label={t(shuffle ? "player.shuffleOff" : "player.shuffleOn")} onPress={() => queueActions.toggleShuffle(player)}>
        <Shuffle size={22} color={shuffle ? colors.accentText : colors.textSecondary} />
      </Toggle>
      <PressableScale onPress={tap(() => player.previous())} pressedScale={0.86} style={styles.side} accessibilityRole="button" accessibilityLabel={t("player.previous")}>
        <SkipBack size={30} color={colors.text} fill={colors.text} />
      </PressableScale>
      <PressableScale
        onPress={tap(() => player.togglePlay())}
        pressedScale={0.92}
        style={[{ width: big, height: big, borderRadius: big / 2 }, styles.main]}
        accessibilityRole="button"
        accessibilityLabel={t(wantsPlay ? "player.pause" : "player.play")}
      >
        <LinearGradient colors={[colors.gradient[0], colors.gradient[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: big / 2 }]} />
        {/* Lecture ↔ Pause : l'icône passe en fondu, avec une ombre d'échelle (jamais un saut net). */}
        <Animated.View key={wantsPlay ? "pause" : "play"} entering={ZoomIn.duration(160)} exiting={ZoomOut.duration(110)} style={styles.glyph}>
          {wantsPlay ? <Pause size={big * 0.42} color="#fff" fill="#fff" /> : <Play size={big * 0.42} color="#fff" fill="#fff" style={styles.playNudge} />}
        </Animated.View>
      </PressableScale>
      <PressableScale
        onPress={tap(() => player.next())}
        disabled={!hasNext}
        pressedScale={0.86}
        style={[styles.side, !hasNext && styles.disabled]}
        accessibilityRole="button"
        accessibilityLabel={t("player.next")}
        accessibilityState={{ disabled: !hasNext }}
      >
        <SkipForward size={30} color={colors.text} fill={colors.text} />
      </PressableScale>
      <Toggle active={repeat !== "off"} label={t(repeatLabel)} onPress={() => queueActions.cycleRepeat(player)}>
        <RepeatIcon size={22} color={repeat !== "off" ? colors.accentText : colors.textSecondary} />
      </Toggle>
    </View>
  );
});

function Toggle({ active, label, onPress, children }: { active: boolean; label: string; onPress: () => void; children: ReactNode }) {
  const colors = useOctaveColors();
  return (
    <PressableScale onPress={onPress} pressedScale={0.88} style={styles.toggle} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }}>
      {children}
      <View style={[styles.dot, { backgroundColor: active ? colors.accentText : "transparent" }]} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  side: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  toggle: { width: 44, height: 48, alignItems: "center", justifyContent: "center" },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 4 },
  main: { alignItems: "center", justifyContent: "center", overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  glyph: { alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.35 },
  playNudge: { marginLeft: 4 },
});
