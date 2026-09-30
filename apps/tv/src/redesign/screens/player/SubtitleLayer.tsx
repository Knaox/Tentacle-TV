import { memo } from "react";
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";
import type { SubtitleCue, SubtitleSegment } from "@tentacle-tv/shared";

/**
 * Les sous-titres texte, en calque : blanc cerné de noir, sans bandeau — le
 * rendu du lecteur actuel (`TVSubtitleOverlay`), à la taille du salon. En bas
 * par défaut, RELEVÉS au-dessus de la frise quand l'habillage est là ; en
 * haut ou au milieu quand la cue le demande ({\an8}, line:%).
 *
 * Le contour : huit copies décalées sous la copie blanche, au rapport du web
 * (1/20,8 du corps en diagonale, 2/20,8 en cardinal), sans arrondi.
 */

const FONT_SIZE = 44;
const BASE: TextStyle = { fontSize: FONT_SIZE, lineHeight: Math.round(FONT_SIZE * 1.34), textAlign: "center", fontWeight: "500" };
const O = FONT_SIZE / 20.8;
const O2 = (FONT_SIZE * 2) / 20.8;
const OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-O, -O], [O, -O], [-O, O], [O, O],
  [-O2, 0], [O2, 0], [0, -O2], [0, O2],
];

function segmentStyle(segment: SubtitleSegment): TextStyle | undefined {
  if (!segment.bold && !segment.italic && !segment.underline) return undefined;
  return {
    fontWeight: segment.bold ? "800" : undefined,
    fontStyle: segment.italic ? "italic" : undefined,
    textDecorationLine: segment.underline ? "underline" : undefined,
  };
}

const Line = memo(function Line({ segments }: { segments: SubtitleSegment[] }) {
  const content = segments.map((segment, i) => (
    <Text key={i} style={segmentStyle(segment)}>{segment.text}</Text>
  ));
  return (
    <View>
      {OFFSETS.map(([dx, dy], i) => (
        <Text key={i} style={[BASE, StyleSheet.absoluteFillObject, styles.outline, { transform: [{ translateX: dx }, { translateY: dy }] }]}>
          {content}
        </Text>
      ))}
      <Text style={[BASE, styles.fill]}>{content}</Text>
    </View>
  );
});

export const SubtitleLayer = memo(function SubtitleLayer({ cue, raised }: { cue: SubtitleCue; raised: boolean }) {
  if (cue.lines.length === 0) return null;
  const anchor: ViewStyle =
    cue.anchor === "middle"
      ? { top: 0, bottom: 0, justifyContent: "center" }
      : cue.anchor === "top"
        ? { top: raised ? 230 : 64 }
        : { bottom: raised ? 300 : 72 };
  return (
    <View pointerEvents="none" style={[styles.layer, anchor]}>
      {cue.lines.slice(0, 3).map((segments, i) => (
        <Line key={i} segments={segments} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  layer: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: 160 },
  outline: { color: "#000" },
  fill: { color: "#fff" },
});
