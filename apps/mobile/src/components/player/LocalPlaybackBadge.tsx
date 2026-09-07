import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { PLAYER } from "@/theme";

interface Props {
  visible: boolean;
}

/** La pastille « Lecture locale », avec les contrôles : ce titre se lit depuis l'appareil. */
export function LocalPlaybackBadge({ visible }: Props) {
  const { t } = useTranslation("downloads");
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={[styles.badge, { top: Math.max(12, insets.top) + 44, right: Math.max(16, insets.right) }]}>
      <Feather name="smartphone" size={12} color={PLAYER.text} />
      <Text style={styles.text}>{t("localPlayback")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  text: { color: PLAYER.text, fontSize: 11, fontWeight: "600", letterSpacing: 0.3 },
});
