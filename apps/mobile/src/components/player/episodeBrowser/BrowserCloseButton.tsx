import { Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react-native";
import { EB, EB_HIT } from "./browserTokens";

/** Fermer la liste : un rond discret, la cible tactile de la plateforme autour. */
export function BrowserCloseButton({ onPress, size = 30 }: { onPress: () => void; size?: number }) {
  const { t } = useTranslation("player");
  const slop = Math.max(0, (EB_HIT - size) / 2);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={slop}
      accessibilityRole="button"
      accessibilityLabel={t("close")}
      style={({ pressed }) => [st.button, { width: size, height: size, borderRadius: size / 2 }, pressed && st.pressed]}
    >
      <X size={Math.round(size * 0.55)} color={EB.label} strokeWidth={2.4} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  button: { alignItems: "center", justifyContent: "center", backgroundColor: EB.fillStrong },
  pressed: { backgroundColor: "rgba(255, 255, 255, 0.24)" },
});
