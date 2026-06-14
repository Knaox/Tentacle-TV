import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import type { MPVPlayerHandle, MpvTrack } from "../components/player/MPVPlayer";

/**
 * Encapsule la gestion des pistes MPV/Exo côté direct play :
 *  - Mapping Jellyfin index → MPV track ID via `handleTracks`
 *  - Application réactive de la sélection audio courante
 *
 * NOTE sous-titres : les pistes TEXTE sont rendues côté JS (useTVSubtitles +
 * TVSubtitleOverlay) — plus aucun loadSubtitle/addSubtitleTrack natif
 * (Media3 exigeait un nouveau MediaItem → re-prepare visible de la vidéo).
 *
 * Inerte pendant un transcode (le serveur gère la sélection via l'URL HLS).
 */
export function useTVMpvTracks(args: {
  playerRef: React.RefObject<MPVPlayerHandle | null>;
  streams: JfStream[];
  audioIndex: number;
  subtitleIndex: number;
  isDirectPlay: boolean;
  itemId?: string;
  mediaSourceId?: string;
}) {
  const { playerRef, streams, audioIndex, isDirectPlay } = args;
  const [mpvTrackMap, setMpvTrackMap] = useState<Record<number, number>>({});
  // jellyfinIndex (sous-titre) → id de piste native ExoPlayer
  const [subtitleTrackMap, setSubtitleTrackMap] = useState<Record<number, number>>({});
  const externalSubsLoaded = useRef(false);

  const handleTracks = useCallback((tracks: MpvTrack[]) => {
    const audioTracks = tracks.filter((t) => t.type === "audio");
    const subTracks = tracks.filter((t) => t.type === "sub");
    const jellyfinAudio = streams.filter((s) => s.Type === "Audio");
    const jellyfinSubs = streams.filter((s) => s.Type === "Subtitle");
    const map: Record<number, number> = {};
    jellyfinAudio.forEach((s, i) => { if (i < audioTracks.length) map[s.Index] = audioTracks[i].id; });
    jellyfinSubs.forEach((s, i) => { if (i < subTracks.length) map[s.Index] = subTracks[i].id; });
    setMpvTrackMap(map);
    // Sous-titres : nos pistes side-loadées (VTT/ASS externes) arrivent APRÈS
    // les pistes internes du conteneur, dans l'ordre de déclaration (= ordre
    // jellyfinSubs). Media3 ne propage PAS SubtitleConfiguration.setId dans
    // Format.id ("groupe:piste"), donc on mappe par position EN QUEUE :
    // les N dernières pistes texte ↔ les N pistes Jellyfin (texte) dans l'ordre.
    const sub: Record<number, number> = {};
    const sideLoaded = subTracks.slice(Math.max(0, subTracks.length - jellyfinSubs.length));
    jellyfinSubs.forEach((s, i) => { if (i < sideLoaded.length) sub[s.Index] = sideLoaded[i].id; });
    setSubtitleTrackMap(sub);
  }, [streams]);

  // Applique la piste audio via MPV en direct play (changement de track natif sans rebuilder l'URL)
  useEffect(() => {
    if (!isDirectPlay) return;
    const mpvId = mpvTrackMap[audioIndex];
    if (mpvId != null) playerRef.current?.setAudioTrack(mpvId);
  }, [audioIndex, isDirectPlay, mpvTrackMap, playerRef]);

  /** Reset l'état externe sub loaded — à appeler quand l'item ou la session change. */
  const resetExternalSubsLoaded = useCallback(() => {
    externalSubsLoaded.current = false;
  }, []);

  return { mpvTrackMap, subtitleTrackMap, handleTracks, resetExternalSubsLoaded };
}
