import { type ReactNode } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { SubtleBackground, IconButton } from "@/components/ui";
import {
  spacing,
  typography,
  useContentPadding,
  useThemedStyles,
  type AppTheme,
} from "@/theme";

interface Props {
  title: string;
  children: ReactNode;
  /** Largeur de colonne centrée sur grand écran (défaut 720, comme À propos). */
  maxWidth?: number;
}

/**
 * Ossature commune des sous-écrans de réglages : fond thémé, en-tête avec
 * bouton retour + titre, contenu scrollable en colonne centrée sur tablette.
 */
export function SettingsScaffold({ title, children, maxWidth = 720 }: Props) {
  const { t: tc } = useTranslation("common");
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const contentPadding = useContentPadding(maxWidth);
  const st = useThemedStyles(makeStyles);

  return (
    <SubtleBackground>
      <View style={{ flex: 1, paddingTop: Math.max(insets.top, 24) + 8 }}>
        <View style={[st.header, { paddingHorizontal: spacing.screenPadding }]}>
          <IconButton icon="←" onPress={() => router.back()} accessibilityLabel={tc("back")} />
          <Text style={st.headerTitle} accessibilityRole="header" numberOfLines={1}>{title}</Text>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: contentPadding,
            paddingBottom: insets.bottom + spacing.xxl,
          }}
          showsVerticalScrollIndicator={false}
        >
          {children}
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
    headerTitle: { ...typography.title, color: t.colors.text.primary, flex: 1 },
  });
