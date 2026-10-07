import { memo, useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  LICENSE_TEXT_TITLES, componentsFor, componentsUnder, licenseTextsFor,
} from "@tentacle-tv/shared/licenses";
import { backOrHome } from "@/utils/backOrHome";
import { FONT_FAMILY, useContentPadding, useTheme } from "../../theme";
import { Divider, GlassCard, IconButton, SubtleBackground } from "../../components/ui";
import { LICENSE_PLATFORM } from "./licensePlatform";

/**
 * « Licences » : ce qu'embarque l'application (selon iOS ou Android), sous
 * quelle licence, avec les mentions exigées et la source ; puis la liste des
 * textes, chacun lisible en entier hors ligne.
 */
export const LicensesScreen = memo(function LicensesScreen() {
  const { t } = useTranslation("about");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pad = useContentPadding();
  const theme = useTheme();
  const components = useMemo(() => componentsFor(LICENSE_PLATFORM), []);
  const texts = useMemo(() => licenseTextsFor(LICENSE_PLATFORM), []);
  const small = { fontSize: 12, fontFamily: FONT_FAMILY.regular, color: theme.colors.text.tertiary, lineHeight: 17 };
  const header = { fontSize: 12, fontFamily: FONT_FAMILY.bold, color: theme.colors.text.primary, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 12, marginTop: 24 };

  return (
    <SubtleBackground ambient>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(insets.top, 24) + 12, paddingBottom: insets.bottom + 32, paddingHorizontal: pad }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <IconButton icon="chevron-left" onPress={() => backOrHome(router)} size={40} bgColor="transparent"
            color={theme.colors.brand.light} accessibilityLabel={t("common:back")} />
          <Text accessibilityRole="header" style={{ fontSize: 28, fontFamily: FONT_FAMILY.extrabold, color: theme.colors.text.primary }}>
            {t("licensesTitle")}
          </Text>
        </View>
        <Text style={[small, { marginTop: 8 }]}>{t("licensesIntro")}</Text>

        <Text style={header} accessibilityRole="header">{t("licenseTextsTitle")}</Text>
        <GlassCard>
          {texts.map((id, i) => {
            const count = componentsUnder(LICENSE_PLATFORM, id).length;
            return (
              <View key={id}>
                <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/license-text", params: { id } })}
                  style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 4 }}>
                  <Text style={{ flex: 1, fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: theme.colors.brand.light }}>{LICENSE_TEXT_TITLES[id]}</Text>
                  <Text style={small}>{count > 0 ? t("licenseUsedBy", { count }) : t("licenseTentacle")}</Text>
                </Pressable>
                {i < texts.length - 1 ? <Divider style={{ marginVertical: 8, backgroundColor: theme.colors.border.subtle }} /> : null}
              </View>
            );
          })}
        </GlassCard>

        <Text style={header} accessibilityRole="header">{t("thirdPartyTitle")}</Text>
        <GlassCard>
          {components.map((c, i) => (
            <View key={`${c.name}-${c.version ?? ""}`}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ flex: 1, fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: theme.colors.text.primary }}>
                  {c.name}{c.version ? ` ${c.version}` : ""}
                </Text>
                <Text style={small}>{c.license}</Text>
              </View>
              {c.notice ? <Text style={small}>{c.notice}</Text> : null}
              {c.note ? <Text style={small}>{c.note}</Text> : null}
              <Text selectable style={[small, { color: theme.colors.text.quaternary }]}>{c.source}</Text>
              {i < components.length - 1 ? <Divider style={{ marginVertical: 10, backgroundColor: theme.colors.border.subtle }} /> : null}
            </View>
          ))}
        </GlassCard>
      </ScrollView>
    </SubtleBackground>
  );
});
