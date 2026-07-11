import { View, Text, useWindowDimensions } from "react-native";
import { TABLET_MIN_WIDTH } from "@/theme";
import { useSubtitleOverlay } from "../../hooks/useSubtitleOverlay";

interface Props {
  vttUrl: string | null;
  currentTime: number;
  headers?: Record<string, string>;
}

export function SubtitleOverlay({ vttUrl, currentTime, headers }: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const text = useSubtitleOverlay(vttUrl, currentTime, headers);
  if (!text) return null;

  const lines = text.split("\n");
  // Sous-titres agrandis sur grand écran (player iPad), proportionnels au petit
  // côté du player. Taille téléphone inchangée (16).
  const isTablet = Math.min(screenW, screenH) >= TABLET_MIN_WIDTH;
  const fontSize = isTablet ? Math.round(Math.min(screenW, screenH) * 0.028) : 16;
  const lineHeight = Math.round(fontSize * 1.375);

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
      <View
        style={{
          backgroundColor: "rgba(0,0,0,0.5)",
          borderRadius: 4,
          paddingHorizontal: 12,
          paddingVertical: 4,
        }}
      >
        {lines.map((line, i) => (
          <Text
            key={i}
            style={{
              color: "#fff",
              fontSize,
              textAlign: "center",
              lineHeight,
            }}
          >
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}
