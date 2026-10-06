import { View, Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { backOrHome } from "@/utils/backOrHome";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { FONT_FAMILY, useContentPadding, useTheme } from "../theme";
import { SubtleBackground, FadeIn, IconButton } from "../components/ui";
import { PairTvCard } from "../components/pair/PairTvCard";
import { PairTvMedallion } from "../components/pair/PairTvMedallion";

export function PairTVScreen() {
  const { t } = useTranslation("pairing");
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();
  const contentPad = useContentPadding();

  return (
    <SubtleBackground ambient>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: Math.max(insets.top, 24) + 8,
          marginBottom: 8,
        }}>
          <IconButton
            icon="chevron-left"
            onPress={() => backOrHome(router)}
            size={40}
            bgColor="transparent"
            color={theme.colors.brand.light}
            accessibilityLabel={t("common:back")}
          />
        </View>

        <PairTvMedallion />

        <FadeIn delay={80} translateY={10}>
          <Text style={{
            fontSize: 28,
            fontFamily: FONT_FAMILY.extrabold,
            fontWeight: "800",
            color: theme.colors.text.primary,
            letterSpacing: -0.6,
            textAlign: "center",
            marginBottom: 6,
          }} accessibilityRole="header">
            {t("pairYourTV")}
          </Text>
          <Text style={{
            fontSize: 14,
            fontFamily: FONT_FAMILY.medium,
            color: theme.colors.brand.light,
            letterSpacing: 0.3,
            textAlign: "center",
            marginBottom: 24,
            paddingHorizontal: 32,
          }}>
            {t("enterTVCode")}
          </Text>
        </FadeIn>

        <FadeIn delay={140} translateY={12} style={{ paddingHorizontal: contentPad }}>
          <PairTvCard />
        </FadeIn>

        <FadeIn delay={200} translateY={8}>
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: 16,
            paddingHorizontal: 16,
          }}>
            <Feather name="clock" size={12} color={theme.colors.text.quaternary} />
            <Text style={{
              color: theme.colors.text.quaternary,
              fontSize: 12,
              fontFamily: FONT_FAMILY.regular,
              textAlign: "center",
            }}>
              {t("codeExpireNote")}
            </Text>
          </View>
        </FadeIn>
      </ScrollView>
    </SubtleBackground>
  );
}
