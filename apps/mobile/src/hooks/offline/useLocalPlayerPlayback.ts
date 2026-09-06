import { useCallback, useMemo, useRef, useState } from "react";
import { useUserId } from "@tentacle-tv/api-client";
import { ticksToSeconds, type MediaStream as JfStream } from "@tentacle-tv/shared";
import type { PlayerSessionCore } from "@/hooks/usePlayerPlayback";
import { localExists, type OfflineLocalSource } from "@/offline/engineApi";
import { cachedMaxResumePct } from "@/offline/prefsCache";
import { useConnectivity } from "@/offline/useConnectivity";
import { useLocalEpisodeNavigation } from "./useLocalEpisodeNavigation";
import { useLocalPlaybackReporter } from "./useLocalPlaybackReporter";
import { useNextEpisodeArtwork } from "./useNextEpisodeArtwork";
import { useLocalPlayerTracks } from "./useLocalPlayerTracks";
import { useLocalSegments } from "./useLocalSegments";
import { useLocalSnapshotItem } from "./useLocalSnapshot";
import { useLocalTrickplay } from "./useLocalTrickplay";

/**
 * La session d'une lecture LOCALE : le fichier de l'appareil, sans
 * PlaybackInfo ni réseau. Même noyau que le flux serveur
 * (`PlayerSessionCore`) — les gestionnaires, l'arbitre et l'habillage ne
 * voient pas la différence.
 */
export function useLocalPlayerPlayback(itemId: string, localSource: OfflineLocalSource) {
  const userId = useUserId();
  const { state } = useConnectivity();
  const online = state === "online";
  const item = useLocalSnapshotItem(itemId, localSource);
  const positionRef = useRef(localSource.played ? 0 : ticksToSeconds(localSource.positionTicks));
  const [fetchNonce, setFetchNonce] = useState(0);
  const [mediaMissing, setMediaMissing] = useState(false);
  const streams: JfStream[] = useMemo(() => item?.MediaSources?.[0]?.MediaStreams ?? [], [item]);
  const jellyfinDuration = useMemo(
    () => ticksToSeconds(item?.RunTimeTicks ?? localSource.runtimeTicks ?? undefined),
    [item, localSource.runtimeTicks],
  );
  const tracks = useLocalPlayerTracks({ userId, itemId, localSource, streams });
  const maxResumePct = useMemo(() => cachedMaxResumePct(), []);

  const reporting = useLocalPlaybackReporter({
    userId, itemId, localSource, positionRef,
    durationSeconds: jellyfinDuration || 0,
    maxResumePct,
  });
  // Segments et planches depuis le snapshot local — jamais le réseau.
  const segments = useLocalSegments(itemId, item);
  const localTrickplay = useLocalTrickplay(itemId);
  // Précédent / suivant parmi les titres de l'appareil, à travers les saisons.
  const episodeNav = useLocalEpisodeNavigation(itemId);
  const nextArtwork = useNextEpisodeArtwork(episodeNav.nextEpisode?.Id);

  /** Relance : le fichier a-t-il disparu ? Sinon on recharge une fois. */
  const retry = useCallback(() => {
    if (!localExists(localSource.fileUri)) {
      setMediaMissing(true);
      return;
    }
    setFetchNonce((n) => n + 1);
  }, [localSource.fileUri]);

  const startPositionMs = localSource.played ? 0 : Math.round(localSource.positionTicks / 10_000);

  const core: PlayerSessionCore = {
    item, positionRef, isDirectPlay: true, streamOffset: 0, jellyfinDuration,
    episodeNav, segments, reporting, retry, fetchNonce,
    streamUrl: localSource.fileUri, mediaSourceId: item?.MediaSources?.[0]?.Id ?? itemId, headers: {},
    // Hors ligne, le rangement partagé n'a rien à invalider.
    invalidateOnStop: () => online,
  };

  return {
    ...core,
    ...tracks,
    streams, localSource, mediaMissing, startPositionMs, localTrickplay, nextArtwork, online,
  };
}

export type LocalPlayerPlayback = ReturnType<typeof useLocalPlayerPlayback>;
