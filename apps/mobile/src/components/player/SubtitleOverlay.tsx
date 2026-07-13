import { StyleSheet, Text, View, useWindowDimensions, type TextStyle } from "react-native";
import { TABLET_MIN_WIDTH } from "@/theme";
import type { SubtitleSegment } from "@tentacle-tv/shared";
import { useSubtitleOverlay } from "../../hooks/useSubtitleOverlay";

interface Props {
  vttUrl: string | null;
  currentTime: number;
  headers?: Record<string, string>;
}

/**
 * Sous-titres — même rendu que le desktop (`video::cue` du web) : texte blanc
 * avec CONTOUR noir sur les lettres, aucun fond. RN n'a pas de text-stroke ni
 * de text-shadow multiple → le contour est simulé par 8 copies noires
 * superposées (±1px diagonales, ±2px cardinales), exactement le text-shadow
 * à 8 directions du CSS desktop.
 * Le formatage de la piste est INTERPRÉTÉ (parser partagé) : gras / italique /
 * souligné par segment, ancrage vertical ({\an8}/line:% → haut, \an4-6 → centré).
 */
export function SubtitleOverlay({ vttUrl, currentTime, headers }: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const cue = useSubtitleOverlay(vttUrl, currentTime, headers);
  if (!cue || cue.lines.length === 0) return null;

  // Sous-titres agrandis sur grand écran (player iPad), proportionnels au petit
  // côté du player. Taille téléphone inchangée (16).
  const isTablet = Math.min(screenW, screenH) >= TABLET_MIN_WIDTH;
  const fontSize = isTablet ? Math.round(Math.min(screenW, screenH) * 0.028) : 16;
  const lineHeight = Math.round(fontSize * 1.4);

  const edge = Math.min(60, Math.round(screenH * 0.08));
  const anchor =
    cue.anchor === "middle" ? { top: 0, bottom: 0, justifyContent: "center" as const }
      : cue.anchor === "top" ? { top: edge }
        : { bottom: edge };

  return (
    <View
      pointerEvents="none"
      style={[{
        position: "absolute",
        left: 0,
        right: 0,
        alignItems: "center",
        paddingHorizontal: Math.min(24, Math.round(screenW * 0.06)),
      }, anchor]}
    >
      {cue.lines.map((segments, i) => (
        <OutlinedLine key={i} segments={segments} fontSize={fontSize} lineHeight={lineHeight} />
      ))}
    </View>
  );
}

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

/** Une ligne de sous-titre : contour net à 8 directions (aucune boîte). Les 9
 *  copies rendent le MÊME tableau d'éléments segments → métriques identiques,
 *  contour aligné, gras/italique compris. */
function OutlinedLine({ segments, fontSize, lineHeight }: { segments: SubtitleSegment[]; fontSize: number; lineHeight: number }) {
  // Épaisseur du contour proportionnelle (1px à 16pt → 2px sur iPad).
  const o = Math.max(1, Math.round(fontSize / 16));
  const o2 = o * 2;
  const offsets: Array<[number, number]> = [
    [-o, -o], [o, -o], [-o, o], [o, o],
    [-o2, 0], [o2, 0], [0, -o2], [0, o2],
  ];
  const base = {
    fontSize,
    lineHeight,
    textAlign: "center" as const,
    fontWeight: "500" as const,
  };
  const content = segments.map((seg, i) => (
    <Text key={i} style={segmentStyle(seg)}>{seg.text}</Text>
  ));

  return (
    <View>
      {offsets.map(([dx, dy], i) => (
        <Text
          key={i}
          style={[base, StyleSheet.absoluteFillObject, {
            color: "#000",
            transform: [{ translateX: dx }, { translateY: dy }],
          }]}
        >
          {content}
        </Text>
      ))}
      <Text style={[base, { color: "#fff" }]}>{content}</Text>
    </View>
  );
}
