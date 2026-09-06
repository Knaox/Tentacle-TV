import { useCallback, useMemo, useRef, useState } from "react";
import { usePlaybackSegments, useUserId } from "@tentacle-tv/api-client";
import { ticksToSeconds, type MediaStream as JfStream } from "@tentacle-tv/shared";
import { formatLocalTrackLabel, parseSideCarFileName, DEFAULT_WATCHED_THRESHOLD } from "@tentacle-tv/offline-core";
import { i18n } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import type { PlayerSessionCore } from "@/hooks/usePlayerPlayback";
import { formatTrackLabel } from "@/lib/playerUtils";
import { localExists, type OfflineLocalSource } from "@/offline/engineApi";
import { useConnectivity } from "@/offline/useConnectivity";
import { useLocalPlaybackReporter } from "./useLocalPlaybackReporter";
import { useLocalSnapshotItem } from "./useLocalSnapshot";

interface Track {
  index: number;
  label: string;
}

/**
 * La session d'une lecture LOCALE : le fichier de l'appareil, sans
 * PlaybackInfo ni réseau. Même noyau que le flux serveur
 * (`PlayerSessionCore`) — les gestionnaires, l'arbitre et l'habillage ne
 * voient pas la différence.
 */
export function useLocalPlayerPlayback(itemId: string, localSource: OfflineLocalSource) {
  const { t } = useTranslation("player");
  const userId = useUserId();
  const { state } = useConnectivity();
  const online = state === "online";
  const item = useLocalSnapshotItem(itemId, localSource);
  const positionRef = useRef(localSource.played ? 0 : ticksToSeconds(localSource.positionTicks));
  const [fetchNonce, setFetchNonce] = useState(0);
  const [mediaMissing, setMediaMissing] = useState(false);
  const [audioIndex, setAudioIndex] = useState(0);
  const [subtitleIndex, setSubtitleIndex] = useState(-1);

  const streams: JfStream[] = useMemo(() => item?.MediaSources?.[0]?.MediaStreams ?? [], [item]);
  const jellyfinDuration = useMemo(
    () => ticksToSeconds(item?.RunTimeTicks ?? localSource.runtimeTicks ?? undefined),
    [item, localSource.runtimeTicks],
  );

  // Pistes audio : celles du snapshot pour l'Original (le fichier est celui du
  // serveur) ; une seule piste dans une version réemballée ou allégée.
  const audioTracks: Track[] = useMemo(
    () => (localSource.variant === "original"
      ? streams.filter((s) => s.Type === "Audio").map((s) => ({ index: s.Index, label: formatTrackLabel(s) }))
      : []),
    [streams, localSource.variant],
  );
  const audioTrackSelectedIndex = useMemo(() => {
    const audio = streams.filter((s) => s.Type === "Audio");
    return localSource.variant === "original" ? audio.findIndex((s) => s.Index === audioIndex) : -1;
  }, [streams, audioIndex, localSource.variant]);

  // Sous-titres : les side-cars VTT gardés à côté du fichier, nommés par index Jellyfin.
  const sideCars = useMemo(
    () => localSource.subtitleUris
      .map((file) => ({ ...file, parsed: parseSideCarFileName(file.fileName) }))
      .filter((file) => file.parsed !== null && file.parsed.format === "vtt"),
    [localSource.subtitleUris],
  );
  const subtitleTracks: Track[] = useMemo(
    () => sideCars.map((file) => {
      const parsed = file.parsed!;
      const stream = streams.find((s) => s.Type === "Subtitle" && s.Index === parsed.jfIndex);
      return {
        index: parsed.jfIndex,
        label: formatLocalTrackLabel(
          { lang: parsed.lang, title: stream?.Title, codec: parsed.format, forced: parsed.forced, sdh: parsed.sdh },
          { locale: i18n.language, fallback: t("trackFallback", { defaultValue: `#${parsed.jfIndex}` }) },
        ),
      };
    }),
    [sideCars, streams, t],
  );
  const subtitleVttUrl = useMemo(
    () => sideCars.find((file) => file.parsed!.jfIndex === subtitleIndex)?.uri ?? null,
    [sideCars, subtitleIndex],
  );

  const reporting = useLocalPlaybackReporter({
    userId, itemId, localSource, positionRef,
    durationSeconds: jellyfinDuration || 0,
    maxResumePct: DEFAULT_WATCHED_THRESHOLD,
  });
  // Les segments locaux arrivent avec le snapshot ; en attendant, rien — jamais le réseau.
  const segments = usePlaybackSegments(itemId, { enabled: false });

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
    episodeNav: {}, segments, reporting, retry, fetchNonce,
    streamUrl: localSource.fileUri, mediaSourceId: item?.MediaSources?.[0]?.Id ?? itemId, headers: {},
    // Hors ligne, le rangement partagé n'a rien à invalider.
    invalidateOnStop: () => online,
  };

  return {
    ...core,
    streams, localSource, mediaMissing, startPositionMs,
    audioIndex, subtitleIndex, audioTracks, subtitleTracks, audioTrackSelectedIndex, subtitleVttUrl,
    changeAudio: setAudioIndex, changeSubtitle: setSubtitleIndex,
  };
}

export type LocalPlayerPlayback = ReturnType<typeof useLocalPlayerPlayback>;
