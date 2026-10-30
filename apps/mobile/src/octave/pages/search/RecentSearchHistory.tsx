/**
 * Octave mobile — l'HISTORIQUE de la recherche avant la frappe (`useOctaveSearchHistory`, le même que le bureau
 * quand le serveur le garde) : les recherches récentes (toucher : relancer) et les titres récemment recherchés,
 * pochette comprise (toucher : les relire). ✕ retire une entrée ; « Tout effacer » demande confirmation.
 */

import { memo, useCallback } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Clock, X } from "lucide-react-native";
import type { OctaveSearchHistory } from "@tentacle-tv/api-client";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { recentTracksOf } from "@tentacle-tv/shared/octave";
import { typography, useTheme } from "@/theme";
import { usePagesPlayer } from "../env/pagesPlayer";
import { playFrom } from "../env/playFrom";
import { Artwork } from "../ui/Artwork";
import { SectionTitle } from "../ui/Shelf";
import { usePageMetrics } from "../ui/pageStyle";

interface Props {
  recents: readonly string[];
  history: OctaveSearchHistory;
  onSearch: (text: string) => void;
}

function ClearAll({ history }: { history: OctaveSearchHistory }) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const ask = useCallback(() => {
    Alert.alert(t("searchHistory.clearTitle"), history.scope === "account" ? t("searchHistory.clearMessage") : t("searchHistory.clearMessageDevice"), [
      { text: t("searchHistory.cancel"), style: "cancel" },
      { text: t("searchHistory.clearAll"), style: "destructive", onPress: history.clearAll },
    ]);
  }, [history.clearAll, history.scope, t]);
  return (
    <Pressable onPress={ask} hitSlop={8} accessibilityRole="button" style={styles.clear}>
      <Text style={[typography.caption, { color: theme.colors.text.secondary }]}>{t("searchHistory.clearAll")}</Text>
    </Pressable>
  );
}

const TrackLine = memo(function TrackLine({ track, onForget }: { track: MusicTrack; onForget: (key: string) => void }) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const player = usePagesPlayer();
  const { gutter } = usePageMetrics();
  return (
    <View style={[styles.row, { paddingLeft: gutter, paddingRight: gutter - 8 }]}>
      <Pressable
        onPress={() => playFrom(player, [track], 0, null)}
        accessibilityRole="button"
        accessibilityLabel={t("track.play", { title: track.title })}
        style={({ pressed }) => [styles.main, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Artwork url={track.artworkUrl} size={48} radius={6} />
        <View style={styles.text}>
          <Text numberOfLines={1} style={[typography.body, { color: theme.colors.text.primary }]}>{track.title}</Text>
          <Text numberOfLines={1} style={[typography.caption, { color: theme.colors.text.tertiary }]}>{track.artists.map((a) => a.name).join(", ")}</Text>
        </View>
      </Pressable>
      <Pressable onPress={() => onForget(track.key)} hitSlop={6} style={styles.forget} accessibilityRole="button" accessibilityLabel={t("searchHistory.forgetTrack", { title: track.title })}>
        <X size={16} color={theme.colors.text.tertiary} />
      </Pressable>
    </View>
  );
});

export const RecentSearchHistory = memo(function RecentSearchHistory({ recents, history, onSearch }: Props) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const { gutter } = usePageMetrics();
  const tracks = recentTracksOf(history.history);
  if (recents.length === 0 && tracks.length === 0) return null;
  return (
    <>
      {recents.length > 0 ? (
        <View>
          <SectionTitle title={t("search.recentTitle")} action={<ClearAll history={history} />} />
          {recents.map((query) => (
            <View key={query} style={[styles.recent, { paddingLeft: gutter, paddingRight: gutter - 8 }]}>
              <Pressable onPress={() => onSearch(query)} accessibilityRole="button" style={({ pressed }) => [styles.recentMain, { opacity: pressed ? 0.6 : 1 }]}>
                <Clock size={16} color={theme.colors.text.tertiary} />
                <Text numberOfLines={1} style={[typography.body, { color: theme.colors.text.primary, flex: 1 }]}>{query}</Text>
              </Pressable>
              <Pressable onPress={() => history.forgetQuery(query)} hitSlop={6} style={styles.forget} accessibilityRole="button" accessibilityLabel={t("search.forget", { query })}>
                <X size={16} color={theme.colors.text.tertiary} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {tracks.length > 0 ? (
        <View>
          <SectionTitle title={t("searchHistory.tracksTitle")} action={recents.length === 0 ? <ClearAll history={history} /> : undefined} />
          {tracks.map(({ track }) => (
            <TrackLine key={track.key} track={track} onForget={history.forgetTrack} />
          ))}
        </View>
      ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  clear: { minHeight: 44, justifyContent: "center", paddingLeft: 12 },
  recent: { flexDirection: "row", alignItems: "center" },
  recentMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  row: { flexDirection: "row", alignItems: "center" },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 6 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  forget: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
