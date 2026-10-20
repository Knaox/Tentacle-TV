import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { GlassSurface, PressableCard } from "@/components/ui";
import { useOfflineActivity } from "@/hooks/offline/useOfflineList";
import { spacing, typography, FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/**
 * L'entrée vers le catalogue hors ligne depuis l'écran de gestion : l'accueil
 * tel qu'il s'affiche sans réseau, consultable même en ligne — une vue plus
 * propre de ce qui est sur l'appareil. Masquée tant que rien n'est prêt.
 */
export function OfflineCatalogLinkCard() {
  const { t } = useTranslation("offline");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const router = useRouter();
  const { ready } = useOfflineActivity();
  if (ready === 0) return null;
  return (
    <PressableCard onPress={() => router.push("/on-device/library" as never)} accessibilityRole="button" accessibilityLabel={t("openCatalog")} style={st.wrap}>
      <GlassSurface tier="subtle" tint="regular" radius={RADIUS.lg}>
        <View style={st.row}>
          {/* Une ligne de navigation : pictogramme sur puce neutre, chevron. */}
          <View style={st.disc}>
            <Feather name="film" size={20} color={theme.colors.brand.light} />
          </View>
          <View style={st.texts}>
            <Text style={st.title} numberOfLines={1}>{t("openCatalog")}</Text>
            <Text style={st.hint} numberOfLines={2}>{t("openCatalogHint")}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={theme.colors.text.tertiary} />
        </View>
      </GlassSurface>
    </PressableCard>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { marginBottom: spacing.xl },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
    disc: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.fill.soft },
    texts: { flex: 1, minWidth: 0 },
    title: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    hint: { ...typography.small, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary, marginTop: 2 },
  });
