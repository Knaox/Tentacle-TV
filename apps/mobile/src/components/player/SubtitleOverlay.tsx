import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { TABLET_MIN_WIDTH } from "@/theme";
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
 */
export function SubtitleOverlay({ vttUrl, currentTime, headers }: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const text = useSubtitleOverlay(vttUrl, currentTime, headers);
  if (!text) return null;

  const lines = text.split("\n");
  // Sous-titres agrandis sur grand écran (player iPad), proportionnels au petit
  // côté du player. Taille téléphone inchangée (16).
  const isTablet = Math.min(screenW, screenH) >= TABLET_MIN_WIDTH;
  const fontSize = isTablet ? Math.round(Math.min(screenW, screenH) * 0.028) : 16;
  const lineHeight = Math.round(fontSize * 1.4);

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: Math.min(60, Math.round(screenH * 0.08)),
        alignItems: "center",
        paddingHorizontal: Math.min(24, Math.round(screenW * 0.06)),
      }}
    >
      {lines.map((line, i) => (
        <OutlinedLine key={i} text={line} fontSize={fontSize} lineHeight={lineHeight} />
      ))}
    </View>
  );
}

/** Une ligne de sous-titre : contour net à 8 directions (aucune boîte). */
function OutlinedLine({ text, fontSize, lineHeight }: { text: string; fontSize: number; lineHeight: number }) {
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
          {text}
        </Text>
      ))}
      <Text style={[base, { color: "#fff" }]}>{text}</Text>
    </View>
  );
}
