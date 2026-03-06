import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, typography } from "../theme";
import { GlassCard, Divider, SubtleBackground } from "../components/ui";

const TECH_STACK: { name: string; descKey: string }[] = [
  { name: "React Native", descKey: "techReactNative" },
  { name: "Expo", descKey: "techExpo" },
  { name: "TypeScript", descKey: "techTypeScript" },
  { name: "TanStack Query", descKey: "techTanStackQuery" },
  { name: "i18next", descKey: "techReact" },
  { name: "Fastify", descKey: "techFastify" },
  { name: "Tauri", descKey: "techTauri" },
];

export function CreditsScreen() {
  const { t } = useTranslation("about");
  const insets = useSafeAreaInsets();

  return (
    <SubtleBackground>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 32, paddingHorizontal: spacing.screenPadding }}
    >
      <Text style={{ ...typography.title, color: colors.textPrimary, marginBottom: spacing.xxxl }}>
        {t("creditsTitle")}
      </Text>

      <Text style={{ ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xxl, lineHeight: 20 }}>
        {t("creditsIntro")}
      </Text>

      <Text style={{ ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.md }}>
        {t("technologies")}
      </Text>
      <GlassCard style={{ marginBottom: spacing.xxl }}>
        {TECH_STACK.map((tech, i) => (
          <View key={tech.name}>
            <View>
              <Text style={{ ...typography.bodyBold, color: colors.accentLight }}>{tech.name}</Text>
              <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: 2 }}>{t(tech.descKey)}</Text>
            </View>
            {i < TECH_STACK.length - 1 && <Divider style={{ marginVertical: spacing.md }} />}
          </View>
        ))}
      </GlassCard>

      <Divider style={{ marginBottom: spacing.xxl }} />

      <Text style={{ ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.md }}>
        {t("compatibleServices")}
      </Text>
      <GlassCard style={{ marginBottom: spacing.xxl }}>
        <Text style={{ ...typography.bodyBold, color: colors.accentLight }}>Jellyfin</Text>
        <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: 2 }}>
          {t("serviceJellyfin")}
        </Text>
      </GlassCard>

      <Divider style={{ marginBottom: spacing.xxl }} />

      <Text style={{ ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.md }}>
        {t("license")}
      </Text>
      <GlassCard>
        <Text style={{ ...typography.body, color: colors.textSecondary, lineHeight: 20 }}>
          {t("licenseText")}
        </Text>
      </GlassCard>

      <Text style={{ ...typography.small, color: colors.textDim, textAlign: "center", marginTop: spacing.xxxl }}>
        {t("creditsDisclaimer")}
      </Text>
    </ScrollView>
    </SubtleBackground>
  );
}
