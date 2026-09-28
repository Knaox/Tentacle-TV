import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui";
import { goHome } from "@/utils/backOrHome";
import { ctlGradient, FONT_FAMILY, RADIUS, spacing, typography, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

const STEPS = ["emptyStep1", "emptyStep2", "emptyStep3"] as const;

/**
 * L'état vide de « Sur cet appareil ».
 *
 * Il disait « Rien sur cet appareil » et rien sur le COMMENT. Trois étapes
 * numérotées disent le geste, de la fiche à la lecture sans réseau, et le
 * bouton mène là où tout commence. Vocabulaire de l'espace `offline` : aucun
 * mot que la relecture d'Apple lirait comme une distribution hors boutique.
 */
export function OfflineManageEmpty() {
  const { t } = useTranslation("offline");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const router = useRouter();
  const gradient = ctlGradient(theme.colors.brand);
  return (
    <View style={st.wrap}>
      <View style={st.disc} collapsable={false}>
        <LinearGradient colors={gradient.colors} start={gradient.start} end={gradient.end} locations={gradient.locations} style={StyleSheet.absoluteFill} />
        <Feather name="smartphone" size={30} color={theme.colors.cta.brandFg} />
      </View>
      <Text style={st.title} accessibilityRole="header">{t("emptyTitle")}</Text>
      <Text style={st.message}>{t("emptyMessage")}</Text>
      <View style={st.steps}>
        {STEPS.map((key, index) => (
          <View key={key} style={st.step}>
            <View style={st.stepBadge}>
              <Text style={st.stepNumber}>{index + 1}</Text>
            </View>
            <Text style={st.stepText}>{t(key)}</Text>
          </View>
        ))}
      </View>
      <Button title={t("emptyBrowse")} onPress={() => goHome(router)} style={st.cta} />
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl, paddingHorizontal: spacing.md },
    disc: { width: 72, height: 72, borderRadius: 22, overflow: "hidden", alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
    title: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, textAlign: "center" },
    message: { ...typography.body, color: t.colors.text.tertiary, textAlign: "center", lineHeight: 21, maxWidth: 380 },
    steps: { alignSelf: "stretch", gap: 8, marginTop: spacing.md },
    step: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: RADIUS.lg,
      backgroundColor: t.colors.fill.faint,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
    stepBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(t.colors.brand.violet, 0.18, t.colors.brand.soft),
    },
    stepNumber: { ...typography.caption, fontFamily: FONT_FAMILY.bold, color: t.colors.brand.light, fontVariant: ["tabular-nums"] },
    stepText: { ...typography.body, color: t.colors.text.secondary, flex: 1 },
    cta: { marginTop: spacing.lg, minWidth: 220 },
  });
