import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { GalleryHorizontalEnd } from "lucide-react-native";
import { FONT_FAMILY, RADIUS, spacing, typography, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

/**
 * L'entrée vers « Affiner » AU MILIEU des rangées : le segment de tête a
 * défilé hors de vue, et c'est en parcourant les propositions qu'on a envie
 * de les corriger. Aplat de surface et liseré de marque — rien ne défile
 * derrière, un flou n'y montrerait rien — et aucune animation au repos.
 */
export const RecoRefineTeaser = memo(function RecoRefineTeaser({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation("swipe");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("teaserTitle")}
      accessibilityHint={t("teaserBody")}
      style={({ pressed }) => [st.card, pressed && st.pressed]}
    >
      <LinearGradient
        colors={[theme.colors.brand.violet, theme.colors.brand.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={st.icon}
      >
        <GalleryHorizontalEnd size={22} color={theme.colors.cta.brandFg} />
      </LinearGradient>
      <View style={st.text}>
        <Text style={st.title}>{t("teaserTitle")}</Text>
        <Text style={st.body}>{t("teaserBody")}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={theme.colors.text.tertiary} />
    </Pressable>
  );
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.screenPadding,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha(t.colors.brand.violet, 0.5, t.colors.surface.s1),
    backgroundColor: t.colors.surface.s1,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  icon: { width: 48, height: 48, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  title: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
  body: { ...typography.caption, color: t.colors.text.secondary },
});
