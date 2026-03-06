import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { colors, spacing, typography } from "../theme";
import { GlassCard, Divider, FadeIn, SubtleBackground } from "../components/ui";
import { TentacleLogo } from "../components/TentacleLogo";

const FEATURE_KEYS = [
  "featurePlayer",
  "featureResume",
  "featureRequests",
  "featureDesktop",
  "featureAdaptive",
  "featureNotifications",
] as const;

const appVersion = Constants.expoConfig?.version ?? "1.0.0";
const buildNumber = Constants.expoConfig?.ios?.buildNumber ?? "1";

export function AboutScreen() {
  const { t } = useTranslation("about");
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SubtleBackground>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 32, paddingHorizontal: spacing.screenPadding }}
    >
      <Text style={{ ...typography.title, color: colors.textPrimary, marginBottom: spacing.xxxl }}>{t("title")}</Text>

      <FadeIn delay={0}>
        <View style={{ alignItems: "center", marginBottom: spacing.xxxl }}>
          <TentacleLogo size={100} />
          <Text style={{ ...typography.hero, color: colors.textPrimary, marginTop: spacing.lg }}>Tentacle TV</Text>
          <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xs }}>
            {t("versionBuild", { version: appVersion, build: buildNumber })}
          </Text>
        </View>
      </FadeIn>

      <FadeIn delay={100}>
        <Text style={{ ...typography.caption, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.xxl, lineHeight: 20 }}>
          {t("description")}
        </Text>
      </FadeIn>

      <FadeIn delay={200}>
        <Text style={{ ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.md }}>{t("features")}</Text>
        <GlassCard style={{ marginBottom: spacing.xxl }}>
        {FEATURE_KEYS.map((key, i) => (
          <View key={key}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
              <Text style={{ ...typography.body, color: colors.textSecondary, flex: 1 }}>{t(key)}</Text>
            </View>
            {i < FEATURE_KEYS.length - 1 && <Divider style={{ marginVertical: spacing.sm }} />}
          </View>
        ))}
      </GlassCard>
      </FadeIn>

      <FadeIn delay={300}>
        <Pressable
        onPress={() => router.push("/credits")}
        style={{
          backgroundColor: colors.surfaceElevated, borderRadius: spacing.cardRadius,
          padding: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          borderWidth: 1, borderColor: colors.borderAccent,
        }}
      >
        <Text style={{ ...typography.bodyBold, color: colors.accentLight }}>{t("creditsLink")}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 18 }}>&gt;</Text>
      </Pressable>
      </FadeIn>

      <Text style={{ ...typography.small, color: colors.textDim, textAlign: "center", marginTop: spacing.xxxl }}>
        {t("copyright", { version: `v${appVersion}`, year: new Date().getFullYear() })}
      </Text>
    </ScrollView>
    </SubtleBackground>
  );
}
