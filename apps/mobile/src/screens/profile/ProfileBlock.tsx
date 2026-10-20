import { Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { OnDeviceSettingsPane } from "@/screens/settings/OnDeviceSettingsScreen";
import { spacing, typography, useThemedStyles, type AppTheme } from "@/theme";
import type { ProfileBlockId } from "./profileStructure";

/**
 * Un BLOC de la structure, posé hors carte : la phrase de portée en tête des
 * pages mixtes, ou un contenu qui a déjà ses cartes (les réglages hors ligne).
 */
export function ProfileBlock({ id }: { id: ProfileBlockId }) {
  switch (id) {
    case "scopeIntro": return <ScopeIntro />;
    case "offlineSettings": return <OnDeviceSettingsPane />;
  }
}

/** « Les réglages marqués Compte te suivent… » : la règle des pastilles, dite une fois. */
function ScopeIntro() {
  const { t } = useTranslation("settingsMobile");
  const st = useThemedStyles(makeStyles);
  return <Text style={st.intro}>{t("scope.intro")}</Text>;
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    intro: { ...typography.caption, color: t.colors.text.secondary, lineHeight: 19, marginBottom: spacing.lg, marginHorizontal: spacing.xs },
  });
