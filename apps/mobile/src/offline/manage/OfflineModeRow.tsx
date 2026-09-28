import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { BrandSwitch } from "@/components/settings";
import { FONT_FAMILY, RADIUS, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { setManualOffline } from "../connectivityStore";
import { useConnectivity } from "../useConnectivity";

/**
 * La bascule « Mode hors ligne » de l'écran de gestion.
 *
 * Le passage manuel vivait dans le profil (« Passer hors ligne ») et dans la
 * bulle de la pastille, visible seulement une fois hors ligne. Depuis l'écran
 * qui porte ce qu'on a gardé, on doit pouvoir s'y mettre avant de monter dans
 * l'avion. Même magasin et même clé de stockage que la pastille.
 *
 * Hors ligne SUBI (serveur ou réseau absent), l'interrupteur reste allumé et
 * figé : repasser en ligne n'est pas en notre pouvoir, la sonde s'en charge.
 */
export function OfflineModeRow() {
  const { t } = useTranslation("offline");
  const { t: td } = useTranslation("downloads");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const snap = useConnectivity();
  const manual = snap.state === "offline-manual";
  const forced = snap.state === "offline-auto";
  const on = manual || forced;
  const hint = forced ? td("offlineAutoHint") : on ? t("offlineModeOnHint") : t("offlineModeOffHint");

  return (
    <View style={st.row}>
      <View style={[st.disc, on && st.discOn]}>
        <Feather name="wifi-off" size={16} color={on ? colors.statusPairs.warning.fg : colors.text.tertiary} />
      </View>
      <View style={st.texts}>
        <Text style={st.label}>{t("offlineModeLabel")}</Text>
        <Text style={st.hint}>{hint}</Text>
      </View>
      <BrandSwitch
        value={on}
        disabled={forced}
        onValueChange={(next) => setManualOffline(next)}
        accessibilityLabel={t("offlineModeLabel")}
      />
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: RADIUS.lg, backgroundColor: t.colors.fill.faint },
    disc: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.fill.subtle },
    discOn: { backgroundColor: t.colors.statusPairs.warning.bg },
    texts: { flex: 1, minWidth: 0 },
    label: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    hint: { ...typography.small, color: t.colors.text.tertiary, marginTop: 2 },
  });
