import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { colors, fonts, white } from "../../theme/tokens";
import { formatClock, fractionOf } from "./formatClock";

/**
 * La frise : le temps écoulé, la barre (en mémoire, lu, la pastille) et la
 * durée. Passive — jamais focalisable : le déplacement se pilote au pavé et
 * se montre en plein écran (`ScrubOverlay`). Le lu est la jauge AMBRE, la
 * petite touche d'accent du lecteur.
 *
 * `ghost` : où l'on vise pendant un déplacement (curseur blanc cerclé), à
 * côté de la position réelle.
 */

export const TIMELINE_WIDTH = 1920 - 2 * TV_STAGE.safe.x;
const TIME_WIDTH = 132;
const GAP = 26;
export const TRACK_WIDTH = TIMELINE_WIDTH - 2 * (TIME_WIDTH + GAP);
const BAR = 10;
const KNOB = 26;
const GHOST = 34;

export const OsdTimeline = memo(function OsdTimeline({
  position,
  duration,
  buffered,
  ghost,
  leftLabel,
}: {
  position: number;
  duration: number;
  buffered: number;
  ghost?: number | null;
  /** Remplace le temps écoulé à gauche (le défilement y montre la position réelle). */
  leftLabel?: string;
}) {
  const played = fractionOf(position, duration);
  const loaded = Math.max(played, fractionOf(buffered, duration));
  const aim = ghost != null ? fractionOf(ghost, duration) : null;
  return (
    <View style={styles.row}>
      <Text style={[styles.time, styles.elapsed]}>{leftLabel ?? formatClock(position)}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, styles.buffer, { width: `${loaded * 100}%` }]} />
        <View style={[styles.fill, styles.played, { width: `${played * 100}%` }]} />
        {aim !== null ? (
          // L'écart visé, entre la position réelle et le curseur.
          <View style={[styles.fill, styles.span, { left: Math.min(played, aim) * TRACK_WIDTH, width: Math.abs(aim - played) * TRACK_WIDTH }]} />
        ) : null}
        <View style={[styles.knob, { transform: [{ translateX: played * TRACK_WIDTH - KNOB / 2 }] }]} />
        {aim !== null ? <View style={[styles.ghost, { transform: [{ translateX: aim * TRACK_WIDTH - GHOST / 2 }] }]} /> : null}
      </View>
      <Text style={[styles.time, styles.total]}>{formatClock(duration)}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { width: TIMELINE_WIDTH, height: 40, flexDirection: "row", alignItems: "center", gap: GAP },
  time: { ...fonts.semibold, width: TIME_WIDTH, fontSize: 28, fontVariant: ["tabular-nums"] },
  elapsed: { color: colors.text },
  total: { color: white(0.8), textAlign: "right" },
  track: { width: TRACK_WIDTH, height: BAR, borderRadius: BAR / 2, backgroundColor: white(0.28) },
  fill: { position: "absolute", left: 0, top: 0, height: BAR, borderRadius: BAR / 2 },
  buffer: { backgroundColor: white(0.4) },
  played: { backgroundColor: colors.accent },
  span: { backgroundColor: white(0.78) },
  knob: {
    position: "absolute",
    left: 0,
    top: (BAR - KNOB) / 2,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.text,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  ghost: {
    position: "absolute",
    left: 0,
    top: (BAR - GHOST) / 2,
    width: GHOST,
    height: GHOST,
    borderRadius: GHOST / 2,
    borderWidth: 4,
    borderColor: colors.accent,
    backgroundColor: colors.text,
  },
});
