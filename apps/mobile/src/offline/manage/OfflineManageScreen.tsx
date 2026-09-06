import { useMemo, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useUserId } from "@tentacle-tv/api-client";
import { groupOfflineEntries, groupSeasonsBySeries, seasonLabel } from "@tentacle-tv/offline-core";
import { useOfflineList } from "@/hooks/offline/useOfflineList";
import { SettingsScaffold } from "@/screens/settings/SettingsScaffold";
import { spacing, typography, FONT_FAMILY, LETTER_SPACING, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import type { OfflineEntry } from "../engineApi";
import { useWifiOnly } from "../settings";
import { useConnectivity } from "../useConnectivity";
import { OfflineEntryRow } from "./OfflineEntryRow";
import { OfflineRowActionsSheet } from "./OfflineRowActionsSheet";
import { OfflineSpaceBar } from "./OfflineSpaceBar";

function Section({ title, children }: { title: string; children: ReactNode }) {
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.section}>
      <Text style={st.sectionTitle}>{title}</Text>
      <View style={st.list}>{children}</View>
    </View>
  );
}

/**
 * « Sur cet appareil » — l'écran de gestion : la jauge d'espace, puis les
 * sections En cours / Films / une par série (saison par saison), chaque ligne
 * avec sa progression en direct et ses actions. Vide : l'état d'accueil.
 */
export function OfflineManageScreen() {
  const { t } = useTranslation("downloads");
  const { t: to } = useTranslation("offline");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const router = useRouter();
  const userId = useUserId();
  const { data } = useOfflineList(userId);
  const entries = useMemo(() => data ?? [], [data]);
  const { networkType } = useConnectivity();
  const wifiOnly = useWifiOnly();
  const waitingWifi = wifiOnly && networkType === "cellular";
  const [more, setMore] = useState<OfflineEntry | null>(null);

  const groups = useMemo(() => {
    const active = entries.filter((entry) => entry.status !== "complete");
    const complete = entries.filter((entry) => entry.status === "complete");
    const grouped = groupOfflineEntries(complete);
    return { active, movies: grouped.movies, series: groupSeasonsBySeries(grouped.seasons) };
  }, [entries]);

  const onPlay = (entry: OfflineEntry) => router.push(`/watch/${entry.itemId}`);
  const row = (entry: OfflineEntry) => (
    <OfflineEntryRow key={entry.id} entry={entry} onPlay={onPlay} onMore={setMore} waitingWifi={waitingWifi && entry.status !== "complete"} />
  );

  return (
    <SettingsScaffold title={to("manageTitle")}>
      <View style={st.space}><OfflineSpaceBar /></View>

      {entries.length === 0 && (
        <View style={st.empty}>
          <Feather name="smartphone" size={40} color={colors.text.quaternary} />
          <Text style={st.emptyTitle}>{to("emptyTitle")}</Text>
          <Text style={st.emptyMessage}>{to("emptyMessage")}</Text>
        </View>
      )}

      {groups.active.length > 0 && <Section title={t("sectionActive")}>{groups.active.map(row)}</Section>}
      {groups.movies.length > 0 && <Section title={t("sectionMovies")}>{groups.movies.map(row)}</Section>}
      {groups.series.map((series) => (
        <Section key={series.key} title={series.seriesName}>
          {series.seasons.map((season) => (
            <View key={season.key} style={st.list}>
              {series.seasons.length > 1 && (
                <Text style={st.seasonTitle}>{seasonLabel((key, options) => t(key.replace(/^downloads:/, ""), options), season.seasonNumber)}</Text>
              )}
              {season.episodes.map(row)}
            </View>
          ))}
        </Section>
      ))}

      <OfflineRowActionsSheet entry={more} onClose={() => setMore(null)} onPlay={onPlay} />
    </SettingsScaffold>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    space: { marginBottom: spacing.xl },
    section: { marginBottom: spacing.xl },
    sectionTitle: {
      ...typography.caption,
      fontFamily: FONT_FAMILY.semibold,
      letterSpacing: LETTER_SPACING.wide,
      color: t.colors.text.tertiary,
      textTransform: "uppercase",
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },
    seasonTitle: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary, marginLeft: spacing.xs, marginTop: spacing.xs },
    list: { gap: 8 },
    empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
    emptyTitle: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, textAlign: "center", marginTop: spacing.sm },
    emptyMessage: { ...typography.body, color: t.colors.text.tertiary, textAlign: "center", lineHeight: 20 },
  });
