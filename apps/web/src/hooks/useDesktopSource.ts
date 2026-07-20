/**
 * Source de lecture desktop : LOCAL D'ABORD, en ligne comme hors ligne.
 * Si un fichier local complet et vérifié existe pour l'item (côté Rust), il
 * est lu depuis le disque — jamais de stream dans ce cas. Sinon, l'URL de
 * stream classique est construite (chaîne existante inchangée).
 * On attend la résolution locale avant de retomber sur le stream : évite un
 * chargement réseau furtif suivi d'un rechargement local.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUserId, type JellyfinClient } from "@tentacle-tv/api-client";
import { localSourceForItem, type LocalSource } from "../downloads/playbackApi";
import type { SubtitleTrack } from "../components/VideoPlayer";

interface DesktopSourceParams {
  isDesktop: boolean;
  itemId: string | undefined;
  prefsReady: boolean;
  client: JellyfinClient;
  mediaSourceId: string | undefined;
  urlAudioIndex: number | undefined;
  quality: number | null;
  qualityMaxHeight: number | undefined;
  desktopIsDirectPlay: boolean;
  startTicks: number;
  desktopPlaySessionId: string;
  burnInSubtitleIndex: number | undefined;
  useProgressiveRemux: boolean;
}

export function useDesktopSource(params: DesktopSourceParams): {
  desktopStreamUrl: string | null;
  isLocalPlayback: boolean;
  localSource: LocalSource | null;
} {
  const userId = useUserId();
  const {
    isDesktop, itemId, prefsReady, client, mediaSourceId, urlAudioIndex, quality,
    qualityMaxHeight, desktopIsDirectPlay, startTicks, desktopPlaySessionId,
    burnInSubtitleIndex, useProgressiveRemux,
  } = params;

  const localQuery = useQuery({
    queryKey: ["local-source", userId, itemId],
    queryFn: () => localSourceForItem(userId as string, itemId as string),
    enabled: isDesktop && !!userId && !!itemId,
    staleTime: 0,
    gcTime: 5_000,
  });
  const localSource = localQuery.data ?? null;
  const waitingLocal = isDesktop && !!userId && !!itemId && !localQuery.isFetched;

  const remoteUrl = useMemo(() => {
    if (!isDesktop || !itemId || !prefsReady) return null;
    return client.getStreamUrl(itemId, {
      audioIndex: urlAudioIndex, mediaSourceId, maxBitrate: quality ?? undefined,
      maxHeight: qualityMaxHeight, directPlay: desktopIsDirectPlay,
      startTimeTicks: !desktopIsDirectPlay && startTicks > 0 ? startTicks : undefined,
      playSessionId: desktopPlaySessionId, useProgressiveRemux,
      subtitleStreamIndex: burnInSubtitleIndex,
    });
  }, [client, itemId, urlAudioIndex, mediaSourceId, quality, qualityMaxHeight, desktopIsDirectPlay, startTicks, desktopPlaySessionId, prefsReady, burnInSubtitleIndex, isDesktop, useProgressiveRemux]);

  if (!isDesktop) return { desktopStreamUrl: null, isLocalPlayback: false, localSource: null };
  if (waitingLocal) return { desktopStreamUrl: null, isLocalPlayback: false, localSource: null };
  if (localSource) {
    return { desktopStreamUrl: localSource.absolutePath, isLocalPlayback: true, localSource };
  }
  return { desktopStreamUrl: remoteUrl, isLocalPlayback: false, localSource: null };
}

/**
 * Remplace les URLs (proxy) des sous-titres EXTERNES par les side-cars locaux
 * quand la lecture est locale — fichiers nommés `<indexJellyfin>-<langue>.<ext>`.
 * Les pistes internes n'ont pas d'URL : mpv les lit nativement dans le fichier.
 *
 * Sans DTO serveur (démarrage 100 % hors ligne), il n'y a rien à réécrire : la
 * liste des pistes est alors CONSTRUITE par useLocalPlaybackTracks, qui fusionne
 * les pistes internes du fichier et les side-cars. Synthétiser ici masquerait
 * les pistes internes et mélangerait deux espaces d'index.
 */
export function mapSubtitlesToLocal(
  tracks: SubtitleTrack[],
  localSource: LocalSource | null,
): SubtitleTrack[] {
  if (!localSource || localSource.subtitleFiles.length === 0) return tracks;
  return tracks.map((track) => {
    if (!track.url) return track;
    const match = localSource.subtitleFiles.find((file) =>
      file.fileName.startsWith(`${track.index}-`),
    );
    return match ? { ...track, url: match.absolutePath } : track;
  });
}
