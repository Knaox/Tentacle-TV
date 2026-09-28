import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import { groupOfflineEntries, groupSeasonsBySeries, readyBytesOf, seasonLabel } from "@tentacle-tv/offline-core";
import { SelectionBar } from "@/components/SelectionBar";
import { IconButton } from "@/components/ui";
import { goHome } from "@/utils/backOrHome";
import { useOfflineList } from "@/hooks/offline/useOfflineList";
import { SettingsScaffold } from "@/screens/settings/SettingsScaffold";
import { spacing, typography, FONT_FAMILY, useResponsive, useThemedStyles, type AppTheme } from "@/theme";
import type { OfflineEntry } from "../engineApi";
import { transferWait, useTransferWaitContext, wifiBlocked } from "../transferGate";
import { BulkAutoDeleteSheet, useBulkOfflineActions } from "./OfflineBulkActions";
import { OfflineCatalogLinkCard } from "./OfflineCatalogLinkCard";
import { OfflineEntryRow } from "./OfflineEntryRow";
import { OfflineRowActionsSheet } from "./OfflineRowActionsSheet";
import { formatBytes } from "../formatBytes";
import { OfflineManageEmpty } from "./OfflineManageEmpty";
import { OfflineManageSection } from "./OfflineManageSection";
import { OfflineOverviewCard } from "./OfflineOverviewCard";
import { useOfflineSelection } from "./useOfflineSelection";
import { WifiWaitCard } from "./WifiWaitCard";

/**
 * « Sur cet appareil » — l'écran de gestion : la carte de synthèse (états,
 * espace, avancement global, gestes sur la file, mode hors ligne), l'entrée
 * vers le catalogue hors ligne, puis les sections repliables En cours / Films /
 * une par série (saison par saison), chaque ligne avec sa progression en
 * direct et ses actions. Vide : l'état d'accueil en trois étapes. Sur une
 * tablette assez large, les lignes passent sur deux colonnes.
 */
export function OfflineManageScreen() {
  const { t } = useTranslation("downloads");
  const { t: to } = useTranslation("offline");
  const st = useThemedStyles(makeStyles);
  const { isTablet, width } = useResponsive();
  // Deux colonnes seulement quand chacune garde la largeur d'un téléphone.
  const columns = isTablet && width >= 900 ? 2 : 1;
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
  const row = (entry: OfflineEntry, hideSeries = false) => (
    <OfflineEntryRow
      key={entry.id}
      entry={entry}
      hideSeries={hideSeries}
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
    <SettingsScaffold title={to("manageTitle")} trailing={trailing} maxWidth={columns === 2 ? 1040 : 720}>
      <View style={st.overview}><OfflineOverviewCard entries={entries} /></View>
      <OfflineCatalogLinkCard />

      {entries.length === 0 && <OfflineManageEmpty />}

      {waitingWifi && <WifiWaitCard count={groups.active.filter((entry) => transferWait(entry, waitCtx) === "wifi").length} />}
      {groups.active.length > 0 && (
        <OfflineManageSection title={t("sectionActive")} summary={String(groups.active.length)} columns={columns}>
          {groups.active.map((entry) => row(entry))}
        </OfflineManageSection>
      )}
      {groups.movies.length > 0 && (
        <OfflineManageSection
          title={t("sectionMovies")}
          summary={`${to("countTitles", { count: groups.movies.length })} · ${formatBytes(readyBytesOf(groups.movies))}`}
          columns={columns}
        >
          {groups.movies.map((entry) => row(entry))}
        </OfflineManageSection>
      )}
      {groups.series.map((series) => {
        const episodes = series.seasons.flatMap((season) => season.episodes);
        return (
          <OfflineManageSection
            key={series.key}
            title={series.seriesName}
            summary={`${to("episodesShort", { count: episodes.length })} · ${formatBytes(readyBytesOf(episodes))}`}
          >
            {series.seasons.map((season) => (
              <View key={season.key} style={st.list}>
                {series.seasons.length > 1 && (
                  <Text style={st.seasonTitle}>{seasonLabel((key, options) => t(key.replace(/^downloads:/, ""), options), season.seasonNumber)}</Text>
                )}
                <View style={columns === 2 ? st.grid : st.list}>
                  {season.episodes.map((entry) => (columns === 2 ? <View key={entry.id} style={st.cell}>{row(entry, true)}</View> : row(entry, true)))}
                </View>
              </View>
            ))}
          </OfflineManageSection>
        );
      })}

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
    overview: { marginBottom: spacing.lg },
    trailing: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
    trailingRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    barSpacer: { height: 140 },
    seasonTitle: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary, marginLeft: spacing.xs, marginTop: spacing.xs },
    list: { gap: 8 },
    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
    cell: { width: "49.2%" },
  });
