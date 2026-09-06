import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { SubtleBackground } from "@/components/ui";
import { useHeaderHeight } from "@/components/PersistentHeader";
import { spacing, typography, FONT_FAMILY, useContentPadding, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/**
 * « Sur cet appareil » — l'accueil du mode hors ligne.
 *
 * Squelette : le titre et l'état vide. Le catalogue local (films, séries
 * regroupées, recherche, filtres) arrive avec le moteur hors ligne ; la
 * navigation, elle, est déjà en place pour qu'un serveur tombé ne mure plus
 * l'application.
 */
export function OfflineLibraryScreen() {
  const { t } = useTranslation("offline");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const headerH = useHeaderHeight();
  const contentPad = useContentPadding();

  return (
    <SubtleBackground ambient>
      <View style={[st.wrap, { paddingTop: headerH + spacing.lg, paddingHorizontal: contentPad }]}>
        <Text style={st.title} accessibilityRole="header">{t("tabOnDevice")}</Text>
        <View style={st.empty}>
          <Feather name="smartphone" size={40} color={theme.colors.text.quaternary} />
          <Text style={st.emptyTitle}>{t("libraryEmptyTitle")}</Text>
          <Text style={st.emptyMessage}>{t("libraryEmptyMessage")}</Text>
        </View>
      </View>
    </SubtleBackground>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { flex: 1 },
    title: { ...typography.title, fontFamily: FONT_FAMILY.extrabold, color: t.colors.text.primary, letterSpacing: -0.4 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingBottom: 120, paddingHorizontal: spacing.xl },
    emptyTitle: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, textAlign: "center", marginTop: spacing.sm },
    emptyMessage: { ...typography.body, color: t.colors.text.tertiary, textAlign: "center", lineHeight: 20 },
  });
