import { Pressable, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useStillWatchingTrial } from "@tentacle-tv/api-client";
import { SettingsRow } from "../SettingsRow";
import { FONT_FAMILY, spacing, typography, useThemedStyles, type AppTheme } from "@/theme";

/**
 * « Voir la question maintenant » — sous les deux durées de « Vous regardez
 * encore ? », comme au web (`StillWatchingTrialRow`) : un essai armé UNE fois
 * pour la prochaine lecture (`useStillWatchingTrial`, api-client). La question
 * y paraît après vingt secondes sans geste ; le reste est le vrai
 * comportement — décompte, puis pause. Sans lui, la voir demandait une heure
 * et demie de lecture sans toucher l'écran.
 *
 * Armé, l'explication devient l'état et le bouton propose de renoncer. Un
 * bouton secondaire (contour), cible de 44 pt : la ligne n'a pas d'action
 * principale.
 */
export function StillWatchingTrialRow({ last }: { last?: boolean }) {
  const { t } = useTranslation("preferences");
  const st = useThemedStyles(makeStyles);
  const { armed, arm, cancel } = useStillWatchingTrial();
  const label = armed ? t("stillWatchingTrialCancel") : t("stillWatchingTrialStart");

  return (
    <SettingsRow
      icon="play-circle"
      label={t("stillWatchingTrialTitle")}
      description={armed ? t("stillWatchingTrialArmed") : t("stillWatchingTrialHint")}
      last={last}
      trailing={
        <Pressable
          onPress={armed ? cancel : arm}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={t("stillWatchingTrialTitle")}
          hitSlop={4}
          style={({ pressed }) => [st.button, armed && st.armed, pressed && st.pressed]}
        >
          <Text style={st.buttonLabel} numberOfLines={1}>{label}</Text>
        </Pressable>
      }
    />
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    button: {
      minHeight: 44,
      paddingHorizontal: spacing.md,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: theme.colors.border.strong,
      alignItems: "center",
      justifyContent: "center",
      maxWidth: 150,
    },
    armed: { borderColor: theme.colors.brand.violet, backgroundColor: theme.colors.brand.soft },
    pressed: { backgroundColor: theme.colors.fill.subtle },
    buttonLabel: { ...typography.small, fontFamily: FONT_FAMILY.semibold, color: theme.colors.text.primary },
  });
