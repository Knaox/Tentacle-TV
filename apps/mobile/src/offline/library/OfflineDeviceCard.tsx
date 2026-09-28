import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Badge, GlassCard } from "@/components/ui";
import { FONT_FAMILY, spacing, typography, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

export interface DeviceFact {
  key: string;
  label: string;
  value: string;
}

interface Props {
  /** « Qualité d'origine · 4,2 Go » : ce que l'appareil garde, en une ligne. */
  summary: string;
  facts: readonly DeviceFact[];
  /** Les réglages qui s'y rapportent (suppression après visionnage). */
  children?: ReactNode;
}

/**
 * La carte « Sur l'appareil » d'une fiche locale : ce que le titre EST ici —
 * sa version et sa place, puis les faits dans la grammaire du bloc
 * « Informations » (libellé en petites capitales, valeur dessous, deux
 * colonnes) — et ce qui s'y règle. Le retrait vit dans la rangée d'actions,
 * au-dessus : un seul endroit pour lui.
 */
export function OfflineDeviceCard({ summary, facts, children }: Props) {
  const { t } = useTranslation("offline");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.wrap}>
      <GlassCard>
        <View style={st.head}>
          <View style={st.disc} collapsable={false}>
            <Feather name="smartphone" size={18} color={colors.brand.light} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.title} accessibilityRole="header">{t("stateOnDevice")}</Text>
            <Text style={st.sub} numberOfLines={1}>{summary}</Text>
          </View>
          <Badge label={t("statusReady")} variant="success" />
        </View>
        {facts.length > 0 && (
          <View style={st.grid}>
            {facts.map((fact) => (
              <View key={fact.key} style={st.cell}>
                <Text style={st.label}>{fact.label}</Text>
                <Text style={st.value}>{fact.value}</Text>
              </View>
            ))}
          </View>
        )}
        {children}
      </GlassCard>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: spacing.screenPadding, marginTop: spacing.xl, maxWidth: 640 },
    head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    disc: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.brand.soft,
      borderWidth: 1,
      borderColor: withAlpha(t.colors.brand.violet, 0.35, t.colors.brand.glow),
    },
    title: { ...typography.bodyBold, color: t.colors.text.primary },
    sub: { ...typography.caption, color: t.colors.text.tertiary, marginTop: 1 },
    grid: { flexDirection: "row", flexWrap: "wrap", rowGap: spacing.md, marginTop: spacing.lg },
    cell: { width: "50%", paddingRight: spacing.md },
    label: { fontSize: 10.5, letterSpacing: 0.9, textTransform: "uppercase", fontFamily: FONT_FAMILY.semibold, color: t.colors.text.quaternary },
    value: { marginTop: 2, fontSize: 14, lineHeight: 19, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary, fontVariant: ["tabular-nums"] },
  });
