import { useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useUserId } from "@tentacle-tv/api-client";
import { groupOfflineEntries, groupSeasonsBySeries, seasonLabel } from "@tentacle-tv/offline-core";
import { SelectionBar } from "@/components/SelectionBar";
import { IconButton } from "@/components/ui";
import { goHome } from "@/utils/backOrHome";
import { useOfflineList } from "@/hooks/offline/useOfflineList";
import { SettingsScaffold } from "@/screens/settings/SettingsScaffold";
import { spacing, typography, FONT_FAMILY, LETTER_SPACING, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import type { OfflineEntry } from "../engineApi";
import { transferWait, useTransferWaitContext, wifiBlocked } from "../transferGate";
import { BulkAutoDeleteSheet, useBulkOfflineActions } from "./OfflineBulkActions";
import { PauseAllRow } from "./PauseAllRow";
import { OfflineCatalogLinkCard } from "./OfflineCatalogLinkCard";
import { OfflineEntryRow } from "./OfflineEntryRow";
import { OfflineRowActionsSheet } from "./OfflineRowActionsSheet";
import { OfflineSpaceBar } from "./OfflineSpaceBar";
import { useOfflineSelection } from "./useOfflineSelection";
import { WifiWaitCard } from "./WifiWaitCard";

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
 * « Sur cet appareil » — l'écran de gestion : la jauge d'espace, l'entrée
 * vers le catalogue hors ligne, puis les sections En cours / Films / une par
 * série (saison par saison), chaque ligne avec sa progression en direct et
 * ses actions. Vide : l'état d'accueil.
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
  const waitCtx = useTransferWaitContext();
  const waitingWifi = wifiBlocked(waitCtx);
  const [more, setMore] = useState<OfflineEntry | null>(null);
  const ids = useMemo(() => entries.map((entry) => entry.id), [entries]);
  const selection = useOfflineSelection(ids);
  const [bulkAutoDelete, setBulkAutoDelete] = useState(false);
  const bulk = useBulkOfflineActions(userId, selection.selection, selection.exit);

  const groups = useMemo(() => {
    const active = entries.filter((entry) => entry.status !== "complete");
    const complete = entries.filter((entry) => entry.status === "complete");
    const grouped = groupOfflineEntries(complete);
    return { active, movies: grouped.movies, series: groupSeasonsBySeries(grouped.seasons) };
  }, [entries]);

  const onPlay = (entry: OfflineEntry) => router.push(`/watch/${entry.itemId}`);
  const onInfo = (entry: OfflineEntry) => router.push(`/on-device/item/${entry.itemId}` as never);
  const row = (entry: OfflineEntry) => (
    <OfflineEntryRow
      key={entry.id}
      entry={entry}
      onPlay={onPlay}
      onMore={setMore}
      wait={transferWait(entry, waitCtx)}
      selection={selection.active ? { selected: selection.selection.has(entry.id), onToggle: selection.toggle } : undefined}
    />
  );

  // À droite du titre : « Sélectionner » (puis « Annuler la sélection ») et
  // le retour à l'accueil — l'écran s'ouvre aussi en ligne, loin des onglets.
  const trailing = (
    <View style={st.trailingRow}>
      {entries.length > 0 && (
        <Pressable onPress={selection.active ? selection.exit : selection.enter} hitSlop={8} accessibilityRole="button">
          <Text style={st.trailing}>{selection.active ? t("selectCancel") : t("selectMode")}</Text>
        </Pressable>
      )}
      <IconButton icon="home" size={32} onPress={() => goHome(router)} accessibilityLabel={to("emptyGoHome")} />
    </View>
  );

  return (
    <View style={st.screen}>
    <SettingsScaffold title={to("manageTitle")} trailing={trailing}>
      <View style={st.space}><OfflineSpaceBar /></View>
      <OfflineCatalogLinkCard />

      {entries.length === 0 && (
        <View style={st.empty}>
          <Feather name="smartphone" size={40} color={colors.text.quaternary} />
          <Text style={st.emptyTitle}>{to("emptyTitle")}</Text>
          <Text style={st.emptyMessage}>{to("emptyMessage")}</Text>
        </View>
      )}

      {waitingWifi && <WifiWaitCard count={groups.active.filter((entry) => transferWait(entry, waitCtx) === "wifi").length} />}
      {groups.active.length > 0 && (
        <Section title={t("sectionActive")}>
          <PauseAllRow entries={groups.active} />
          {groups.active.map(row)}
        </Section>
      )}
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

      {selection.active && <View style={st.barSpacer} />}
      <OfflineRowActionsSheet entry={more} onClose={() => setMore(null)} onPlay={onPlay} onInfo={onInfo} />
      <BulkAutoDeleteSheet visible={bulkAutoDelete} onClose={() => setBulkAutoDelete(false)} onApply={bulk.applyAutoDelete} />
    </SettingsScaffold>
    {selection.active && (
      <SelectionBar
        count={selection.count}
        totalCount={ids.length}
        onSelectAll={selection.toggleAll}
        onDelete={bulk.removeSelected}
        onCancel={selection.exit}
        removeLabel={to("bulkRemove", { count: selection.count })}
        secondaryAction={{ label: t("autoDeleteShort"), onPress: () => setBulkAutoDelete(true) }}
      />
    )}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    screen: { flex: 1 },
    space: { marginBottom: spacing.xl },
    trailing: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
    trailingRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    barSpacer: { height: 140 },
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
