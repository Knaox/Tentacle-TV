import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { TRAILER_GUIDE_PARTS, type TrailerGuidePart } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/** La place du retour flottant, au-dessus du titre (celle de « Vos statistiques »). */
const BACK_ROOM = 56;

const PART_LABEL = { everyone: "partEveryone", admin: "partAdmin" } as const;

/**
 * L'en-tête du guide : le surtitre « Guides » au trait de marque, le titre, la
 * phrase qui dit à quoi sert l'écran, et le sommaire — deux pastilles qui
 * font défiler jusqu'à leur partie.
 */
export const GuideHeader = memo(function GuideHeader({
  topInset,
  onJump,
}: {
  topInset: number;
  onJump: (part: TrailerGuidePart) => void;
}) {
  const { t } = useTranslation("trailerHelp");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);

  return (
    <View style={{ paddingTop: topInset + BACK_ROOM }}>
      <View style={st.kickerRow}>
        <LinearGradient colors={[theme.colors.brand.light, theme.colors.brand.accent]} style={st.rail} />
        <Text style={st.kicker}>{t("helpGuidesTitle")}</Text>
      </View>
      <Text style={st.title} accessibilityRole="header">
        {t("title")}
      </Text>
      <Text style={st.lead}>{t("lead")}</Text>
      <View style={st.parts} accessibilityLabel={t("contentsLabel")}>
        {TRAILER_GUIDE_PARTS.map((part) => (
          <Pressable
            key={part}
            accessibilityRole="button"
            onPress={() => onJump(part)}
            style={({ pressed }) => [st.part, pressed && st.pressed]}
          >
            <Text style={st.partLabel}>{t(PART_LABEL[part])}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    kickerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    rail: { width: 3, height: 14, borderRadius: 2 },
    kicker: { fontSize: 11, letterSpacing: 2.4, textTransform: "uppercase", fontFamily: FONT_FAMILY.bold, color: t.colors.text.tertiary },
    title: { marginTop: 6, fontSize: 34, lineHeight: 40, letterSpacing: -0.6, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    lead: { marginTop: spacing.sm, fontSize: 15, lineHeight: 23, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    parts: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
    part: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
      borderRadius: RADIUS.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.strong,
      backgroundColor: t.colors.fill.subtle,
    },
    pressed: { opacity: 0.7 },
    partLabel: { fontSize: 14, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
  });
