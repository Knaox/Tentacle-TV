/**
 * Octave mobile — la FEUILLE D'ACTIONS d'un titre, au doigt (« ⋯ » ou appui
 * maintenu d'une rangée) : lire depuis lui, lire ensuite, ajouter à la file,
 * ajouter à une playlist, aimer, voir l'album, voir l'artiste. Les gestes sont
 * ceux du bureau (`useTrackActions`, `queueActions`) ; un geste impossible
 * n'est pas proposé. La feuille se ferme AVANT d'aller ailleurs.
 */

import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Disc3, Heart, ListEnd, ListPlus, ListStart, Mic2, Play } from "lucide-react-native";
import { openPlaylistChooser, useLiked } from "@tentacle-tv/api-client";
import { queueActions } from "@tentacle-tv/shared/octave";
import { entityTarget } from "@tentacle-tv/shared/octave/mode";
import { BottomSheet } from "@/components/ui";
import { typography, useTheme } from "@/theme";
import { useOctaveNav } from "../env/nav";
import { usePagesPlayer } from "../env/pagesPlayer";
import { useMobileTrackActions } from "../env/useMobileActionsUi";
import { Artwork } from "../ui/Artwork";
import { SheetAction } from "./SheetAction";
import { closeTrackSheet, useTrackSheet, type TrackSheetRequest } from "./trackSheetStore";

/** Une feuille ne s'ouvre qu'une fois la précédente partie (iOS ne présente pas deux fenêtres à la fois). */
const SHEET_HANDOFF_MS = 380;

function SheetBody({ request }: { request: TrackSheetRequest }) {
  const { t } = useTranslation("music");
  const player = usePagesPlayer();
  const actions = useMobileTrackActions();
  const nav = useOctaveNav();
  const { track, list, contextId, hide } = request;
  const liked = useLiked(track.key, track.favorite);
  const albumTarget = track.album ? entityTarget(track.album) : null;
  const artist = track.artists.find((a) => a.jellyfinId || a.external);
  const artistTarget = artist ? entityTarget(artist) : null;
  const then = (fn: () => void) => () => {
    closeTrackSheet();
    fn();
  };
  const index = Math.max(0, list.findIndex((x) => x.key === track.key));
  return (
    <View style={styles.body}>
      {player ? (
        <>
          <SheetAction icon={Play} label={t("common.playAll")} onPress={then(() => player.playList(list.length ? list : [track], list.length ? index : 0, contextId))} />
          <SheetAction icon={ListStart} label={t("track.playNext")} onPress={then(() => queueActions.playNext(player, [track]))} />
          <SheetAction icon={ListEnd} label={t("track.addToQueue")} onPress={then(() => queueActions.enqueue(player, [track]))} />
        </>
      ) : null}
      {actions.canAddToPlaylist(track) ? <SheetAction icon={ListPlus} label={t("playlist.addTo")} onPress={then(() => setTimeout(() => openPlaylistChooser(track), SHEET_HANDOFF_MS))} /> : null}
      {actions.canLike(track) ? (
        <SheetAction icon={Heart} filled={liked} tone={liked ? "accent" : undefined} label={t(liked ? "track.unlike" : "track.like")} onPress={then(() => actions.toggleLike(track))} />
      ) : null}
      {albumTarget && !hide?.album ? <SheetAction icon={Disc3} label={t("track.goToAlbum")} onPress={then(() => nav.albumTarget(albumTarget))} /> : null}
      {artistTarget && !hide?.artist ? <SheetAction icon={Mic2} label={t("track.goToArtist")} onPress={then(() => nav.artistTarget(artistTarget))} /> : null}
    </View>
  );
}

function SheetHeader({ request }: { request: TrackSheetRequest }) {
  const theme = useTheme();
  const { track } = request;
  return (
    <View style={styles.header}>
      <Artwork url={track.artworkUrl} size={52} radius={8} />
      <View style={styles.headerText}>
        <Text numberOfLines={1} style={[typography.bodyBold, { color: theme.colors.text.primary }]}>
          {track.title}
        </Text>
        <Text numberOfLines={1} style={[typography.caption, { color: theme.colors.text.tertiary }]}>
          {[track.artists.map((a) => a.name).join(", "), track.album?.title].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </View>
  );
}

export function TrackActionSheet() {
  const request = useTrackSheet();
  return (
    <BottomSheet visible={request !== null} onClose={closeTrackSheet} snapPoints={[0.56, 0.8]} header={request ? <SheetHeader request={request} /> : null}>
      {request ? <SheetBody request={request} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingBottom: 12 },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  body: { paddingHorizontal: 8, paddingBottom: 24 },
});
