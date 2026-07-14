import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { SubtleBackground, GlassCard, IconButton } from "@/components/ui";
import { ThemeModeToggle, LiquidGlassToggle } from "@/components/settings";
import {
  spacing,
  typography,
  FONT_FAMILY,
  LETTER_SPACING,
  useContentPadding,
  useThemeMode,
  useThemedStyles,
  type AppTheme,
} from "@/theme";

/**
 * Sous-écran Apparence : sélecteur de thème (clair/sombre/auto) et, sur les
 * appareils qui le supportent (iOS 26+), la bascule Liquid Glass.
 */
export function AppearanceScreen() {
  const { t } = useTranslation("preferences");
  const { t: tc } = useTranslation("common");
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const contentPadding = useContentPadding(720);
  const { liquidGlass } = useThemeMode();
  const st = useThemedStyles(makeStyles);

  return (
    <SubtleBackground>
      <View style={{ flex: 1, paddingTop: Math.max(insets.top, 24) + 8 }}>
        <View style={[st.header, { paddingHorizontal: spacing.screenPadding }]}>
          <IconButton icon="←" onPress={() => router.back()} accessibilityLabel={tc("back")} />
          <Text style={st.headerTitle}>{t("appearance")}</Text>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: contentPadding,
            paddingBottom: insets.bottom + spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={st.sectionLabel}>{t("theme")}</Text>
          <GlassCard style={st.card}>
            <ThemeModeToggle />
          </GlassCard>

          {liquidGlass.supported ? (
            <>
              <Text style={st.sectionLabel}>{t("effects")}</Text>
              <GlassCard style={st.card}>
                <LiquidGlassToggle />
              </GlassCard>
            </>
          ) : null}
        </ScrollView>
      </View>
    </SubtleBackground>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    headerTitle: {
      ...typography.title,
      color: t.colors.text.primary,
      flex: 1,
    },
    sectionLabel: {
      ...typography.caption,
      fontFamily: FONT_FAMILY.semibold,
      letterSpacing: LETTER_SPACING.wide,
      color: t.colors.text.tertiary,
      textTransform: "uppercase",
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
      marginTop: spacing.md,
    },
    card: {
      marginBottom: spacing.sm,
    },
  });
