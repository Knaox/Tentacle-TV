import { useCallback, useMemo, useState } from "react";
import { SelectedTrackType, TextTrackType } from "react-native-video";
import type { ExoTextTrack } from "./playerTypes";

/**
 * Les pistes texte NATIVES de la surface AVPlayer (sortie de `AVPlayerSurface`,
 * pour son budget de lignes) : le sideload des VTT de Jellyfin (lecture
 * directe progressive) et la sélection native, valable pour les deux modes —
 * sideload ET pistes du manifeste HLS (transcodage, `SubtitleMethod=Hls`).
 */
export function useAvTextTracks(args: {
  textTracks?: ExoTextTrack[];
  /** Index Jellyfin du sous-titre sélectionné (-1 = aucun). */
  subtitleIndex?: number;
  /** PrismCore : index AVPlayer de la rendition OCR d'une piste image — prime sur tout. */
  prismTextTrackIndex: number | null;
}) {
  const { textTracks, subtitleIndex, prismTextTrackIndex } = args;
  // Pistes texte réellement exposées par AVPlayer : sideload (direct play) ou
  // renditions du manifeste HLS (transcode, SubtitleMethod=Hls). Sert à mapper
  // l'index Jellyfin → l'index AVPlayer quand l'ordre diffère.
  const [avTextTracks, setAvTextTracks] =
    useState<Array<{ index: number; title?: string; language?: string }>>([]);

  // Pistes texte VTT sideloadées (rendu natif AVPlayer).
  const rnvTextTracks = useMemo(
    () => (textTracks ?? []).map((t) => ({
      title: t.label,
      language: t.language || "und",
      type: TextTrackType.VTT,
      uri: t.uri,
    })),
    [textTracks],
  );

  // La position dans notre liste suit le même ordre que les pistes du flux. En
  // HLS, si AVPlayer remonte un ordre différent (onTextTracks), on remappe par
  // langue + titre (NAME = DisplayTitle Jellyfin) pour fiabiliser.
  const selectedTextTrack = useMemo<{ type: SelectedTrackType; value?: number }>(() => {
    // PrismCore : rendition OCR d'une piste image, sélectionnée par index dans
    // le groupe legible (cf. utils/prismSubtitleMatch). Le texte reste l'overlay JS.
    if (prismTextTrackIndex != null) return { type: SelectedTrackType.INDEX, value: prismTextTrackIndex };
    if (subtitleIndex == null || subtitleIndex < 0 || !textTracks?.length) {
      return { type: SelectedTrackType.DISABLED };
    }
    const pos = textTracks.findIndex((t) => t.jellyfinIndex === subtitleIndex);
    if (pos < 0) return { type: SelectedTrackType.DISABLED };
    if (avTextTracks.length) {
      const want = textTracks[pos];
      const wantLang = (want.language ?? "").toLowerCase();
      const match =
        avTextTracks.find((a) => (a.language ?? "").toLowerCase() === wantLang && (a.title ?? "") === want.label) ??
        avTextTracks.find((a) => (a.language ?? "").toLowerCase() === wantLang);
      if (match) return { type: SelectedTrackType.INDEX, value: match.index };
    }
    return { type: SelectedTrackType.INDEX, value: pos };
  }, [textTracks, subtitleIndex, avTextTracks, prismTextTrackIndex]);

  const handleTextTracks = useCallback(
    (e: { textTracks?: Array<{ index: number; title?: string; language?: string }> }) => {
      setAvTextTracks(e?.textTracks ?? []);
    },
    [],
  );

  return { rnvTextTracks, selectedTextTrack, handleTextTracks };
}
