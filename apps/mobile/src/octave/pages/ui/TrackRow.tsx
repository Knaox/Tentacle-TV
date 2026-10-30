/**
 * Octave mobile — une rangée de titre : pochette (ou numéro sur la page d'un
 * album), titre, artistes, le titre EN COURS marqué (couleur et barres
 * animées), le cœur affiché tout de suite (`useLiked`), un « ⋯ » à 44 pt.
 * Toucher : lire depuis ce titre (la liste garde la suite) ; appui maintenu ou
 * « ⋯ » : la feuille d'actions ; balayée vers la droite : « Lire
 * ensuite » au balayage court, la file au balayage long (`SwipeableTrackRow`),
 * sur toute page qui la montre. En mode « Modifier » (`editing`), elle est inerte. Son état (gardé, bibliothèque, cloud) : la marque unique (`TrackStateMark`,
 * m5) ; hors ligne et pas gardé : atténué et inerte (`useTrackPlayable`). Hauteur FIXE (`TRACK_ROW_HEIGHT`) : les listes
 * virtualisées connaissent la place de chaque rangée.
 */

import { memo, useCallback, useMemo } from "react";
import type { AccessibilityActionEvent } from "react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Heart, MoreHorizontal } from "lucide-react-native";
import { useLiked } from "@tentacle-tv/api-client";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { announceUnavailableTrack, isTrackUnavailable } from "@tentacle-tv/shared/octave";
import { typography, useTheme } from "@/theme";
import { haptic as playHaptic } from "@/utils/haptics";
import { TrackStateMark } from "../../offline/TrackStateMark";
import { useTrackPlayable } from "../../offline/useOfflineMusic";
import { useKeptCover } from "../../offline/useKeptMusic";
import { openTrackSheet } from "../actions/trackSheetStore";
import { useTrackQueueGestures } from "../actions/useTrackQueueGestures";
import { Artwork } from "./Artwork";
import { NowPlayingBars } from "./NowPlayingBars";
import { accentTextOf } from "./pageStyle";
import { SwipeableTrackRow } from "./SwipeableTrackRow";

export const TRACK_ROW_HEIGHT = 60;

interface TrackRowProps {
  track: MusicTrack;
  index: number;
  list: readonly MusicTrack[];
  contextId: string | null;
  playing: boolean;
  onPlay: (index: number) => void;
  /** Le numéro de piste à la place de la pochette (page d'album). */
  numbered?: boolean;
  gutter: number;
  hide?: { album?: boolean; artist?: boolean };
  /** Mode « Modifier » d'une liste : la rangée ne lit rien, ni appui long, ni « ⋯ », ni balayage ; seuls la
   *  poignée et « – » de la rangée qui l'entoure agissent (comme Apple Music). */
  editing?: boolean;
  /** Retirer le titre de la liste (balayage vers la gauche, action du lecteur d'écran) : là seulement où on le peut. */
  onRemove?: (index: number) => void;
}

export const TrackRow = memo(function TrackRow({ track, index, list, contextId, playing, onPlay, numbered, gutter, hide, editing = false, onRemove }: TrackRowProps) {
  const theme = useTheme();
  const { t } = useTranslation("music");
  const { t: tl } = useTranslation("musicLists");
  const liked = useLiked(track.key, track.favorite);
  // Un titre qui ne se lit pas (`unavailableTrack.ts` : importé sans source, sortie sans écoute publique) : grisé ;
  // le toucher ne lance rien et l'avis dit pourquoi (la lecture en cours continue).
  const locked = isTrackUnavailable(track);
  const playable = useTrackPlayable()(track.key) && !locked;
  const keptCover = useKeptCover(track.key);
  const removeAt = useMemo(() => (editing || !onRemove ? undefined : () => onRemove(index)), [editing, index, onRemove]);
  const sheet = useCallback(() => {
    playHaptic("longPress");
    openTrackSheet({ track, list, contextId, hide, remove: removeAt });
  }, [contextId, hide, list, removeAt, track]);
  const artists = track.artists.map((a) => a.name).join(", ");
  const accent = accentTextOf(theme);
  const queue = useTrackQueueGestures(track, playable);
  const gestures = editing ? null : queue;
  const remove = removeAt;
  // Le balayage a toujours son équivalent au lecteur d'écran : deux actions de la rangée.
  const onA11yAction = useCallback(
    (e: AccessibilityActionEvent) => {
      if (e.nativeEvent.actionName === "playNext") gestures?.playNext();
      if (e.nativeEvent.actionName === "addToQueue") gestures?.enqueue();
      if (e.nativeEvent.actionName === "remove") remove?.();
    },
    [gestures, remove],
  );
  const a11yActions = [
    ...(gestures ? [{ name: "playNext", label: t("track.playNext") }, { name: "addToQueue", label: t("track.addToQueue") }] : []),
    ...(remove ? [{ name: "remove", label: tl("swipe.remove") }] : []),
  ];
  const row = (
    <Pressable
      onPress={editing ? undefined : locked ? announceUnavailableTrack : () => onPlay(index)}
      disabled={(!playable && !locked) || editing}
      onLongPress={editing ? undefined : sheet}
      delayLongPress={350}
      style={({ pressed }) => [styles.row, { paddingHorizontal: gutter, opacity: playable || editing ? 1 : 0.4, backgroundColor: pressed ? theme.colors.fill.subtle : "transparent" }]}
      accessibilityRole={editing ? "text" : "button"}
      accessibilityLabel={editing ? track.title : t("track.play", { title: track.title })}
      accessibilityHint={artists}
      accessibilityState={{ selected: playing, disabled: !playable && !editing }}
      accessibilityActions={a11yActions.length > 0 ? a11yActions : undefined}
      onAccessibilityAction={a11yActions.length > 0 ? onA11yAction : undefined}
    >
      {numbered ? (
        <View style={styles.number}>
          {playing ? <NowPlayingBars color={accent} /> : <Text style={[typography.caption, { color: theme.colors.text.tertiary }]}>{track.trackNumber ?? index + 1}</Text>}
        </View>
      ) : (
        <View>
          <Artwork url={track.artworkUrl} localUrl={keptCover} size={44} radius={6} />
          {playing ? (
            <View style={[StyleSheet.absoluteFill, styles.overlay]}>
              <NowPlayingBars color="#fff" />
            </View>
          ) : null}
        </View>
      )}
      <View style={styles.text}>
        <Text numberOfLines={1} style={[typography.bodyBold, { color: playing ? accent : theme.colors.text.primary }]}>
          {track.title}
        </Text>
        <View style={styles.sub}>
          <TrackStateMark track={track} size={11} unavailable={locked} />
          {liked ? <Heart size={11} color={accent} fill={accent} accessibilityLabel={t("track.unlike")} /> : null}
          <Text numberOfLines={1} style={[typography.caption, styles.flex, { color: theme.colors.text.tertiary }]}>
            {locked ? `${artists} · ${track.unavailable === "notPublic" ? t("notPublic", { ns: "musicReleases" }) : t("unavailableAlbum.badge")}` : artists}
          </Text>
        </View>
      </View>
      {editing ? null : (
        <Pressable onPress={sheet} hitSlop={8} style={styles.more} accessibilityRole="button" accessibilityLabel={t("track.more", { title: track.title })}>
          <MoreHorizontal size={20} color={theme.colors.text.secondary} />
        </Pressable>
      )}
    </Pressable>
  );
  return (
    <SwipeableTrackRow rowId={`${contextId ?? ""}|${index}|${track.key}`} title={track.title} gestures={gestures} onRemove={remove}>
      {row}
    </SwipeableTrackRow>
  );
});

const styles = StyleSheet.create({
  row: { height: TRACK_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: 12 },
  number: { width: 28, alignItems: "center" },
  overlay: { backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 6, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0, gap: 2 },
  sub: { flexDirection: "row", alignItems: "center", gap: 4 },
  flex: { flex: 1 },
  more: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 },
});
