import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TrailerGuideLinkContext, TrailerGuideStep } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import { GuideLinkPills } from "./GuideLinkPills";
import { makeGuideStyles } from "./guideStyles";

/**
 * Une étape de la partie administrateur : son numéro, son titre (et
 * « Facultatif » quand elle complète), ses paragraphes, l'arborescence
 * d'exemple après le premier, puis ses liens. Le numéro est lu avec le titre
 * (« Étape 1 »), le dessin reste décoratif.
 */
export const GuideStepCard = memo(function GuideStepCard({
  step,
  number,
  ctx,
}: {
  step: TrailerGuideStep;
  number: number;
  ctx: TrailerGuideLinkContext;
}) {
  const { t } = useTranslation("trailerHelp");
  const g = useThemedStyles(makeGuideStyles);
  const st = useThemedStyles(makeStyles);
  const [first, ...rest] = step.paragraphKeys;

  return (
    <View style={[g.card, st.card]}>
      <View style={st.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={st.badgeText}>{number}</Text>
      </View>
      <View style={st.body}>
        <View style={st.titleRow}>
          <Text style={g.blockTitle} accessibilityRole="header" accessibilityLabel={`${t("stepLabel", { number })}, ${t(step.titleKey)}`}>
            {t(step.titleKey)}
          </Text>
          {step.optional && <Text style={st.chip}>{t("optional")}</Text>}
        </View>
        {first && <Text style={g.paragraph}>{t(first)}</Text>}
        {step.exampleKey && (
          <Text style={g.example} selectable>
            {t(step.exampleKey)}
          </Text>
        )}
        {rest.map((key) => (
          <Text key={key} style={g.paragraph}>
            {t(key)}
          </Text>
        ))}
        <GuideLinkPills links={step.links} ctx={ctx} />
      </View>
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
    badge: {
      width: 30,
      height: 30,
      borderRadius: RADIUS.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.fill.soft,
      borderWidth: 1,
      borderColor: withAlpha(t.colors.brand.violet, 0.4, t.colors.brand.violet),
    },
    badgeText: { fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    body: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, paddingTop: 4 },
    chip: {
      overflow: "hidden",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: RADIUS.pill,
      backgroundColor: t.colors.fill.soft,
      fontSize: 10,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.text.secondary,
    },
  });
