import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Badge, Button, GlassCard } from "@/components/ui";
import { setAutoDeleteAfterWatch, type OfflineEntry } from "@/offline/engineApi";
import { formatBytes } from "@/offline/formatBytes";
import { AutoDeleteChips, type AutoDeleteValue } from "@/offline/keep/AutoDeleteChips";
import { scheduleText } from "@/offline/manage/autoDeleteText";
import { variantLabel } from "@/offline/manage/OfflineEntryRow";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

interface Props {
  entry: OfflineEntry;
  userId: string | null;
  onToggleWatched: (entry: OfflineEntry, played: boolean) => void;
  onRemove: () => void;
  busy: boolean;
}

/**
 * La carte « Sur l'appareil » de la fiche locale : ce que le titre est ici
 * (version, taille, Prêt), le rond « vu », la suppression après visionnage
 * avec son échéance, et « Retirer de l'appareil ».
 */
export function OfflineOnDeviceCard({ entry, userId, onToggleWatched, onRemove, busy }: Props) {
  const { t, i18n } = useTranslation(["offline", "downloads", "common"]);
  const { colors, isDark } = useTheme();
  const st = useThemedStyles(makeStyles);
  const accentText = isDark ? colors.brand.accentLight : colors.brand.accent;
  const td = useCallback((key: string) => t(`downloads:${key}`), [t]);
  const to = useCallback((key: string) => t(`offline:${key}`), [t]);
  const autoDelete: AutoDeleteValue = entry.autoDeleteAfterWatch ? entry.autoDeleteDelayMinutes : null;
  const onAutoDelete = useCallback((value: AutoDeleteValue) => {
    if (userId === null) return;
    setAutoDeleteAfterWatch(userId, entry.id, value !== null, value ?? 0);
  }, [userId, entry.id]);

  return (
    <View style={st.wrap}>
      <GlassCard>
        <View style={st.head}>
          <View style={st.disc} collapsable={false}>
            <Feather name="smartphone" size={18} color={colors.brand.light} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.title}>{to("stateOnDevice")}</Text>
            <Text style={st.sub} numberOfLines={1}>{variantLabel(entry, td, to)} · {formatBytes(entry.bytesDone)}</Text>
          </View>
          <Badge label={to("statusReady")} variant="success" />
        </View>

        <Pressable
          onPress={() => onToggleWatched(entry, !entry.played)}
          style={st.row}
          accessibilityRole="button"
          accessibilityLabel={entry.played ? t("common:markUnwatched") : t("common:markWatched")}
        >
          <Text style={st.rowLabel}>{t("common:watched")}</Text>
          <View style={[st.ring, entry.played && st.ringPlayed]} collapsable={false}>
            <Feather name="check" size={16} color={entry.played ? accentText : colors.text.disabled} />
          </View>
        </Pressable>

        <View style={st.autoDelete}>
          <AutoDeleteChips value={autoDelete} onChange={onAutoDelete} />
          {entry.deleteScheduledAt !== null && (
            <Text style={st.schedule}>{scheduleText(entry.deleteScheduledAt, td, i18n.language)}</Text>
          )}
        </View>

        <Button title={to("remove")} onPress={onRemove} variant="danger" loading={busy} fullWidth />
      </GlassCard>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: spacing.screenPadding, marginTop: spacing.xl, maxWidth: 640 },
    head: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
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
    title: { ...typography.bodyBold, color: t.colors.text.primary },
    sub: { ...typography.caption, color: t.colors.text.tertiary, marginTop: 1 },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
    rowLabel: { ...typography.body, color: t.colors.text.primary },
    ring: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.fill.subtle,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
    },
    ringPlayed: {
      backgroundColor: withAlpha(t.colors.brand.accent, 0.15, t.colors.brand.soft),
      borderColor: withAlpha(t.colors.brand.accent, 0.45, t.colors.brand.glow),
    },
    autoDelete: { paddingVertical: spacing.sm, gap: 8, marginBottom: spacing.md },
    schedule: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
  });
