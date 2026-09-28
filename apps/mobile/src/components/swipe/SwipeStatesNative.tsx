import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Button } from "@/components/ui";
import { typography, useTheme } from "@/theme";

/** Plus rien à juger : le dire, et mener aux recommandations. */
export function SwipeEmptyNative() {
  const { t } = useTranslation("swipe");
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={st.center}>
      <Feather name="check-circle" size={40} color={theme.colors.brand.light} />
      <Text style={[typography.subtitle, st.title, { color: theme.colors.text.primary }]}>{t("emptyTitle")}</Text>
      <Text style={[typography.body, st.body, { color: theme.colors.text.secondary }]}>{t("emptyBody")}</Text>
      {/* Même onglet, autre section : on revient aux propositions. */}
      <Button title={t("emptyCta")} onPress={() => router.setParams({ section: "forYou" })} />
    </View>
  );
}

export function SwipeErrorNative({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation("swipe");
  const theme = useTheme();
  return (
    <View style={st.center} accessibilityRole="alert">
      <Feather name="alert-triangle" size={36} color={theme.colors.status.warning} />
      <Text style={[typography.subtitle, st.title, { color: theme.colors.text.primary }]}>{t("errorTitle")}</Text>
      <Button title={t("retry")} variant="secondary" onPress={onRetry} />
    </View>
  );
}

/** Un verdict perdu : la carte est revenue en haut. */
export function SwipeSaveFailedNative() {
  const { t } = useTranslation("swipe");
  const theme = useTheme();
  const pair = theme.colors.statusPairs.error;
  return (
    <View style={[st.toast, { backgroundColor: pair.bg }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={[typography.caption, { color: pair.fg }]}>{t("saveFailed")}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  title: { textAlign: "center", marginTop: 4 },
  body: { textAlign: "center", marginBottom: 8 },
  toast: { marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
});
