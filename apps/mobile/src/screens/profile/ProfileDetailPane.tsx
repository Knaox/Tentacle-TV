import { Platform, ScrollView, Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { spacing, typography, useThemedStyles, type AppTheme } from "@/theme";
import { PROFILE_PANE_REGISTRY } from "./profilePaneRegistry";
import type { ProfilePaneId } from "./profilePanes";

/** Au-delà, une ligne de réglage devient une piste d'atterrissage. */
const DETAIL_MAX_WIDTH = 680;

interface Props {
  pane: ProfilePaneId;
  topInset: number;
  bottomInset: number;
}

/**
 * La colonne de détail du profil tablette : le titre du volet, puis son
 * contenu — le même composant que l'écran plein écran du téléphone. La clé
 * `pane` remonte le défilement en haut à chaque changement de volet.
 */
export function ProfileDetailPane({ pane, topInset, bottomInset }: Props) {
  const entry = PROFILE_PANE_REGISTRY[pane];
  // L'espace passe à l'appel : un `useTranslation(ns)` dont l'espace change
  // d'un volet à l'autre, sans remontage, rendait la clé brute.
  const { t } = useTranslation();
  const st = useThemedStyles(makeStyles);
  const { Component } = entry;
  return (
    <ScrollView
      key={pane}
      style={st.scroll}
      contentContainerStyle={[st.content, { paddingTop: topInset + spacing.xl, paddingBottom: bottomInset }]}
      keyboardShouldPersistTaps="handled"
      indicatorStyle={Platform.OS === "ios" ? "white" : "default"}
    >
      <View style={st.column}>
        <Text style={st.title} accessibilityRole="header">{t(entry.title.key, { ns: entry.title.ns })}</Text>
        <Component />
      </View>
    </ScrollView>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.xl },
  column: { width: "100%", maxWidth: DETAIL_MAX_WIDTH, alignSelf: "center" as const },
  title: { ...typography.title, color: t.colors.text.primary, marginBottom: spacing.lg },
});
