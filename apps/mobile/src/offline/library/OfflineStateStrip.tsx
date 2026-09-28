import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { GlassSurface } from "@/components/ui";
import { useDiskInfo, useOfflineActivity } from "@/hooks/offline/useOfflineList";
import { PulseDot } from "@/offline/entry/PulseDot";
import { formatBytes } from "@/offline/formatBytes";
import { spacing, typography, FONT_FAMILY, RADIUS, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

interface Props {
  /** Le lien « Gérer » vers l'écran de gestion (inutile quand on en vient). */
  showManage: boolean;
}

/**
 * Ce que l'appareil porte, sous le bandeau : « 12 titres · 4,2 Gio », la
 * jauge de cette place sur l'espace du téléphone (dégradé de marque, statique),
 * les transferts en cours (point pulsant) et « Gérer › » — le résumé qu'en
 * donnent l'icône d'en-tête et le profil, ici en clair. La jauge est posée en
 * largeur fixe proportionnelle : aucune animation de taille.
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
  const total = disk ? disk.usedBytes + disk.freeBytes : 0;
  const ratio = disk && total > 0 ? Math.min(1, Math.max(0.01, disk.usedBytes / total)) : null;

  return (
    <View style={st.wrap}>
      <GlassSurface tier="subtle" tint="regular" radius={RADIUS.lg}>
        <View style={st.body}>
          <View style={st.disc} collapsable={false}>
            <Feather name="smartphone" size={17} color={colors.brand.light} />
          </View>
          <View style={st.texts}>
            <Text style={st.title}>{t("tabOnDevice")}</Text>
            <View style={st.lineRow}>
              <Text style={st.line} numberOfLines={1}>{parts.join(" · ")}</Text>
              {active > 0 && (
                <View style={st.activeWrap}>
                  <PulseDot size={6} corner={false} />
                  <Text style={st.active} numberOfLines={1}>{t("countActive", { count: active })}</Text>
                </View>
              )}
            </View>
            {ratio !== null && (
              <View
                style={st.track}
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={t("sectionSpace")}
                accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
              >
                <LinearGradient
                  colors={[colors.brand.violet, colors.brand.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[st.fill, { width: `${ratio * 100}%` as unknown as number }]}
                />
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
      </GlassSurface>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: spacing.screenPadding, marginTop: spacing.lg },
    body: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
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
    lineRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 1 },
    line: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, flexShrink: 1 },
    activeWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
    active: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
    track: { height: 4, borderRadius: 2, marginTop: 8, overflow: "hidden", backgroundColor: t.colors.fill.soft, maxWidth: 260 },
    fill: { height: "100%", borderRadius: 2 },
    manage: { flexDirection: "row", alignItems: "center", gap: 2, paddingLeft: 8, minHeight: 44 },
    manageTxt: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light, letterSpacing: 0.1 },
  });
