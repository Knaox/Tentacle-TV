import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useOfflineActivity } from "@/hooks/offline/useOfflineList";
import { useOfflineVisibility } from "@/hooks/offline/useOfflineVisibility";
import { useTheme } from "@/theme";
import { PulseDot } from "./PulseDot";

/**
 * L'icône « Sur cet appareil » de l'en-tête flottant, avec un point lumineux
 * qui pulse pendant un transfert : un transfert en cours se voit d'un coup
 * d'œil depuis n'importe quel onglet. Invisible sans droit ni contenu.
 */
export function OnDeviceHeaderButton() {
  const { t } = useTranslation("offline");
  const { colors } = useTheme();
  const router = useRouter();
  const { visible } = useOfflineVisibility();
  const { active } = useOfflineActivity();
  if (!visible) return null;
  const label = active > 0 ? `${t("a11yOnDeviceButton")}, ${t("a11yTransferActive")}` : t("a11yOnDeviceButton");
  return (
    <Pressable onPress={() => router.push("/on-device")} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}>
      <View collapsable={false} style={styles.wrap}>
        <Feather name="smartphone" size={20} color={colors.text.primary} />
        {active > 0 && <PulseDot size={8} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
});
