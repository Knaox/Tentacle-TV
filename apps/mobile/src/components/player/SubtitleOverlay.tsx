import { View, Text } from "react-native";
import { useSubtitleOverlay } from "../../hooks/useSubtitleOverlay";

interface Props {
  vttUrl: string | null;
  currentTime: number;
}

export function SubtitleOverlay({ vttUrl, currentTime }: Props) {
  const text = useSubtitleOverlay(vttUrl, currentTime);
  if (!text) return null;

  const lines = text.split("\n");

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 60,
        alignItems: "center",
        paddingHorizontal: 24,
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
