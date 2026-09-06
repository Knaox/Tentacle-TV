import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { Button } from "@/components/ui";
import { PLAYER, spacing } from "@/theme";

interface Props {
  /** Réessayer : la route re-résout la source — le serveur s'il répond. */
  onRetry: () => void;
  onBack: () => void;
}

/** « Fichier introuvable » : le titre n'est plus sur l'appareil. */
export function MediaMissingView({ onRetry, onBack }: Props) {
  const { t } = useTranslation("offline");
  const { t: tc } = useTranslation("common");
  const { t: tp } = useTranslation("player");
  return (
    <View style={st.root}>
      <Feather name="file" size={40} color={PLAYER.textTertiary} />
      <Text style={st.title} accessibilityRole="header">{t("fileMissingTitle")}</Text>
      <Text style={st.hint}>{t("fileMissingHint")}</Text>
      <View style={st.actions}>
        <Button title={tp("retry", { defaultValue: tc("retry", { defaultValue: "Réessayer" }) })} onPress={onRetry} />
        <Button title={tc("back")} onPress={onBack} variant="secondary" />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: PLAYER.bg, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, gap: spacing.sm },
  title: { color: PLAYER.text, fontSize: 20, fontWeight: "700", textAlign: "center", marginTop: spacing.sm },
  hint: { color: PLAYER.textSecondary, fontSize: 14, lineHeight: 20, textAlign: "center", maxWidth: 420 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
});
