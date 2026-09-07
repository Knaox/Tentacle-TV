import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useDiskInfo, useOfflineActivity } from "@/hooks/offline/useOfflineList";
import { PulseDot } from "@/offline/entry/PulseDot";
import { formatBytes } from "@/offline/formatBytes";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

interface Props {
  /** Le lien « Gérer » vers l'écran de gestion (inutile quand on en vient). */
  showManage: boolean;
}

/**
 * Une ligne sobre sous le bandeau : « 12 titres · 4,2 Gio · 2 en préparation »
 * (point pulsant pendant un transfert) et le lien « Gérer › » — le résumé
 * qu'affichent l'icône d'en-tête et la section du profil, ici en clair.
 */
export function OfflineStateStrip({ showManage }: Props) {
  const { t } = useTranslation("offline");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const router = useRouter();
  const { active, ready } = useOfflineActivity();
  const { data: disk } = useDiskInfo();

  const parts = [t("countTitles", { count: ready })];
  if (disk && disk.usedBytes > 0) parts.push(formatBytes(disk.usedBytes));

  return (
    <View style={st.row}>
      <View style={st.lead}>
        <Text style={st.text} numberOfLines={1}>{parts.join(" · ")}</Text>
        {active > 0 && (
          <View style={st.activeWrap}>
            <PulseDot size={6} corner={false} />
            <Text style={st.active} numberOfLines={1}>{t("countActive", { count: active })}</Text>
          </View>
        )}
      </View>
      {showManage && (
        <Pressable onPress={() => router.push("/on-device")} hitSlop={10} style={st.manage} accessibilityRole="button" accessibilityLabel={t("manage")}>
          <Text style={st.manageTxt}>{t("manage")}</Text>
          <Feather name="chevron-right" size={14} color={colors.brand.light} />
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.screenPadding,
      marginTop: spacing.lg,
      gap: spacing.md,
    },
    lead: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, minWidth: 0 },
    text: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, flexShrink: 1 },
    activeWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
    active: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
    manage: { flexDirection: "row", alignItems: "center", gap: 2, paddingLeft: 8 },
    manageTxt: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light, letterSpacing: 0.1 },
  });
