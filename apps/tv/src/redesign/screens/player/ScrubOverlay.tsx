import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { TV_STAGE } from "@tentacle-tv/theme";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon } from "../../icons/Icon";
import { colors, fonts, scrim } from "../../theme/tokens";
import { formatClock, formatDelta } from "./formatClock";
import { FrameView } from "./FrameView";
import { OsdTimeline } from "./OsdTimeline";
import type { PlayerTimeline, ScrubModel } from "./playerTypes";
import { SOFT_BASE } from "./surfaces";

/**
 * Le défilement plein écran, façon Netflix : l'image VISÉE remplit l'écran,
 * le temps visé en très grand avec son écart (« +12:30 »), la frise avec la
 * position réelle et le curseur visé, la vitesse (×2, ×4, ×8) en haut, et les
 * deux gestes possibles — « OK · Lire ici », « Retour · Annuler ». Rien n'y
 * est focalisable : les entrées restent au lecteur.
 */

const SAFE = TV_STAGE.safe;

function Hint({ text }: { text: string }) {
  return (
    <GlassSurface radius={26} tone="regular" style={styles.hint}>
      <Text style={styles.hintText}>{text}</Text>
    </GlassSurface>
  );
}

export const ScrubOverlay = memo(function ScrubOverlay({
  scrub,
  timeline,
  confirmLabel,
  cancelLabel,
}: {
  scrub: ScrubModel;
  timeline: PlayerTimeline;
  confirmLabel: string;
  cancelLabel: string;
}) {
  const delta = scrub.target - timeline.position;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, styles.black]} />
      {scrub.frame ? (
        <View style={StyleSheet.absoluteFill}>
          <FrameView frame={scrub.frame} />
        </View>
      ) : null}
      <LinearGradient colors={[scrim(0), scrim(0.68), scrim(0.95)]} locations={[0.4, 0.68, 1]} style={StyleSheet.absoluteFill} />
      {scrub.speed ? (
        <View style={styles.speedBox}>
          <GlassSurface radius={36} tone="regular" style={styles.speed}>
            <View style={scrub.speed.backward ? styles.mirror : null}>
              <Icon name="fastForward" size={30} color={colors.text} strokeWidth={2.4} />
            </View>
            <Text style={styles.speedText}>{`×${scrub.speed.factor}`}</Text>
          </GlassSurface>
        </View>
      ) : null}
      <View style={styles.bottom}>
        <View style={styles.aim}>
          <Text style={styles.target}>{formatClock(scrub.target)}</Text>
          {Math.abs(delta) >= 1 ? (
            <GlassSurface radius={26} tone="clear" style={styles.delta}>
              <Text style={styles.deltaText}>{formatDelta(delta)}</Text>
            </GlassSurface>
          ) : null}
        </View>
        <OsdTimeline position={timeline.position} duration={timeline.duration} buffered={timeline.buffered} ghost={scrub.target} />
        <View style={styles.hints}>
          <Hint text={confirmLabel} />
          <Hint text={cancelLabel} />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  black: { backgroundColor: "#000" },
  speedBox: { position: "absolute", top: SAFE.y + 12, left: 0, right: 0, alignItems: "center" },
  speed: { flexDirection: "row", alignItems: "center", gap: 14, height: 72, paddingHorizontal: 32, backgroundColor: SOFT_BASE },
  mirror: { transform: [{ scaleX: -1 }] },
  speedText: { ...fonts.extrabold, fontSize: 36, color: colors.text, fontVariant: ["tabular-nums"] },
  bottom: { position: "absolute", left: SAFE.x, right: SAFE.x, bottom: SAFE.y, alignItems: "center", gap: 26 },
  aim: { flexDirection: "row", alignItems: "center", gap: 22 },
  target: { ...fonts.extrabold, fontSize: 80, lineHeight: 88, letterSpacing: -1, color: colors.text, fontVariant: ["tabular-nums"] },
  delta: { height: 52, paddingHorizontal: 22, justifyContent: "center", backgroundColor: SOFT_BASE },
  deltaText: { ...fonts.bold, fontSize: 30, color: colors.text, fontVariant: ["tabular-nums"] },
  hints: { flexDirection: "row", gap: 18, marginTop: 4 },
  hint: { height: 52, paddingHorizontal: 26, justifyContent: "center", backgroundColor: SOFT_BASE },
  hintText: { ...fonts.semibold, fontSize: 24, color: colors.textSecondary },
});
