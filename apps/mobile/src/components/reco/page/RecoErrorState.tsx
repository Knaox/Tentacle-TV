import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/** La page n'a rien à montrer et le serveur ne répond pas : un message et « Réessayer ». */
export function RecoErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation("reco");
  const { t: tc } = useTranslation("common");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.root}>
      <Feather name="alert-circle" size={36} color={theme.colors.brand.light} />
      <Text style={st.body}>{t("loadError")}</Text>
      <Button title={tc("retry")} variant="secondary" onPress={onRetry} />
    </View>
  );
}

/** Vieux serveur qui ne sert AUCUNE rangée en mode désactivé : l'écran historique. */
export function RecoDisabledState({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t } = useTranslation("reco");
  const st = useThemedStyles(makeStyles);
  return (
    <View style={[st.root, st.left]}>
      <Text style={st.title}>{t("pageTitle")}</Text>
      <Text style={st.bodyLeft}>{t("disabledBody")}</Text>
      <Button title={t("disabledCta")} onPress={onOpenSettings} />
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  root: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const, gap: spacing.lg, padding: spacing.xxl },
  left: { alignItems: "flex-start" as const },
  title: { ...typography.title, fontFamily: FONT_FAMILY.extrabold, color: t.colors.text.primary, letterSpacing: -0.5 },
  body: { ...typography.body, color: t.colors.text.secondary, textAlign: "center" as const, maxWidth: 320 },
  bodyLeft: { ...typography.body, color: t.colors.text.secondary, maxWidth: 420 },
});
