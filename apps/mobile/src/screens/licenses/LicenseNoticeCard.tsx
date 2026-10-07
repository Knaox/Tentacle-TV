import { memo } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { tentacleSourceUrl } from "@tentacle-tv/shared/licenses";
import { FONT_FAMILY, useTheme } from "../../theme";
import { GlassCard } from "../../components/ui";
import { APP_VERSION, LICENSE_PLATFORM } from "./licensePlatform";

/**
 * La mention de l'AGPL dans « Crédits » : copyright, absence de garantie, la
 * source de CETTE version, et l'entrée vers les composants et leurs textes.
 */
export const LicenseNoticeCard = memo(function LicenseNoticeCard() {
  const { t } = useTranslation("about");
  const router = useRouter();
  const theme = useTheme();
  const sourceUrl = tentacleSourceUrl(LICENSE_PLATFORM, APP_VERSION);
  const body = { fontSize: 13, fontFamily: FONT_FAMILY.regular, color: theme.colors.text.secondary, lineHeight: 20 };
  const link = { fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: theme.colors.brand.light };

  return (
    <GlassCard style={{ marginTop: 12, gap: 12 }}>
      <Text style={body}>{t("tentacleLicense", { version: APP_VERSION })}</Text>
      <Pressable onPress={() => void Linking.openURL(sourceUrl)} accessibilityRole="link" accessibilityLabel={t("sourceCode")}>
        <Text style={body}>{t("sourceCode")}</Text>
        <Text style={link}>{sourceUrl}</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push("/licenses")}
        accessibilityRole="button"
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 }}
      >
        <Text style={link}>{t("licensesTitle")}</Text>
        <View><Feather name="chevron-right" size={16} color={theme.colors.brand.light} /></View>
      </Pressable>
    </GlassCard>
  );
});
