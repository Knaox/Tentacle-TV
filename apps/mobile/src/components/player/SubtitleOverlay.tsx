import { View, Text, useWindowDimensions } from "react-native";
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
              fontSize: 16,
              textAlign: "center",
              lineHeight: 22,
            }}
          >
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}
