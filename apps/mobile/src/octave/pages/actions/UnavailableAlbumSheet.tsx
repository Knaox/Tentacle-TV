/**
 * Octave mobile — la feuille d'un album qui ne se lit pas (`unavailableAlbum.ts`, shared ; la boîte du bureau en est
 * le pendant) : ouverte par sa carte grisée, elle dit pourquoi (absent de YouTube) et propose de l'AIMER ou de
 * l'AJOUTER À UNE PLAYLIST — le serveur le récupère alors. Elle charge l'album pour en avoir les titres ; trouvé
 * lisible entre-temps, sa page s'ouvre à la place.
 */

import { useEffect, useSyncExternalStore } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { CloudOff, Heart, ListPlus, RotateCcw } from "lucide-react-native";
import {
  closeUnavailableAlbum, likeOverrideOf, openPlaylistChooserForMany, subscribeUnavailableAlbum, unavailableAlbumSnapshot, useMusicAlbumEntity,
} from "@tentacle-tv/api-client";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import { unavailableAlbumPhase, unavailableAlbumTracks } from "@tentacle-tv/shared/octave";
import { entityTarget } from "@tentacle-tv/shared/octave/mode";
import { BottomSheet } from "@/components/ui";
import { typography, useTheme } from "@/theme";
import { useOctaveNav } from "../env/nav";
import { showNotice } from "../env/notices";
import { useOctavePagesProvider } from "../env/pagesEnv";
import { useMobileTrackActions } from "../env/useMobileActionsUi";
import { Artwork } from "../ui/Artwork";
import { accentTextOf } from "../ui/pageStyle";
import { SheetAction } from "./SheetAction";

function Body({ target }: { target: string }) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const nav = useOctaveNav();
  const actions = useMobileTrackActions();
  // Sans aperçu : la feuille a besoin de la RÉPONSE (ses titres), jamais de ce que la carte montrait.
  const loaded = useMusicAlbumEntity(useOctavePagesProvider(), target);
  const phase = unavailableAlbumPhase(loaded);
  const tracks = unavailableAlbumTracks(phase, loaded.data);
  const toLike = tracks.filter((tr) => actions.canLike(tr) && !(likeOverrideOf(tr.key) ?? tr.favorite));
  const addable = tracks.filter(actions.canAddToPlaylist);

  // Trouvé lisible à l'ouverture (la recherche n'en montrait qu'une partie) : sa page, comme tout album.
  useEffect(() => {
    if (phase !== "playable" || !loaded.data) return;
    closeUnavailableAlbum();
    nav.album(loaded.data);
  }, [loaded.data, nav, phase]);

  const like = () => {
    for (const track of toLike) actions.toggleLike(track, { quiet: true });
    closeUnavailableAlbum();
    showNotice("success", t("selection.liked", { count: toLike.length }));
  };
  const status = phase === "lost" ? t("unavailableAlbum.lost") : phase === "failed" ? t("unavailableAlbum.failed") : null;
  return (
    <View style={styles.body}>
      <Text style={[typography.body, styles.text, { color: theme.colors.text.secondary }]}>{t("unavailableAlbum.body")}</Text>
      {phase === "loading" ? (
        <View style={styles.status} accessibilityLiveRegion="polite">
          <ActivityIndicator color={accentTextOf(theme)} />
          <Text style={[typography.caption, { color: theme.colors.text.tertiary }]}>{t("unavailableAlbum.loading")}</Text>
        </View>
      ) : null}
      {status ? (
        <Text accessibilityLiveRegion="polite" style={[typography.caption, styles.text, styles.statusText, { color: theme.colors.text.tertiary }]}>
          {status}
        </Text>
      ) : null}
      {phase === "failed" ? <SheetAction icon={RotateCcw} label={t("common.retry")} tone="accent" onPress={() => void loaded.refetch()} /> : null}
      {phase === "ready" && toLike.length > 0 ? <SheetAction icon={Heart} label={t("unavailableAlbum.like")} tone="accent" onPress={like} /> : null}
      {phase === "ready" && addable.length > 0 ? (
        <SheetAction
          icon={ListPlus}
          label={t("unavailableAlbum.addToPlaylist")}
          onPress={() => {
            closeUnavailableAlbum();
            openPlaylistChooserForMany(addable);
          }}
        />
      ) : null}
    </View>
  );
}

function Header({ album }: { album: MusicAlbum }) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.art}>
        <Artwork url={album.artworkUrl} size={56} radius={8} />
      </View>
      <View style={styles.headerText}>
        <View style={styles.titleRow}>
          <CloudOff size={16} color={theme.colors.text.tertiary} />
          <Text style={[typography.subtitle, { color: theme.colors.text.primary }]} numberOfLines={1}>
            {t("unavailableAlbum.title")}
          </Text>
        </View>
        <Text style={[typography.caption, { color: theme.colors.text.tertiary }]} numberOfLines={2}>
          {album.title} · {album.artists.map((a) => a.name).join(", ")}
        </Text>
      </View>
    </View>
  );
}

export function UnavailableAlbumSheet() {
  const album = useSyncExternalStore(subscribeUnavailableAlbum, unavailableAlbumSnapshot, unavailableAlbumSnapshot);
  const target = album ? entityTarget(album) : null;
  return (
    <BottomSheet visible={album !== null && target !== null} onClose={closeUnavailableAlbum} snapPoints={[0.5, 0.75]} header={album ? <Header album={album} /> : null}>
      {album && target ? <Body key={target} target={target} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingBottom: 12 },
  // La pochette d'un album qu'on n'écoute pas : estompée, comme sa carte.
  art: { opacity: 0.5 },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  body: { paddingHorizontal: 4, gap: 4 },
  text: { paddingHorizontal: 16 },
  status: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 12 },
  statusText: { paddingVertical: 8 },
});
