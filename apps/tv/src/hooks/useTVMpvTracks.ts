import { useCallback, useEffect, useRef, useState } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import type { MPVPlayerHandle, MpvTrack } from "../components/player/MPVPlayer";

/**
 * Encapsule la gestion des pistes MPV/Exo côté direct play :
 *  - Mapping Jellyfin index → MPV track ID via `handleTracks`
 *  - Chargement des sous-titres externes (VTT) que MPV ne trouve pas
 *  - Application réactive des sélections audio/sub courantes
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
  const { playerRef, streams, audioIndex, subtitleIndex, isDirectPlay, itemId, mediaSourceId } = args;
  const client = useJellyfinClient();
  const [mpvTrackMap, setMpvTrackMap] = useState<Record<number, number>>({});
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

    // Sub externes : MPV fait des requêtes HTTP natives sans headers d'auth
    // → utiliser l'URL directe Jellyfin (proxy stripperait api_key).
    if (!externalSubsLoaded.current && isDirectPlay && itemId && mediaSourceId) {
      const missingCount = jellyfinSubs.length - subTracks.length;
      if (missingCount > 0) {
        externalSubsLoaded.current = true;
        const ds = client.getDirectStreaming?.();
        for (let i = subTracks.length; i < jellyfinSubs.length; i++) {
          const sub = jellyfinSubs[i];
          const url = ds?.enabled && ds.mediaBaseUrl && ds.jellyfinToken
            ? `${ds.mediaBaseUrl}/Videos/${itemId}/${mediaSourceId}/Subtitles/${sub.Index}/Stream.vtt?api_key=${encodeURIComponent(ds.jellyfinToken)}`
            : client.getSubtitleUrl(itemId, mediaSourceId, sub.Index);
          playerRef.current?.addSubtitleTrack(url);
        }
      }
    }
  }, [streams, isDirectPlay, itemId, mediaSourceId, client, playerRef]);

  // Charge la piste sous-titre courante (Media3 ne supporte pas l'extraction SSA — VTT externe)
  useEffect(() => {
    if (!isDirectPlay) return;
    if (subtitleIndex < 0) {
      playerRef.current?.loadSubtitle?.(null);
    } else if (itemId && mediaSourceId) {
      const ds = client.getDirectStreaming?.();
      const url = ds?.enabled && ds.mediaBaseUrl && ds.jellyfinToken
        ? `${ds.mediaBaseUrl}/Videos/${itemId}/${mediaSourceId}/Subtitles/${subtitleIndex}/Stream.vtt?api_key=${encodeURIComponent(ds.jellyfinToken)}`
        : client.getSubtitleUrl(itemId, mediaSourceId, subtitleIndex);
      playerRef.current?.loadSubtitle?.(url);
    }
  }, [subtitleIndex, isDirectPlay, itemId, mediaSourceId, client, playerRef]);

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

  return { mpvTrackMap, handleTracks, resetExternalSubsLoaded };
}
