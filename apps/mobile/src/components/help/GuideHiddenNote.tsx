import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useIsHintDismissed, useSetHintDismissed } from "@tentacle-tv/api-client";
import { FONT_FAMILY, spacing, useThemedStyles, type AppTheme } from "@/theme";

/**
 * Le chemin du retour : le rappel « Vous ne voyez pas les bandes-annonces ? »
 * masqué pour de bon se réaffiche d'ici. Rien tant qu'il ne l'est pas, ni
 * tant que la préférence n'est pas lue.
 */
export function GuideHiddenNote() {
  const { t } = useTranslation("trailerHelp");
  const st = useThemedStyles(makeStyles);
  const hidden = useIsHintDismissed("trailerHelp");
  const setDismissed = useSetHintDismissed();
  const [restored, setRestored] = useState(false);

  if (restored) {
    return (
      <View style={st.wrap}>
        <Text style={st.text} accessibilityLiveRegion="polite">
          {t("shownAgain")}
        </Text>
      </View>
    );
  }
  if (hidden !== true) return null;

  return (
    <View style={st.wrap}>
      <Text style={st.text}>{t("hiddenNote")}</Text>
      <Pressable
        accessibilityRole="button"
        disabled={setDismissed.isPending}
        onPress={() => setDismissed.mutate({ hint: "trailerHelp", dismissed: false }, { onSuccess: () => setRestored(true) })}
        style={({ pressed }) => [st.action, (pressed || setDismissed.isPending) && st.pressed]}
      >
        <Text style={st.actionLabel}>{t("showAgain")}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: {
      marginTop: spacing.xxl,
      paddingTop: spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border.subtle,
    },
    text: { fontSize: 14, lineHeight: 21, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    action: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
    pressed: { opacity: 0.6 },
    actionLabel: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary, textDecorationLine: "underline" },
  });
