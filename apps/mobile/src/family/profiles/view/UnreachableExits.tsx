import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PlainButton, PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { spacing, typography, useThemedStyles, type AppTheme } from "@/theme";
import type { MobilePickerExits } from "../usePickerExits";

/**
 * « Qui regarde ? » sans serveur (mobile, iPad) — les sorties sous la rangée : continuer hors ligne (si le
 * compte garde quelque chose ici), se déconnecter, changer de serveur. Jamais bloqué sur « serveur
 * inaccessible » ; le mot « téléchargement » n'y paraît pas (vocabulaire du hors ligne).
 */
export const UnreachableExits = memo(function UnreachableExits({ exits }: { exits: MobilePickerExits }) {
  const { t } = useTranslation(["profilePicker", "common"]);
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.wrap}>
      <Text style={st.title} accessibilityRole="header">{t("profilePicker:unreachable.title")}</Text>
      <Text style={st.lead}>{t("profilePicker:unreachable.lead")}</Text>
      {exits.goOffline ? (
        <PrimaryButton
          label={t("profilePicker:unreachable.goOffline")}
          icon="cloud-off"
          onPress={exits.goOffline}
          accessibilityHint={t("profilePicker:unreachable.goOfflineHint")}
          fullWidth
        />
      ) : null}
      <SecondaryButton
        label={t("profilePicker:unreachable.signOut")}
        icon="log-out"
        onPress={exits.signOut}
        accessibilityHint={t("profilePicker:unreachable.signOutHint")}
        fullWidth
      />
      <PlainButton label={t("common:changeServer")} icon="server" onPress={exits.changeServer} fullWidth />
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { width: "100%", maxWidth: 360, gap: spacing.sm, marginTop: spacing.xl, alignItems: "stretch" },
    title: { ...typography.body, color: t.colors.text.primary, textAlign: "center", fontWeight: "600" },
    lead: { ...typography.small, color: t.colors.text.tertiary, textAlign: "center", marginBottom: spacing.sm },
  });
