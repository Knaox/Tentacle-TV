import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";

interface Props {
  message: string;
  onRetry: () => void;
  onBack: () => void;
}

export function PlayerErrorView({ message, onRetry, onBack }: Props) {
  const { t } = useTranslation("player");

  return (
    <View style={{
      flex: 1, justifyContent: "center", alignItems: "center",
      padding: 32, backgroundColor: "#000",
    }}>
      {/* Error icon */}
      <View style={{
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: "rgba(239, 68, 68, 0.15)",
        justifyContent: "center", alignItems: "center", marginBottom: 16,
      }}>
        <Text style={{ color: "#ef4444", fontSize: 24 }}>!</Text>
      </View>

      <Text style={{
        color: "#fff", fontSize: 16, textAlign: "center",
        marginBottom: 24, lineHeight: 22,
      }}>
        {message}
      </Text>

      <Pressable
        onPress={onRetry}
        style={{
          backgroundColor: "#8b5cf6", paddingHorizontal: 32,
          paddingVertical: 12, borderRadius: 10,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
          {t("retry")}
        </Text>
      </Pressable>

      <Pressable onPress={onBack} style={{ marginTop: 16, padding: 8 }}>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
          {t("back")}
        </Text>
      </Pressable>
    </View>
  );
}
