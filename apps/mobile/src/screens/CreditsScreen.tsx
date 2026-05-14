import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  BORDER,
  BRAND,
  FONT_FAMILY,
} from "../theme";
import { GlassCard, Divider, SubtleBackground, FadeIn, IconButton } from "../components/ui";

const TECH_STACK: { name: string; descKey: string }[] = [
  { name: "React Native", descKey: "techReactNative" },
  { name: "Expo", descKey: "techExpo" },
  { name: "TypeScript", descKey: "techTypeScript" },
  { name: "TanStack Query", descKey: "techTanStackQuery" },
  { name: "i18next", descKey: "techReact" },
  { name: "Fastify", descKey: "techFastify" },
  { name: "Tauri", descKey: "techTauri" },
];

const sectionHeaderStyle = {
  fontSize: 12,
  fontFamily: FONT_FAMILY.bold,
  color: "#FFFFFF",
  textTransform: "uppercase" as const,
  letterSpacing: 0.8,
  opacity: 0.85,
  marginBottom: 12,
  paddingHorizontal: 4,
};

export function CreditsScreen() {
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
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 4 }}>
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
            {t("creditsTitle")}
          </Text>
        </View>

        <FadeIn delay={0}>
          <Text style={{
            fontSize: 14,
            fontFamily: FONT_FAMILY.regular,
            color: "rgba(255,255,255,0.78)",
            marginBottom: 24,
            lineHeight: 22,
          }}>
            {t("creditsIntro")}
          </Text>
        </FadeIn>

        <FadeIn delay={80}>
          <Text style={sectionHeaderStyle} accessibilityRole="header">
            {t("technologies")}
          </Text>
          <GlassCard style={{ marginBottom: 24 }}>
            {TECH_STACK.map((tech, i) => (
              <View key={tech.name}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <View style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: BRAND.soft,
                    justifyContent: "center",
                    alignItems: "center",
                    marginTop: 2,
                  }}>
                    <Feather name="code" size={14} color={BRAND.light} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontSize: 14,
                      fontFamily: FONT_FAMILY.semibold,
                      color: BRAND.light,
                      letterSpacing: -0.1,
                    }}>
                      {tech.name}
                    </Text>
                    <Text style={{
                      fontSize: 13,
                      fontFamily: FONT_FAMILY.regular,
                      color: "rgba(255,255,255,0.55)",
                      marginTop: 2,
                      lineHeight: 18,
                    }}>
                      {t(tech.descKey)}
                    </Text>
                  </View>
                </View>
                {i < TECH_STACK.length - 1 && <Divider style={{ marginVertical: 12, backgroundColor: BORDER.subtle }} />}
              </View>
            ))}
          </GlassCard>
        </FadeIn>

        <FadeIn delay={160}>
          <Text style={sectionHeaderStyle} accessibilityRole="header">
            {t("compatibleServices")}
          </Text>
          <GlassCard style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: BRAND.soft,
                justifyContent: "center",
                alignItems: "center",
                marginTop: 2,
              }}>
                <Feather name="server" size={14} color={BRAND.light} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 14,
                  fontFamily: FONT_FAMILY.semibold,
                  color: BRAND.light,
                  letterSpacing: -0.1,
                }}>
                  Jellyfin
                </Text>
                <Text style={{
                  fontSize: 13,
                  fontFamily: FONT_FAMILY.regular,
                  color: "rgba(255,255,255,0.55)",
                  marginTop: 2,
                  lineHeight: 18,
                }}>
                  {t("serviceJellyfin")}
                </Text>
              </View>
            </View>
          </GlassCard>
        </FadeIn>

        <FadeIn delay={240}>
          <Text style={sectionHeaderStyle} accessibilityRole="header">
            {t("license")}
          </Text>
          <GlassCard>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: BRAND.soft,
                justifyContent: "center",
                alignItems: "center",
                marginTop: 2,
              }}>
                <Feather name="award" size={14} color={BRAND.light} />
              </View>
              <Text style={{
                flex: 1,
                fontSize: 13,
                fontFamily: FONT_FAMILY.regular,
                color: "rgba(255,255,255,0.78)",
                lineHeight: 20,
              }}>
                {t("licenseText")}
              </Text>
            </View>
          </GlassCard>
        </FadeIn>

        <Text style={{
          fontSize: 11,
          fontFamily: FONT_FAMILY.regular,
          color: "rgba(255,255,255,0.34)",
          textAlign: "center",
          marginTop: 32,
        }}>
          {t("creditsDisclaimer")}
        </Text>
      </ScrollView>
    </SubtleBackground>
  );
}
