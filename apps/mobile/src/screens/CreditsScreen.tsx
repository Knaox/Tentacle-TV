import { View, Text, ScrollView, type TextStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { backOrHome } from "@/utils/backOrHome";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  FONT_FAMILY,
  useContentPadding,
  useTheme,
  type AppTheme,
} from "../theme";
import { GlassCard, Divider, SubtleBackground, FadeIn, IconButton } from "../components/ui";

const TECH_STACK: { name: string; descKey: string }[] = [
  { name: "React Native", descKey: "techReactNative" },
  { name: "Expo", descKey: "techExpo" },
  { name: "TypeScript", descKey: "techTypeScript" },
  { name: "TanStack Query", descKey: "techTanStackQuery" },
  { name: "i18next", descKey: "techReact" },
  { name: "Fastify", descKey: "techFastify" },
  // Les deux coquilles de bureau : Electron (Windows, macOS) et Tauri (Linux).
  { name: "Electron", descKey: "techElectron" },
  { name: "Tauri", descKey: "techTauri" },
];

const sectionHeaderStyle = (t: AppTheme): TextStyle => ({
  fontSize: 12,
  fontFamily: FONT_FAMILY.bold,
  color: t.colors.text.primary,
  textTransform: "uppercase" as const,
  letterSpacing: 0.8,
  opacity: 0.85,
  marginBottom: 12,
  paddingHorizontal: 4,
});

export function CreditsScreen() {
  const { t } = useTranslation("about");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const contentPad = useContentPadding();
  const theme = useTheme();
  const headerStyle = sectionHeaderStyle(theme);

  return (
    <SubtleBackground ambient>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 24) + 12,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: contentPad,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 4 }}>
          <IconButton
            icon="chevron-left"
            onPress={() => backOrHome(router)}
            size={40}
            bgColor="transparent"
            color={theme.colors.brand.light}
            accessibilityLabel={t("common:back")}
          />
          <Text
            style={{
              fontSize: 28,
              fontFamily: FONT_FAMILY.extrabold,
              fontWeight: "800",
              letterSpacing: -0.6,
              color: theme.colors.text.primary,
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
            color: theme.colors.text.secondary,
            marginBottom: 24,
            lineHeight: 22,
          }}>
            {t("creditsIntro")}
          </Text>
        </FadeIn>

        <FadeIn delay={80}>
          <Text style={headerStyle} accessibilityRole="header">
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
                    backgroundColor: theme.colors.brand.soft,
                    justifyContent: "center",
                    alignItems: "center",
                    marginTop: 2,
                  }}>
                    <Feather name="code" size={14} color={theme.colors.brand.light} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontSize: 14,
                      fontFamily: FONT_FAMILY.semibold,
                      color: theme.colors.brand.light,
                      letterSpacing: -0.1,
                    }}>
                      {tech.name}
                    </Text>
                    <Text style={{
                      fontSize: 13,
                      fontFamily: FONT_FAMILY.regular,
                      color: theme.colors.text.tertiary,
                      marginTop: 2,
                      lineHeight: 18,
                    }}>
                      {t(tech.descKey)}
                    </Text>
                  </View>
                </View>
                {i < TECH_STACK.length - 1 && <Divider style={{ marginVertical: 12, backgroundColor: theme.colors.border.subtle }} />}
              </View>
            ))}
          </GlassCard>
        </FadeIn>

        <FadeIn delay={160}>
          <Text style={headerStyle} accessibilityRole="header">
            {t("compatibleServices")}
          </Text>
          <GlassCard style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: theme.colors.brand.soft,
                justifyContent: "center",
                alignItems: "center",
                marginTop: 2,
              }}>
                <Feather name="server" size={14} color={theme.colors.brand.light} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 14,
                  fontFamily: FONT_FAMILY.semibold,
                  color: theme.colors.brand.light,
                  letterSpacing: -0.1,
                }}>
                  Jellyfin
                </Text>
                <Text style={{
                  fontSize: 13,
                  fontFamily: FONT_FAMILY.regular,
                  color: theme.colors.text.tertiary,
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
          <Text style={headerStyle} accessibilityRole="header">
            {t("license")}
          </Text>
          <GlassCard>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: theme.colors.brand.soft,
                justifyContent: "center",
                alignItems: "center",
                marginTop: 2,
              }}>
                <Feather name="award" size={14} color={theme.colors.brand.light} />
              </View>
              <Text style={{
                flex: 1,
                fontSize: 13,
                fontFamily: FONT_FAMILY.regular,
                color: theme.colors.text.secondary,
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
          color: theme.colors.text.quaternary,
          textAlign: "center",
          marginTop: 32,
        }}>
          {t("creditsDisclaimer")}
        </Text>
      </ScrollView>
    </SubtleBackground>
  );
}
