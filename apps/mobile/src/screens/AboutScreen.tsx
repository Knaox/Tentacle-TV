import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import {
  BORDER,
  BRAND,
  FONT_FAMILY,
  RADIUS,
  SURFACE,
} from "../theme";
import { GlassCard, FadeIn, SubtleBackground, IconButton } from "../components/ui";
import { TentacleLogo } from "../components/TentacleLogo";

const PRIVACY_POLICY_URL = "https://github.com/Knaox/Tentacle-TV/blob/main/PRIVACY.md";

const FEATURE_KEYS = [
  { key: "featurePlayer", icon: "play-circle" as const },
  { key: "featureResume", icon: "rewind" as const },
  { key: "featureRequests", icon: "send" as const },
  { key: "featureDesktop", icon: "monitor" as const },
  { key: "featureAdaptive", icon: "smartphone" as const },
  { key: "featureNotifications", icon: "bell" as const },
];

const appVersion = Constants.expoConfig?.version ?? "1.0.0";
const buildNumber = Constants.expoConfig?.ios?.buildNumber ?? "1";

export function AboutScreen() {
  const { t } = useTranslation("about");
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SubtleBackground ambient>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24, gap: 4 }}>
          <IconButton
            icon="chevron-left"
            onPress={() => router.back()}
            size={40}
            bgColor="transparent"
            color={BRAND.light}
            accessibilityLabel="Back"
          />
          <Text
            style={{
              fontSize: 28,
              fontFamily: FONT_FAMILY.extrabold,
              fontWeight: "800",
              letterSpacing: -0.6,
              color: "#FFFFFF",
            }}
            accessibilityRole="header"
          >
            {t("title")}
          </Text>
        </View>

        <FadeIn delay={0}>
          <View style={{ alignItems: "center", marginBottom: 28 }}>
            <TentacleLogo size={80} />
            <Text style={{
              fontSize: 28,
              fontFamily: FONT_FAMILY.extrabold,
              fontWeight: "800",
              letterSpacing: -0.6,
              color: "#FFFFFF",
              marginTop: 14,
            }}>
              Tentacle TV
            </Text>
            <Text style={{
              fontSize: 12,
              fontFamily: FONT_FAMILY.medium,
              color: BRAND.light,
              letterSpacing: 0.4,
              marginTop: 4,
            }}>
              {t("versionBuild", { version: appVersion, build: buildNumber })}
            </Text>
          </View>
        </FadeIn>

        <FadeIn delay={100}>
          <Text style={{
            fontSize: 14,
            fontFamily: FONT_FAMILY.regular,
            color: "rgba(255,255,255,0.78)",
            textAlign: "center",
            marginBottom: 24,
            lineHeight: 22,
            paddingHorizontal: 8,
          }}>
            {t("description")}
          </Text>
        </FadeIn>

        <FadeIn delay={200}>
          <Text
            style={{
              fontSize: 12,
              fontFamily: FONT_FAMILY.bold,
              color: "#FFFFFF",
              textTransform: "uppercase",
              letterSpacing: 0.8,
              opacity: 0.85,
              marginBottom: 12,
              paddingHorizontal: 4,
            }}
            accessibilityRole="header"
          >
            {t("features")}
          </Text>
          <View style={{ gap: 10, marginBottom: 28 }}>
            {FEATURE_KEYS.map(({ key, icon }) => (
              <GlassCard key={key} style={{ padding: 0 }}>
                <View style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: BRAND.soft,
                    justifyContent: "center",
                    alignItems: "center",
                  }}>
                    <Feather name={icon} size={18} color={BRAND.light} />
                  </View>
                  <Text style={{
                    flex: 1,
                    fontSize: 14,
                    fontFamily: FONT_FAMILY.medium,
                    color: "rgba(255,255,255,0.9)",
                    letterSpacing: -0.1,
                  }}>
                    {t(key)}
                  </Text>
                </View>
              </GlassCard>
            ))}
          </View>
        </FadeIn>

        <FadeIn delay={300}>
          <Pressable
            onPress={() => router.push("/credits")}
            accessibilityRole="button"
            accessibilityLabel={t("creditsLink")}
            style={({ pressed }) => [
              {
                backgroundColor: SURFACE.s2,
                borderRadius: RADIUS.lg,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                borderWidth: 1,
                borderColor: BORDER.subtle,
                marginBottom: 16,
                minHeight: 56,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={{
              fontSize: 15,
              fontFamily: FONT_FAMILY.semibold,
              color: BRAND.light,
            }}>{t("creditsLink")}</Text>
            <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </FadeIn>

        <FadeIn delay={400}>
          <Pressable
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            accessibilityRole="link"
            accessibilityLabel={t("privacyPolicy")}
            style={({ pressed }) => [
              {
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
                paddingVertical: 12,
                minHeight: 44,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Feather name="external-link" size={14} color="rgba(255,255,255,0.55)" />
            <Text style={{
              fontSize: 13,
              fontFamily: FONT_FAMILY.medium,
              color: "rgba(255,255,255,0.55)",
              textDecorationLine: "underline",
            }}>
              {t("privacyPolicy")}
            </Text>
          </Pressable>
        </FadeIn>

        <Text style={{
          fontSize: 11,
          fontFamily: FONT_FAMILY.regular,
          color: "rgba(255,255,255,0.34)",
          textAlign: "center",
          marginTop: 16,
        }}>
          {t("copyright", { version: `v${appVersion}`, year: new Date().getFullYear() })}
        </Text>
      </ScrollView>
    </SubtleBackground>
  );
}
