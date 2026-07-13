import { memo } from "react";
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";
import type { SubtitleCue, SubtitleSegment } from "@tentacle-tv/shared";

export type { SubtitleCue } from "@tentacle-tv/shared";

interface TVSubtitleOverlayProps {
  /** Cue courante (null = rien à afficher) */
  cue: SubtitleCue | null;
  /** OSD affiché → écarter les sous-titres des contrôles (bas) et du titre (haut) */
  osdVisible: boolean;
}

// Style de base — police SYSTÈME (aucun fontFamily) : même rendu que
// l'overlay mobile / le video::cue du web. Poids medium homogène.
const FONT_SIZE = 30;
const BASE: TextStyle = {
  fontSize: FONT_SIZE,
  lineHeight: 42,
  textAlign: "center",
  fontWeight: "500",
};

// Contour noir : 8 copies noires décalées sous la copie blanche (±o en
// diagonale, ±2o en cardinal) — équivalent RN du text-shadow 8 directions du
// web/desktop. Même formule d'épaisseur que le mobile (1 px à 16 pt).
const O = Math.max(1, Math.round(FONT_SIZE / 16));
const O2 = O * 2;
const OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-O, -O], [O, -O], [-O, O], [O, O],
  [-O2, 0], [O2, 0], [0, -O2], [0, O2],
];

/** Style d'un segment (gras/italique/souligné) — jamais de couleur ici :
 *  héritée du <Text> parent (#000 copies de contour, #fff au-dessus). */
function segmentStyle(seg: SubtitleSegment): TextStyle | undefined {
  if (!seg.bold && !seg.italic && !seg.underline) return undefined;
  const style: TextStyle = {};
  if (seg.bold) style.fontWeight = "800";
  if (seg.italic) style.fontStyle = "italic";
  if (seg.underline) style.textDecorationLine = "underline";
  return style;
}

/**
 * Une ligne de sous-titre : les 9 copies rendent le MÊME tableau d'éléments
 * segments (styles identiques ⇒ métriques identiques ⇒ contour aligné, gras
 * et italique compris — y compris quand la ligne wrappe).
 */
const OutlinedLine = memo(function OutlinedLine({ segments }: { segments: SubtitleSegment[] }) {
  const content = segments.map((seg, i) => (
    <Text key={i} style={segmentStyle(seg)}>{seg.text}</Text>
  ));
  return (
    <View>
      {OFFSETS.map(([dx, dy], i) => (
        <Text
          key={i}
          style={[BASE, StyleSheet.absoluteFillObject, {
            color: "#000",
            transform: [{ translateX: dx }, { translateY: dy }],
          }]}
        >
          {content}
        </Text>
      ))}
      <Text style={[BASE, { color: "#fff" }]}>{content}</Text>
    </View>
  );
});

/**
 * Rendu JS des sous-titres texte (cf. useTVSubtitles) — le player natif
 * n'est jamais rechargé pour les sous-titres. Texte blanc à contour noir,
 * SANS bandeau (parité mobile/desktop) ; gras/italique/souligné et ancrage
 * vertical interprétés (dialogue en bas, {\an8}/line:% en haut ou centré).
 */
export const TVSubtitleOverlay = memo(function TVSubtitleOverlay({ cue, osdVisible }: TVSubtitleOverlayProps) {
  if (!cue || cue.lines.length === 0) return null;
  const anchor: ViewStyle =
    cue.anchor === "middle" ? { top: 0, bottom: 0, justifyContent: "center" }
      : cue.anchor === "top" ? { top: osdVisible ? 150 : 56 }
        : { bottom: osdVisible ? 210 : 56 };
  return (
    <View
      pointerEvents="none"
      style={[{
        position: "absolute", left: 0, right: 0,
        alignItems: "center",
        paddingHorizontal: 120,
        zIndex: 40, elevation: 40,
      }, anchor]}
    >
      {cue.lines.map((segments, i) => (
        <OutlinedLine key={i} segments={segments} />
      ))}
    </View>
  );
});
