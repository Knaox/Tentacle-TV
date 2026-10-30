/**
 * Octave (mobile) — garder un album, une playlist ou les titres likés ENTIERS
 * sur ce téléphone, depuis leur en-tête. Un rond de 44 pt, une seule forme qui
 * change d'état (le pendant du bureau) :
 *   - le glyphe « garder » : toucher garde tout (vibration « commit ») ;
 *   - un anneau qui se remplit, « 3 sur 12 » pour les lecteurs d'écran ; le toucher
 *     ouvre « Sur cet appareil », où se suivent les transferts ;
 *   - gardé (glyphe plein, vert) ou en défaut (triangle) : toucher ouvre la
 *     feuille — titres qui manquent, réessayer, retirer (jamais au premier toucher).
 * Rien sans le droit, rien pour une session de profil, rien sans `offline.music`.
 *
 * Placement (m3 album, m4 playlist) : `<KeepCollectionButton kind="album" collectionKey={album.key}
 * title={album.title} subtitle={artistes} tracks={titres} />` — `collectionKey` comme le bureau
 * (`jf:<id>` d'une playlist de la bibliothèque, l'identifiant d'une playlist d'extension, la clé d'album).
 */

import { memo, useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { canKeepTrack, collectionSummary, ownCopies } from "@tentacle-tv/offline-core/music";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { KeptGlyph } from "@/components/cards/cardGlyphs";
import { useTheme } from "@/theme";
import { PressableScale } from "../layout/PressableScale";
import { useOctaveColors } from "../theme/octaveColors";
import { KeptActionsSheet, type SheetAction } from "./KeptActionsSheet";
import { useOfflineSurface } from "./musicOfflineContext";
import { ProgressRing } from "./ProgressRing";
import { useKeepGestures } from "./useKeepGestures";
import { useKeptMusic } from "./useKeptMusic";
import { useOctaveNav } from "../pages/env/nav";

export interface KeepCollectionButtonProps {
  kind: "album" | "playlist";
  collectionKey: string;
  title: string;
  subtitle?: string | null;
  tracks: readonly MusicTrack[];
  /** Les titres likés : leurs libellés à eux (la collection reste une `playlist`). */
  liked?: boolean;
}

const SIZE = 44;

export const KeepCollectionButton = memo(function KeepCollectionButton(props: KeepCollectionButtonProps) {
  const surface = useOfflineSurface();
  if (!surface.visible || props.tracks.length === 0) return null;
  return <KeepCollectionButtonFor {...props} />;
});

function KeepCollectionButtonFor({ kind, collectionKey, title, subtitle = null, tracks, liked = false }: KeepCollectionButtonProps) {
  const { t } = useTranslation("musicOffline");
  const colors = useOctaveColors();
  const { colors: theme } = useTheme();
  const surface = useOfflineSurface();
  const kept = useKeptMusic();
  const gestures = useKeepGestures();
  const nav = useOctaveNav();
  const [open, setOpen] = useState(false);
  const keys = useMemo(() => tracks.map((track) => track.key), [tracks]);
  const wholeKey = `${kind}:${collectionKey}`;
  const summary = collectionSummary(keys, kept.byKey, kept.collections.some((c) => c.key === wholeKey));
  const keepable = tracks.some((track) => canKeepTrack(track, surface));
  // Un titre retiré, ou arrivé dans la playlist depuis : la collection n'est plus entière sur l'appareil.
  const missing = tracks.filter((track) => canKeepTrack(track, surface) && !kept.byKey.has(track.key));
  const collection = { key: wholeKey, kind, title, subtitle, trackKeys: keys };
  const keepLabel = t(liked ? "keepLiked" : kind === "album" ? "keepAlbum" : "keepPlaylist");
  const removeLabel = t(liked ? "removeLiked" : kind === "album" ? "removeAlbum" : "removePlaylist");

  if (summary.phase === "none") {
    if (!keepable) return null;
    return (
      <PressableScale pressedScale={0.94} accessibilityRole="button" accessibilityLabel={keepLabel} hitSlop={6} onPress={() => void gestures.keep(tracks, collection)} style={[styles.round, { backgroundColor: colors.pressed, borderColor: colors.line }]}>
        <Feather name="arrow-down-circle" size={22} color={colors.text} />
      </PressableScale>
    );
  }
  if (summary.phase === "progress") {
    const label = t("progress", { done: summary.done, total: summary.total });
    // Toucher l'anneau ouvre « Sur cet appareil », où se suivent les transferts (lot fl).
    return (
      <PressableScale
        pressedScale={0.94}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t("progressOpen")}
        accessibilityValue={{ min: 0, max: summary.total, now: summary.done }}
        hitSlop={6}
        onPress={nav.device}
        style={[styles.round, { borderColor: colors.line }]}
      >
        <ProgressRing fraction={summary.fraction} size={28} stroke={3} color={colors.accent} track={colors.line} />
      </PressableScale>
    );
  }
  const failed = summary.phase === "failed";
  const actions: SheetAction[] = [];
  if (missing.length > 0) actions.push({ key: "missing", icon: "arrow-down-circle", label: t("keepMissing", { count: missing.length }), onPress: () => void gestures.keep(missing, collection) });
  if (failed && keepable) actions.push({ key: "retry", icon: "rotate-ccw", label: t("retry"), onPress: () => void gestures.keep(tracks, collection) });
  // Retirer la collection n'emporte pas ce qu'un autre album, une autre playlist ou un geste retient encore.
  actions.push({ key: "remove", icon: "trash-2", destructive: true, label: removeLabel, onPress: () => void gestures.remove(ownCopies(keys, kept.byKey, kept.collections, wholeKey), wholeKey) });
  const tone = failed ? theme.statusPairs.error : theme.statusPairs.success;
  return (
    <>
      <PressableScale
        pressedScale={0.94}
        accessibilityRole="button"
        accessibilityLabel={failed ? t("failed") : t("kept")}
        accessibilityState={{ expanded: open }}
        hitSlop={6}
        onPress={() => setOpen(true)}
        style={[styles.round, { backgroundColor: tone.bg, borderColor: tone.fg }]}
      >
        {failed ? <Feather name="alert-triangle" size={20} color={tone.fg} /> : <KeptGlyph size={22} color={tone.fg} />}
      </PressableScale>
      <KeptActionsSheet visible={open} onClose={() => setOpen(false)} title={liked ? t("liked") : title} caption={t("keptCount", { count: summary.done })} actions={actions} />
    </>
  );
}

const styles = StyleSheet.create({
  round: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },
});
