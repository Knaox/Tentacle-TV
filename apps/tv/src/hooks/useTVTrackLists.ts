import { useMemo } from "react";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import type { PrismAudioTrack } from "../utils/prismCoreStart";
import { formatTrackLabel } from "../utils/playerHelpers";

export interface TrackOption {
  index: number;
  label: string;
}

/**
 * Les pistes audio et sous-titres proposées par les réglages du lecteur.
 *
 * Sorti de `PlayerScreen` tel quel, pour son budget de lignes.
 *
 * Sur PrismCore, une piste ni copiable ni pontée n'a pas de rendition : la
 * proposer, c'est proposer une bascule qui n'aura jamais lieu.
 */
export function useTVTrackLists(streams: JfStream[], prismAudio: PrismAudioTrack[] | undefined) {
  const unavailableAudio = useMemo(() => new Set(
    (prismAudio ?? []).filter((t) => t.delivery === "unavailable").map((t) => t.streamIndex),
  ), [prismAudio]);
  const audioTracksList = useMemo<TrackOption[]>(() =>
    streams.filter((st) => st.Type === "Audio" && !unavailableAudio.has(st.Index))
      .map((st) => ({ index: st.Index, label: formatTrackLabel(st) })), [streams, unavailableAudio]);
  const subtitleTracksList = useMemo<TrackOption[]>(() =>
    streams.filter((st) => st.Type === "Subtitle")
      .map((st) => ({ index: st.Index, label: formatTrackLabel(st) })), [streams]);
  return { audioTracksList, subtitleTracksList };
}
