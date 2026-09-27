import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useOfflineOverview } from "@tentacle-tv/offline-core/react";
import { GlassSurface, ProgressBar } from "@/components/ui";
import { useDiskInfo } from "@/hooks/offline/useOfflineList";
import { FONT_FAMILY, RADIUS, progressGradient, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import type { OfflineEntry } from "../engineApi";
import { formatBytes } from "../formatBytes";
import { OfflineModeRow } from "./OfflineModeRow";
import { OfflineQueueActions } from "./OfflineQueueActions";

type Tone = "success" | "info" | "warning" | "error";

/**
 * L'en-tête de « Sur cet appareil » : ce que le téléphone porte, en un coup
 * d'œil. Il remplace la jauge nue occupé / libre et la pastille « Tout mettre
 * en pause » posée seule au-dessus des transferts.
 *
 * Compteurs par état, espace en deux segments, avancement GLOBAL de la file
 * (en direct, sur le magasin de progression), gestes sur toute la file, et la
 * bascule du mode hors ligne.
 */
export function OfflineOverviewCard({ entries }: { entries: readonly OfflineEntry[] }) {
  const { t } = useTranslation("offline");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const overview = useOfflineOverview(entries);
  const { data: disk } = useDiskInfo();

  const used = disk?.usedBytes ?? overview.readyBytes;
  const free = disk?.freeBytes ?? null;
  const total = used + (free ?? 0);
  const usedRatio = total > 0 ? Math.min(1, used / total) : 0;
  const inFlight = overview.running + overview.paused + overview.errors;
  const ratio = overview.transferRatio;
  const gradient = progressGradient(theme.colors.brand);
  const active = entries.filter((entry) => entry.status !== "complete");

  const stats: { key: string; icon: keyof typeof Feather.glyphMap; tone: Tone; label: string }[] = [];
  if (overview.ready > 0) stats.push({ key: "ready", icon: "check-circle", tone: "success", label: t("overviewReady", { count: overview.ready }) });
  if (overview.running > 0) stats.push({ key: "running", icon: "loader", tone: "info", label: t("overviewRunning", { count: overview.running }) });
  if (overview.paused > 0) stats.push({ key: "paused", icon: "pause-circle", tone: "warning", label: t("overviewPaused", { count: overview.paused }) });
  if (overview.errors > 0) stats.push({ key: "errors", icon: "alert-triangle", tone: "error", label: t("overviewErrors", { count: overview.errors }) });

  return (
    <GlassSurface tier="subtle" tint="regular" radius={RADIUS.xl}>
      <View style={st.body}>
        {stats.length > 0 && (
          <View style={st.stats}>
            {stats.map((stat) => {
              const pair = theme.colors.statusPairs[stat.tone];
              return (
                <View key={stat.key} style={[st.stat, { backgroundColor: pair.bg }]}>
                  <Feather name={stat.icon} size={12} color={pair.fg} />
                  <Text style={[st.statText, { color: pair.fg }]}>{stat.label}</Text>
                </View>
              );
            })}
          </View>
        )}

        <View
          accessibilityRole="progressbar"
          accessibilityLabel={t("sectionSpace")}
          accessibilityValue={{ min: 0, max: 100, now: Math.round(usedRatio * 100) }}
          style={st.track}
        >
          {used > 0 && (
            <LinearGradient
              colors={gradient.colors}
              start={gradient.start}
              end={gradient.end}
              // Un trait minimal reste visible dès le premier octet.
              style={[st.fill, { width: `${Math.max(usedRatio * 100, 1)}%` }]}
            />
          )}
        </View>
        <View style={st.legend}>
          <View style={st.legendItem}>
            <View style={[st.dot, { backgroundColor: theme.colors.brand.violet }]} />
            <Text style={st.legendText}>{t("legendTitles")} · <Text style={st.legendValue}>{formatBytes(used)}</Text></Text>
          </View>
          {free !== null && (
            <View style={st.legendItem}>
              <View style={[st.dot, { backgroundColor: theme.colors.fill.strong }]} />
              <Text style={st.legendText}>{t("legendFree")} · <Text style={st.legendValue}>{formatBytes(free)}</Text></Text>
            </View>
          )}
        </View>

        {inFlight > 0 && (
          <View style={st.queue}>
            <Text style={st.queueTitle}>{t("overviewProgressLabel")}</Text>
            {ratio !== null && (
              <>
                <ProgressBar progress={ratio} height={5} showEmpty />
                <Text style={st.queueText}>
                  {t("overviewProgress", {
                    percent: Math.floor(ratio * 100),
                    done: formatBytes(overview.transferDone),
                    total: formatBytes(overview.transferTotal),
                  })}
                </Text>
              </>
            )}
            <OfflineQueueActions entries={active} />
          </View>
        )}

        <OfflineModeRow />
      </View>
    </GlassSurface>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    body: { padding: spacing.md, gap: spacing.md },
    stats: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    stat: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: RADIUS.pill },
    statText: { ...typography.small, fontFamily: FONT_FAMILY.semibold },
    track: { height: 8, borderRadius: RADIUS.pill, backgroundColor: t.colors.fill.subtle, overflow: "hidden" },
    fill: { height: "100%", borderRadius: RADIUS.pill },
    legend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8, marginTop: -6 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { ...typography.caption, color: t.colors.text.tertiary },
    legendValue: { fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary, fontVariant: ["tabular-nums"] },
    queue: { gap: 8, padding: spacing.md, borderRadius: RADIUS.lg, backgroundColor: t.colors.fill.faint },
    queueTitle: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
    queueText: { ...typography.small, color: t.colors.text.quaternary, fontVariant: ["tabular-nums"] },
  });
