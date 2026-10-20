import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { SecondaryButton } from "@/components/ui/buttons";
import { spacing, typography, FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { setCellularAck } from "../deviceSettings";

interface Props {
  /** Transferts en attente du Wi-Fi. */
  count: number;
}

/**
 * « 3 transferts attendent le Wi-Fi » + « Continuer en données mobiles » :
 * l'accusé vaut jusqu'au prochain retour du Wi-Fi, et relance tout de suite.
 */
export function WifiWaitCard({ count }: Props) {
  const { t } = useTranslation("offline");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  if (count === 0) return null;
  return (
    <View style={st.card}>
      <View style={st.row}>
        <Feather name="wifi-off" size={18} color={colors.statusPairs.warning.fg} />
        <Text style={st.text}>{t("waitingWifiCard", { count })}</Text>
      </View>
      <SecondaryButton size="sm" label={t("continueOnCellular")} onPress={() => setCellularAck(true)} style={st.cellular} />
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      gap: spacing.md,
      padding: spacing.md,
      marginBottom: spacing.xl,
      borderRadius: RADIUS.lg,
      backgroundColor: t.colors.statusPairs.warning.bg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    text: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary, flex: 1 },
    // À la taille de son libellé : un pavé pleine largeur pesait plus que l'avis.
    cellular: { alignSelf: "flex-start" },
  });
