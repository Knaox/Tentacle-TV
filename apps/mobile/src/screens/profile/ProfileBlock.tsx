import { Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { OfflineSpaceBlock } from "@/components/settings/controls/OfflineRows";
import { spacing, typography, useThemedStyles, type AppTheme } from "@/theme";
import type { SettingsBlockId } from "@tentacle-tv/shared";

/**
 * Un BLOC de la structure, posé hors carte : la phrase de portée en tête des
 * pages mixtes, ou un contenu qui a déjà sa carte (la jauge de l'espace hors ligne).
 */
export function ProfileBlock({ id }: { id: SettingsBlockId }) {
  switch (id) {
    case "scopeIntro": return <ScopeIntro />;
    case "offlineSpace": return <OfflineSpaceBlock />;
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
