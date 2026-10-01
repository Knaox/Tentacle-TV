import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { BrandGradient } from "../../brand/BrandGradient";
import { colors, fonts, white } from "../../theme/tokens";
import { formatClock, fractionOf } from "./formatClock";
import type { TimelineSegment } from "./playerTypes";

/**
 * La frise : le temps écoulé, la barre (en mémoire, lu, la pastille) et la
 * durée. Passive — jamais focalisable : le déplacement se pilote aux flèches
 * et au pavé, et se montre sur elle, la vignette visée au-dessus du curseur
 * (`ScrubOverlay`). Le lu porte le dégradé de la
 * marque, violet → rose, comme la barre du lecteur du bureau
 * (`--progress-fill`) : le rose arrive TOUJOURS à la tête de lecture.
 *
 * `ghost` : où l'on vise pendant un déplacement (curseur blanc cerclé), à
 * côté de la position réelle.
 *
 * `segments` : les passages connus (intro, résumé, générique) COUPENT la barre
 * à leurs bords, comme des chapitres — une forme, pas une couleur : la coupure
 * se lit sans distinguer les teintes, et ne dispute rien au lu. Sans passage,
 * la barre est d'un seul tenant.
 */

export const TIMELINE_WIDTH = 1920 - 2 * TV_STAGE.safe.x;
/** Le haut de la rangée de la frise, à la même place dans l'habillage et dans
 *  le défilement : elle ne saute pas quand on passe de l'un à l'autre. */
export const TIMELINE_TOP = 818;
/** La hauteur de la rangée ; la barre et les curseurs y sont centrés. */
export const TIMELINE_ROW = 40;
const TIME_WIDTH = 132;
const GAP = 26;
export const TRACK_WIDTH = TIMELINE_WIDTH - 2 * (TIME_WIDTH + GAP);
/** Le bord gauche de la barre, sur la scène de 1920 : ce que vise un curseur. */
export const TRACK_LEFT = TV_STAGE.safe.x + TIME_WIDTH + GAP;
const BAR = 10;
const KNOB = 26;
/** Le curseur visé du défilement : son diamètre. */
export const GHOST = 34;
/** La coupure entre deux morceaux de barre. */
const CUT = 4;
/** Un bord à moins de 0,5 % d'une extrémité ne coupe rien (passage qui ouvre ou clôt le média). */
const EDGE = 0.005;
/** Deux bords à moins de 1 % l'un de l'autre font UNE coupure (résumé suivi de l'intro). */
const APART = 0.01;

/** Les coupures de la barre, en fractions de la durée, dans l'ordre. */
export function timelineCuts(segments: readonly TimelineSegment[] | undefined, duration: number): number[] {
  if (!segments?.length || !(duration > 0)) return [];
  const edges = segments
    .flatMap((segment) => [segment.start / duration, segment.end / duration])
    .filter((edge) => edge > EDGE && edge < 1 - EDGE)
    .sort((a, b) => a - b);
  const cuts: number[] = [];
  for (const edge of edges) if (!cuts.length || edge - cuts[cuts.length - 1] > APART) cuts.push(edge);
  return cuts;
}

/** Un morceau de barre, entre deux coupures : son fond, et ce qui en est en mémoire, lu, visé. */
function Piece({ from, to, loaded, played, span }: {
  from: number;
  to: number;
  loaded: number;
  played: number;
  span: [number, number] | null;
}) {
  const left = from * TRACK_WIDTH + (from > 0 ? CUT / 2 : 0);
  const width = to * TRACK_WIDTH - (to < 1 ? CUT / 2 : 0) - left;
  const extent = (fraction: number) => Math.min(width, Math.max(0, fraction * TRACK_WIDTH - left));
  const spanStart = span ? extent(span[0]) : 0;
  const spanEnd = span ? extent(span[1]) : 0;
  return (
    <View style={[styles.piece, { left, width }]}>
      <View style={[styles.fill, styles.buffer, { width: extent(loaded) }]} />
      <View style={[styles.fill, styles.played, { width: extent(played) }]}>
        {/* Le dégradé court sur tout le LU (et non sur toute la frise, qui
            restait violette sur la première moitié d'un film) : chaque morceau
            n'en montre que sa part. */}
        <BrandGradient style={{ left: -left, width: Math.max(1, played * TRACK_WIDTH), right: undefined }} />
      </View>
      {spanEnd > spanStart ? <View style={[styles.fill, styles.span, { left: spanStart, width: spanEnd - spanStart }]} /> : null}
    </View>
  );
}

export const OsdTimeline = memo(function OsdTimeline({
  position,
  duration,
  buffered,
  ghost,
  leftLabel,
  segments,
}: {
  position: number;
  duration: number;
  buffered: number;
  ghost?: number | null;
  /** Remplace le temps écoulé à gauche (le défilement y montre la position réelle). */
  leftLabel?: string;
  segments?: readonly TimelineSegment[];
}) {
  const played = fractionOf(position, duration);
  const loaded = Math.max(played, fractionOf(buffered, duration));
  const aim = ghost != null ? fractionOf(ghost, duration) : null;
  // L'écart visé, entre la position réelle et le curseur.
  const span: [number, number] | null = aim !== null ? [Math.min(played, aim), Math.max(played, aim)] : null;
  const bounds = [0, ...timelineCuts(segments, duration), 1];
  return (
    <View style={styles.row}>
      <Text style={[styles.time, styles.elapsed]}>{leftLabel ?? formatClock(position)}</Text>
      <View style={styles.track}>
        {bounds.slice(1).map((to, index) => (
          <Piece key={index} from={bounds[index]} to={to} loaded={loaded} played={played} span={span} />
        ))}
        <View style={[styles.knob, { transform: [{ translateX: played * TRACK_WIDTH - KNOB / 2 }] }]} />
        {aim !== null ? <View style={[styles.ghost, { transform: [{ translateX: aim * TRACK_WIDTH - GHOST / 2 }] }]} /> : null}
      </View>
      <Text style={[styles.time, styles.total]}>{formatClock(duration)}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { width: TIMELINE_WIDTH, height: TIMELINE_ROW, flexDirection: "row", alignItems: "center", gap: GAP },
  time: { ...fonts.semibold, width: TIME_WIDTH, fontSize: 28, fontVariant: ["tabular-nums"] },
  elapsed: { color: colors.text },
  total: { color: white(0.8), textAlign: "right" },
  track: { width: TRACK_WIDTH, height: BAR },
  piece: { position: "absolute", top: 0, height: BAR, borderRadius: BAR / 2, backgroundColor: white(0.28) },
  fill: { position: "absolute", left: 0, top: 0, height: BAR, borderRadius: BAR / 2 },
  buffer: { backgroundColor: white(0.4) },
  played: { overflow: "hidden" },
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
