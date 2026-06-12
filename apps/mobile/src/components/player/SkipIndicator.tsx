import { View, Text, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";

/**
 * Indicateur éphémère « +30 / −10 » après un saut (double-tap gestes ou
 * boutons de l'overlay) — rond latéral côté du sens du saut.
 */
export function SkipIndicator({ side }: { side: "left" | "right" | null }) {
  const { t } = useTranslation("player");
  const { width: screenW, height: screenH } = useWindowDimensions();
  const size = Math.min(72, Math.round(screenH * 0.09));
  if (!side) return null;

  return (
    <View pointerEvents="none" style={{
      position: "absolute", top: "38%",
      [side === "left" ? "left" : "right"]: screenW * 0.08,
      backgroundColor: "rgba(0,0,0,0.5)", borderRadius: size / 2,
      width: size, height: size, justifyContent: "center", alignItems: "center",
    }}>
      <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}>
        {side === "left" ? "-10" : "+30"}
      </Text>
      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{t("secondsShort")}</Text>
    </View>
  );
}
