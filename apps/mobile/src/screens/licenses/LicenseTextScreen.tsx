import { memo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LICENSE_TEXT_TITLES } from "@tentacle-tv/shared/licenses";
import { LICENSE_TEXTS, type LicenseTextId } from "@tentacle-tv/shared/licenses/texts";
import { backOrHome } from "@/utils/backOrHome";
import { FONT_FAMILY, useContentPadding, useTheme } from "../../theme";
import { IconButton, SubtleBackground } from "../../components/ui";

/** Le texte complet d'une licence, embarqué dans l'application. */
export const LicenseTextScreen = memo(function LicenseTextScreen() {
  const { t } = useTranslation("about");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pad = useContentPadding();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const known = id && id in LICENSE_TEXTS ? (id as LicenseTextId) : null;

  return (
    <SubtleBackground ambient>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(insets.top, 24) + 12, paddingBottom: insets.bottom + 32, paddingHorizontal: pad }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 12 }}>
          <IconButton icon="chevron-left" onPress={() => backOrHome(router)} size={40} bgColor="transparent"
            color={theme.colors.brand.light} accessibilityLabel={t("common:back")} />
          <Text accessibilityRole="header" style={{ flex: 1, fontSize: 18, fontFamily: FONT_FAMILY.bold, color: theme.colors.text.primary }}>
            {known ? LICENSE_TEXT_TITLES[known] : t("licensesTitle")}
          </Text>
        </View>
        {known ? (
          <Text selectable style={{ fontSize: 12, lineHeight: 18, fontFamily: FONT_FAMILY.regular, color: theme.colors.text.secondary }}>
            {LICENSE_TEXTS[known]}
          </Text>
        ) : null}
      </ScrollView>
    </SubtleBackground>
  );
});
