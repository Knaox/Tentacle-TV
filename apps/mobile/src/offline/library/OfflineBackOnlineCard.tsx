import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Button, GlassSurface } from "@/components/ui";
import { setManualOffline } from "@/offline/connectivityStore";
import { useConnectivity } from "@/offline/useConnectivity";
import { spacing, typography, FONT_FAMILY, RADIUS, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

/**
 * Hors ligne À LA MAIN alors que le serveur répond : l'accueil en ligne est à
 * un geste, sans passer par la pastille et sa bulle. Invisible en hors ligne
 * automatique (le retour y est automatique) et tant que le serveur ne répond
 * pas (la sonde continue à 15 s en mode manuel).
 */
export function OfflineBackOnlineCard() {
  const { t } = useTranslation(["offline", "downloads"]);
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const { state, reachable } = useConnectivity();
  if (state !== "offline-manual" || reachable !== true) return null;
  return (
    <View style={st.wrap}>
      <GlassSurface tier="subtle" tint="regular" radius={RADIUS.lg}>
        <View style={st.row}>
          <View style={st.disc} collapsable={false}>
            <Feather name="wifi" size={18} color={colors.brand.light} />
          </View>
          <View style={st.texts}>
            <Text style={st.title} numberOfLines={1}>{t("offline:serverReachableTitle")}</Text>
            <Text style={st.hint} numberOfLines={2}>{t("offline:serverReachableHint")}</Text>
          </View>
          <Button title={t("downloads:offlineGoOnline")} onPress={() => setManualOffline(false)} />
        </View>
      </GlassSurface>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: spacing.screenPadding, marginTop: spacing.lg },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
    disc: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.brand.soft,
      borderWidth: 1,
      borderColor: withAlpha(t.colors.brand.violet, 0.35, t.colors.brand.glow),
    },
    texts: { flex: 1, minWidth: 0 },
    title: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    hint: { ...typography.small, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary, marginTop: 2 },
  });
