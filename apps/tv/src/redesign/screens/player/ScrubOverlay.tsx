import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { SoftGradient, STAGE_SIZE } from "../../background/SoftGradient";
import { GlassSurface } from "../../glass/GlassSurface";
import { useNativeGlassBacking } from "../../glass/glassBacking";
import { Icon } from "../../icons/Icon";
import { colors, fonts, scrim, white } from "../../theme/tokens";
import { formatClock, formatDelta, fractionOf } from "./formatClock";
import { FrameView } from "./FrameView";
import { GHOST, OsdTimeline, TIMELINE_ROW, TIMELINE_TOP, TRACK_LEFT, TRACK_WIDTH } from "./OsdTimeline";
import type { PlayerTimeline, ScrubModel } from "./playerTypes";
import { SOFT_BASE } from "./surfaces";

/**
 * Le DÉFILEMENT, comme le lecteur d'Apple (et Netflix sur Apple TV) : la
 * vidéo reste là, figée où l'on était ; la frise, à sa place de l'habillage,
 * montre la position réelle (pastille) et le curseur visé ; au-dessus du
 * curseur, qui le SUIT, une bulle : la vignette de l'image visée (trickplay),
 * puis le temps visé en grand et l'écart (« +12:30 »). La vitesse d'un
 * maintien (×2, ×4, ×8) se lit sur la vignette. En bas, les deux gestes :
 * « OK · Lire ici », « Retour · Annuler ». Sans vignette (serveur sans
 * trickplay), la bulle n'a que le temps.
 *
 * Rien n'y est focalisable : les entrées restent au lecteur. Mouvement : la
 * vue paraît et s'efface en fondu (`appear`, préréglage `reveal`), la bulle
 * monte de quelques points en paraissant ; elle suit le curseur sans délai
 * (un `transform`) — le doigt mène.
 */

const SAFE = TV_STAGE.safe;
/** La vignette : 16:9, un peu plus d'un cinquième de l'écran. */
const THUMB_W = 432;
const THUMB_H = 243;
const THUMB_RADIUS = 18;
/** Le temps visé, sous la vignette. */
const TIME_ROW = 64;
const GAP = 12;
/** Le bas de la bulle : au-dessus du curseur visé, à distance. */
const BUBBLE_BOTTOM = TIMELINE_TOP + TIMELINE_ROW / 2 - GHOST / 2 - 14;
/** Ce que la bulle monte en paraissant. */
const RISE = 16;

/** Le bord gauche de la bulle : centrée sur le curseur, gardée dans la zone sûre. */
export function bubbleLeft(aim: number): number {
  const center = TRACK_LEFT + aim * TRACK_WIDTH;
  return Math.min(STAGE_SIZE.width - SAFE.x - THUMB_W, Math.max(SAFE.x, center - THUMB_W / 2));
}

function Hint({ text }: { text: string }) {
  const backing = useNativeGlassBacking("regular");
  return (
    <GlassSurface radius={26} tone="regular" style={[styles.hint, backing]}>
      <Text style={styles.hintText}>{text}</Text>
    </GlassSurface>
  );
}

function SpeedChip({ speed }: { speed: NonNullable<ScrubModel["speed"]> }) {
  const backing = useNativeGlassBacking("regular");
  return (
    <GlassSurface radius={20} tone="regular" style={[styles.speed, backing]}>
      <View style={speed.backward ? styles.mirror : null}>
        <Icon name="fastForward" size={24} color={colors.text} strokeWidth={2.4} />
      </View>
      <Text style={styles.speedText}>{`×${speed.factor}`}</Text>
    </GlassSurface>
  );
}

export const ScrubOverlay = memo(function ScrubOverlay({
  scrub,
  timeline,
  confirmLabel,
  cancelLabel,
  appear,
}: {
  scrub: ScrubModel;
  timeline: PlayerTimeline;
  confirmLabel: string;
  cancelLabel: string;
  /** 0 → 1 : l'entrée de la vue, puis sa sortie (`Presented`). */
  appear?: SharedValue<number>;
}) {
  const delta = scrub.target - timeline.position;
  const clearBacking = useNativeGlassBacking("clear");
  const fade = useAnimatedStyle(() => ({ opacity: appear ? appear.value : 1 }));
  const rise = useAnimatedStyle(() => ({ transform: [{ translateY: RISE * (1 - (appear ? appear.value : 1)) }] }));
  const left = bubbleLeft(fractionOf(scrub.target, timeline.duration));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, fade]} pointerEvents="none">
      <SoftGradient {...STAGE_SIZE} colors={[scrim(0), scrim(0.62), scrim(0.94)]} locations={[0.34, 0.7, 1]} />
      <View style={[styles.bubble, { transform: [{ translateX: left }] }]}>
        <Animated.View style={[styles.bubbleInner, rise]}>
          {scrub.frame ? (
            <View style={styles.thumbShadow}>
              <View style={styles.thumb}>
                <FrameView frame={scrub.frame} width={THUMB_W} height={THUMB_H} />
                {scrub.speed ? (
                  <View style={styles.speedBox}>
                    <SpeedChip speed={scrub.speed} />
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}
          <View style={styles.timeRow}>
            <Text style={styles.target}>{formatClock(scrub.target)}</Text>
            {Math.abs(delta) >= 1 ? (
              <GlassSurface radius={23} tone="clear" style={[styles.delta, clearBacking]}>
                <Text style={styles.deltaText}>{formatDelta(delta)}</Text>
              </GlassSurface>
            ) : null}
            {scrub.speed && !scrub.frame ? <SpeedChip speed={scrub.speed} /> : null}
          </View>
        </Animated.View>
      </View>
      <View style={styles.timeline}>
        <OsdTimeline
          position={timeline.position}
          duration={timeline.duration}
          buffered={timeline.buffered}
          ghost={scrub.target}
          segments={timeline.segments}
        />
      </View>
      <View style={styles.hints}>
        <Hint text={confirmLabel} />
        <Hint text={cancelLabel} />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  bubble: { position: "absolute", left: 0, width: THUMB_W, top: BUBBLE_BOTTOM - THUMB_H - GAP - TIME_ROW },
  bubbleInner: { width: THUMB_W, height: THUMB_H + GAP + TIME_ROW, justifyContent: "flex-end", alignItems: "center", gap: GAP },
  // L'ombre sur un fond plein : calculée sur le cadre, pas au pixel.
  thumbShadow: {
    borderRadius: THUMB_RADIUS,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
  },
  thumb: {
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: THUMB_RADIUS,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: white(0.92),
  },
  speedBox: { position: "absolute", top: 12, left: 12 },
  speed: { flexDirection: "row", alignItems: "center", gap: 8, height: 40, paddingHorizontal: 14, backgroundColor: SOFT_BASE },
  mirror: { transform: [{ scaleX: -1 }] },
  speedText: { ...fonts.extrabold, fontSize: 24, color: colors.text, fontVariant: ["tabular-nums"] },
  timeRow: { height: TIME_ROW, flexDirection: "row", alignItems: "center", gap: 16 },
  target: {
    ...fonts.extrabold,
    fontSize: 60,
    lineHeight: TIME_ROW,
    letterSpacing: -1,
    color: colors.text,
    fontVariant: ["tabular-nums"],
    textShadowColor: scrim(0.55),
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  delta: { height: 46, paddingHorizontal: 18, justifyContent: "center", backgroundColor: SOFT_BASE },
  deltaText: { ...fonts.bold, fontSize: 28, color: colors.text, fontVariant: ["tabular-nums"] },
  timeline: { position: "absolute", left: SAFE.x, right: SAFE.x, top: TIMELINE_TOP },
  hints: { position: "absolute", left: 0, right: 0, top: TIMELINE_TOP + 86, flexDirection: "row", justifyContent: "center", gap: 18 },
  hint: { height: 52, paddingHorizontal: 26, justifyContent: "center", backgroundColor: SOFT_BASE },
  hintText: { ...fonts.semibold, fontSize: 24, color: colors.textSecondary },
});
