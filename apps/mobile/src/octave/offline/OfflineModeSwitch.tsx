/**
 * Octave (mobile) — la bascule « Mode hors ligne » de « Sur cet appareil » : on
 * s'y met AVANT de monter dans l'avion, et l'état se lit d'un coup d'œil (disque
 * rose allumé, phrase qui dit pourquoi). Même magasin et même clé que la bascule
 * de Tentacle (`setManualOffline`) : le mode vaut pour toute l'application.
 *
 * Hors ligne SUBI (réseau ou serveur absent), l'interrupteur reste allumé et
 * figé : repasser en ligne n'est pas en notre pouvoir, la sonde s'en charge.
 */

import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { BrandSwitch } from "@/components/settings";
import { setManualOffline } from "@/offline/connectivityStore";
import { useConnectivity } from "@/offline/useConnectivity";
import { useOctaveColors } from "../theme/octaveColors";

export const OfflineModeSwitch = memo(function OfflineModeSwitch() {
  const { t } = useTranslation("musicOffline");
  const colors = useOctaveColors();
  const { state } = useConnectivity();
  const forced = state === "offline-auto";
  const on = forced || state === "offline-manual";
  const hint = forced ? t("mode.forced") : on ? t("mode.on") : t("mode.off");
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={t("mode.label")}
      accessibilityHint={hint}
      accessibilityState={{ checked: on, disabled: forced }}
      disabled={forced}
      onPress={() => setManualOffline(!on)}
      style={[styles.row, { backgroundColor: colors.raised, borderColor: on ? colors.accentSoft : colors.line }]}
    >
      <View style={[styles.disc, { backgroundColor: on ? colors.accentSoft : colors.pressed }]}>
        <Feather name="wifi-off" size={18} color={on ? colors.accentText : colors.textTertiary} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.label, { color: colors.text }]}>{t("mode.label")}</Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{hint}</Text>
      </View>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <BrandSwitch value={on} disabled={forced} onValueChange={(next) => setManualOffline(next)} accessibilityLabel={t("mode.label")} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  disc: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontSize: 16, fontWeight: "600" },
  hint: { fontSize: 13, lineHeight: 18 },
});
