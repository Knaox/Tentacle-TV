/**
 * Octave (mobile) — les gestes sur le titre EN COURS, dans le lecteur plein écran, comme au bureau : le cœur,
 * « Ajouter à une playlist » et le menu du titre (la feuille d'actions des pages : lire ensuite, garder hors
 * ligne, voir l'album…). Les gestes et leurs droits sont ceux du bureau (`useTrackActions`, par l'adaptateur des
 * pages) : un geste que le compte n'a pas le droit de faire n'est PAS affiché (règle 15 du lot) — le menu, lui,
 * reste, il ne propose que ce qui est permis.
 */

import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ellipsis, Heart, ListPlus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { openPlaylistChooser, useLiked } from "@tentacle-tv/api-client";
import type { TrackActions } from "@tentacle-tv/api-client";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { haptic } from "@/utils/haptics";
import { openTrackSheet } from "../pages/actions/trackSheetStore";
import { useMobileTrackActions } from "../pages/env/useMobileActionsUi";
import { usePlayerSelector } from "./OctavePlayerContext";
import { useOctaveColors } from "../theme/octaveColors";

export interface NowPlayingActionsShown {
  like: boolean;
  addToPlaylist: boolean;
  /** Le menu du titre reste : il ne propose lui-même que ce qui est permis. */
  menu: true;
}

/** Ce que le rang montre pour ce titre, d'après les gestes partagés (droits compris) : jamais un geste sans son droit. */
export function nowPlayingActionsShown(actions: Pick<TrackActions, "canLike" | "canAddToPlaylist">, track: MusicTrack): NowPlayingActionsShown {
  return { like: actions.canLike(track), addToPlaylist: actions.canAddToPlaylist(track), menu: true };
}

export const NowPlayingActions = memo(function NowPlayingActions() {
  const track = usePlayerSelector((s) => s.current);
  const contextId = usePlayerSelector((s) => s.queue.contextId);
  if (track === null) return null;
  return <ActionsRow track={track} contextId={contextId} />;
});

const ActionsRow = memo(function ActionsRow({ track, contextId }: { track: MusicTrack; contextId: string | null }) {
  const { t } = useTranslation("music");
  const colors = useOctaveColors();
  const actions = useMobileTrackActions();
  const liked = useLiked(track.key, track.favorite);
  const shown = nowPlayingActionsShown(actions, track);
  return (
    <View style={styles.row}>
      {shown.like && (
        <Pressable
          onPress={() => {
            haptic("select");
            actions.toggleLike(track);
          }}
          hitSlop={4}
          style={({ pressed }) => [styles.button, pressed && { backgroundColor: colors.pressed }]}
          accessibilityRole="button"
          accessibilityLabel={t(liked ? "track.unlike" : "track.like")}
          accessibilityState={{ selected: liked }}
        >
          <Heart size={24} color={liked ? colors.accent : colors.text} fill={liked ? colors.accent : "transparent"} />
        </Pressable>
      )}
      {shown.addToPlaylist && (
        <Pressable
          onPress={() => openPlaylistChooser(track)}
          hitSlop={4}
          style={({ pressed }) => [styles.button, pressed && { backgroundColor: colors.pressed }]}
          accessibilityRole="button"
          accessibilityLabel={t("playlist.addTo")}
        >
          <ListPlus size={24} color={colors.text} />
        </Pressable>
      )}
      <Pressable
        onPress={() => openTrackSheet({ track, list: [track], contextId })}
        hitSlop={4}
        style={({ pressed }) => [styles.button, pressed && { backgroundColor: colors.pressed }]}
        accessibilityRole="button"
        accessibilityLabel={t("track.more", { title: track.title })}
      >
        <Ellipsis size={24} color={colors.text} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 2 },
  button: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
