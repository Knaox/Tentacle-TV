import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  useJellyfinClient, useUserId, useMediaItem, useItemAncestors,
  usePlaybackReporting, usePlaybackSegments, useEpisodeNavigation,
} from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND, ticksToSeconds } from "@tentacle-tv/shared";
import type { MediaStream as JfStream, MediaSource, QualityKey, QualityPreset } from "@tentacle-tv/shared";
import {
  buildStreamUrl, buildTextTracks, detectBurnIn, isBitmapSub,
  buildPlatformDeviceProfile, extractActualStartTicks,
  type TextTrackEntry,
} from "./usePlaybackInfoFetch";
import { usePlayerQuality } from "./usePlayerQuality";
import { recordEncodingSession } from "../lib/transcodeSession";

const DBG = "[Tentacle:Playback]";

export type { QualityKey, QualityPreset, TextTrackEntry };

export interface PlaybackState {
  streamUrl: string | null;
  playSessionId: string | null;
  mediaSource: MediaSource | null;
  isDirectPlay: boolean;
  isDirectStream: boolean;
  streamOffset: number;
  isLoading: boolean;
  error: string | null;
  textTracks: TextTrackEntry[];
  /** Bitmap subtitle burn-in index (-1 = none) */
  burnInSubIndex: number;
  /** Native start position in ms for react-native-video source.startPosition */
  startPositionMs: number;
  /** Auth headers for react-native-video source */
  headers: Record<string, string>;
}

const INITIAL_STATE: PlaybackState = {
  streamUrl: null, playSessionId: null, mediaSource: null,
  isDirectPlay: false, isDirectStream: false, streamOffset: 0,
  isLoading: true, error: null, textTracks: [], burnInSubIndex: -1,
  startPositionMs: 0, headers: {},
};

/** Tout ce que le hook rend à l'écran — repris tel quel par `usePlayerHandlers`. */
export type PlayerPlayback = ReturnType<typeof usePlayerPlayback>;

export function usePlayerPlayback(itemId: string) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const { data: item } = useMediaItem(itemId);
  const { data: ancestors } = useItemAncestors(itemId);
  const fetchIdRef = useRef(0);

  const [state, setState] = useState<PlaybackState>(INITIAL_STATE);
  /** Incrémenté à CHAQUE résolution aboutie — même si l'URL revient identique.
   *  L'écran s'y accroche pour réarmer ses gardes de retry : sur `streamUrl`
   *  seul, une relance qui rend la même URL laissait le lecteur muet. */
  const [fetchNonce, setFetchNonce] = useState(0);
  const [audioIndex, setAudioIndex] = useState(0);
  const [subtitleIndex, setSubtitleIndex] = useState(-1);
  const positionRef = useRef(0);
  // Refs mirror audioIndex/subtitleIndex for synchronous reads in fetchPlaybackInfo.
  // Fixes race condition when changeAudio + changeSubtitle fire in the same tick.
  const audioIndexRef = useRef(0);
  const subtitleIndexRef = useRef(-1);

  const streams: JfStream[] = useMemo(
    () => item?.MediaSources?.[0]?.MediaStreams ?? [],
    [item],
  );
  const mediaSourceId = item?.MediaSources?.[0]?.Id ?? itemId;
  // Échelle, palier et cap automatique de débit : tout vit dans usePlayerQuality.
  const quality = usePlayerQuality({ itemId, mediaSource: item?.MediaSources?.[0] });
  const jellyfinDuration = useMemo(() => ticksToSeconds(item?.RunTimeTicks), [item]);

  const episodeNav = useEpisodeNavigation(item);
  // Les segments RÉSOLUS par le backend — plus de cascade de sources côté
  // client, et le contrat rend « rien » plutôt qu'une erreur (serveur ancien,
  // réseau coupé) : la lecture n'en dépend jamais.
  const segments = usePlaybackSegments(itemId);

  /** Core fetch: POST PlaybackInfo with platform DeviceProfile */
  const fetchPlaybackInfo = useCallback(async (opts?: {
    audioStreamIndex?: number;
    subtitleStreamIndex?: number;
    startTimeTicks?: number;
    maxBitrate?: number;
    maxWidth?: number;
    maxHeight?: number;
    isRetry?: boolean;
  }) => {
    if (!userId) return;
    const currentFetch = ++fetchIdRef.current;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    // Palier servi : celui des opts (changement/retry explicites), sinon la
    // photographie du moment — cap auto compris quand le mode est armé.
    const preset = opts?.maxBitrate !== undefined ? null : quality.presetForFetch();
    const bitrate = opts?.maxBitrate ?? preset?.bitrate ?? 0;
    const maxWidth = opts?.maxWidth ?? preset?.width ?? 0;
    const maxHeight = opts?.maxHeight ?? preset?.height ?? 0;
    const profile = buildPlatformDeviceProfile(bitrate, opts?.isRetry ?? false);

    try {
      const result = await client.getPlaybackInfo(itemId, {
        userId, deviceProfile: profile, mediaSourceId,
        audioStreamIndex: opts?.audioStreamIndex ?? audioIndexRef.current,
        subtitleStreamIndex: opts?.subtitleStreamIndex ?? (subtitleIndexRef.current >= 0 ? subtitleIndexRef.current : undefined),
        startTimeTicks: opts?.startTimeTicks,
        maxStreamingBitrate: bitrate > 0 ? bitrate : undefined,
        maxWidth: maxWidth > 0 ? maxWidth : undefined,
        maxHeight: maxHeight > 0 ? maxHeight : undefined,
      });

      if (fetchIdRef.current !== currentFetch) return;

      const ms = result.MediaSources?.[0];
      if (!ms) { setState((prev) => ({ ...prev, isLoading: false, error: "No media source" })); return; }

      const directPlay = ms.SupportsDirectPlay && !ms.TranscodingUrl;
      const directStream = ms.SupportsDirectStream && !directPlay;
      const subIdx = opts?.subtitleStreamIndex ?? subtitleIndexRef.current;

      const ds = client.getDirectStreaming();
      const url = buildStreamUrl({
        itemId, ms, directPlay, ds: ds ?? null,
        baseUrl: client.getBaseUrl(), accessToken: client.getAccessToken(), subIdx,
      });
      if (!url) { setState((prev) => ({ ...prev, isLoading: false, error: "No stream URL" })); return; }

      const actualOffsetTicks = directPlay ? 0 : extractActualStartTicks(ms);
      const streamOffset = actualOffsetTicks > 0 ? actualOffsetTicks / 10_000_000 : 0;
      const burnIn = detectBurnIn(ms, subIdx);
      // Only sideload VTT for direct play — Jellyfin embeds text subs in HLS manifest.
      const textTracks = directPlay && burnIn < 0
        ? buildTextTracks(ms, client.getSubtitleUrl.bind(client), itemId) : [];

      // Direct play: native startPosition avoids visible jump.
      // Transcode: HLS stream already starts at offset, no native seek needed.
      const startPositionMs = directPlay ? Math.round(positionRef.current * 1000) : 0;
      const token = ds ? ds.jellyfinToken : client.getAccessToken();
      const headers: Record<string, string> = token ? { "X-Emby-Token": token } : {};

      console.log(DBG, "resolved", {
        directPlay, directStream, startPositionMs, subIdx, burnIn,
        container: ms.Container, url: url.slice(0, 200),
      });

      setState({
        streamUrl: url, playSessionId: result.PlaySessionId, mediaSource: ms,
        isDirectPlay: directPlay, isDirectStream: directStream, streamOffset,
        isLoading: false, error: null,
        textTracks, burnInSubIndex: burnIn, startPositionMs, headers,
      });
      setFetchNonce((n) => n + 1);
    } catch (err) {
      if (fetchIdRef.current !== currentFetch) return;
      console.error(DBG, "PlaybackInfo failed", err);
      setState((prev) => ({ ...prev, isLoading: false, error: "Playback error" }));
    }
  }, [client, userId, itemId, mediaSourceId, quality]);

  const reporting = usePlaybackReporting({
    itemId, mediaSourceId,
    isDirectPlay: state.isDirectPlay,
    isDirectStream: state.isDirectStream,
    playSessionId: state.playSessionId ?? undefined,
    audioStreamIndex: audioIndex,
    subtitleStreamIndex: subtitleIndex === -1 ? null : subtitleIndex,
  });

  /**
   * Une session en supplante une autre à CHAQUE `fetchPlaybackInfo` : palier de
   * qualité, piste audio en transcodage, sous-titre bitmap à incruster, reprise
   * après erreur de codec, épisode suivant. Jellyfin ouvre alors un nouvel
   * encodage sans fermer le précédent — l'ancien ffmpeg continue d'écrire ses
   * fichiers jusqu'au bout du film. On le libère à l'instant où son remplaçant
   * apparaît, comme le fait le web (cf. `WatchWeb.tsx`).
   *
   * La comparaison porte sur DEUX identifiants explicites, jamais sur un ref
   * partagé : c'est ce qui garantit qu'on ne tue pas la session qui vient de
   * naître.
   */
  const { killTranscode } = reporting;
  const previousSessionRef = useRef<string | null>(null);
  useEffect(() => {
    const currentSession = state.playSessionId;
    if (!currentSession) return;
    const previousSession = previousSessionRef.current;
    previousSessionRef.current = currentSession;
    // Trace sur disque, relue au lancement suivant : c'est le seul recours
    // contre une application tuée en pleine lecture (cf. transcodeSession).
    recordEncodingSession(currentSession, client.getBaseUrl());
    if (!previousSession || previousSession === currentSession) return;
    console.log(DBG, "session supplantée — ancien transcodage libéré", { previousSession, currentSession });
    void killTranscode(previousSession);
  }, [state.playSessionId, killTranscode, client]);

  /** Direct play : update selectedAudioTrack only. Transcode : refetch with new audio. */
  const changeAudio = useCallback((newIndex: number) => {
    audioIndexRef.current = newIndex;
    setAudioIndex(newIndex);
    if (state.isDirectPlay) return;
    const startTicks = Math.floor(positionRef.current * TICKS_PER_SECOND);
    fetchPlaybackInfo({ audioStreamIndex: newIndex, startTimeTicks: startTicks > 0 ? startTicks : undefined });
  }, [fetchPlaybackInfo, state.isDirectPlay]);

  /** Direct play : toggle locally. Transcode : refetch only for bitmap (burn-in) subs. */
  const changeSubtitle = useCallback((newIndex: number) => {
    subtitleIndexRef.current = newIndex;
    setSubtitleIndex(newIndex);
    const sub = streams.find((s) => s.Index === newIndex && s.Type === "Subtitle");
    const needsBurnIn = sub ? isBitmapSub(sub) : false;
    if (needsBurnIn || (newIndex < 0 && state.burnInSubIndex >= 0)) {
      const startTicks = Math.floor(positionRef.current * TICKS_PER_SECOND);
      fetchPlaybackInfo({
        subtitleStreamIndex: newIndex >= 0 ? newIndex : undefined,
        startTimeTicks: startTicks > 0 ? startTicks : undefined,
      });
    }
  }, [fetchPlaybackInfo, streams, state.burnInSubIndex]);

  const changeQuality = useCallback((key: QualityKey) => {
    // Choix du menu : désarme le cap auto pour cet item, puis applique.
    const preset = quality.selectQualityManual(key);
    const startTicks = Math.floor(positionRef.current * TICKS_PER_SECOND);
    fetchPlaybackInfo({
      maxBitrate: preset.bitrate ?? 0,
      maxWidth: preset.width ?? 0,
      maxHeight: preset.height ?? 0,
      startTimeTicks: startTicks > 0 ? startTicks : undefined,
    });
  }, [fetchPlaybackInfo, quality]);

  const retry = useCallback(() => {
    const startTicks = Math.floor(positionRef.current * TICKS_PER_SECOND);
    // Déjà en transcodage : retirer les DirectPlayProfiles (isRetry) ne change
    // RIEN à la négociation — Jellyfin resservirait le même encodage. Pour que
    // la relance soit réellement différente, on descend d'un palier de
    // qualité : un débit plafonné force une nouvelle session d'encodage.
    // Le palier choisi est affiché (clé effective) — pas de qualité mentie.
    let degraded: QualityPreset | undefined;
    if (!state.isDirectPlay && state.streamUrl) {
      degraded = quality.degradeOneTier();
    }
    fetchPlaybackInfo({
      isRetry: true,
      ...(degraded
        ? { maxBitrate: degraded.bitrate ?? 0, maxWidth: degraded.width ?? 0, maxHeight: degraded.height ?? 0 }
        : {}),
      startTimeTicks: startTicks > 0 ? startTicks : undefined,
    });
  }, [fetchPlaybackInfo, state.isDirectPlay, state.streamUrl, quality]);

  /** VTT URL for custom overlay — every mode, every platform (text subs only).
   *  iOS never sideloads native textTracks (sidecar tracks force-disable
   *  AirPlay) and selectedTextTrack is DISABLED, so the overlay is the ONLY
   *  text renderer; direct play has streamOffset = 0 → cues stay in sync. */
  const subtitleVttUrl = useMemo(() => {
    if (subtitleIndex < 0) return null;
    const sub = streams.find((s) => s.Index === subtitleIndex && s.Type === "Subtitle");
    if (!sub || isBitmapSub(sub)) return null;
    return client.getSubtitleUrl(itemId, mediaSourceId, subtitleIndex, "vtt");
  }, [subtitleIndex, streams, client, itemId, mediaSourceId]);

  /** Index into native audio tracks for selectedAudioTrack prop (0-based, audio streams only). */
  const audioTrackSelectedIndex = useMemo(() => {
    const audioStreams = streams.filter((s) => s.Type === "Audio");
    return audioStreams.findIndex((s) => s.Index === audioIndex);
  }, [audioIndex, streams]);

  return {
    item, ancestors, streams, mediaSourceId, jellyfinDuration,
    ...state,
    fetchNonce,
    audioIndex, subtitleIndex, positionRef,
    // Clé EFFECTIVE au menu (palier servi, cap compris) — comme le web.
    qualityKey: quality.qualityKeyEffective,
    qualityPresets: quality.qualityPresets,
    autoCapActive: quality.autoCapActive,
    autoModeArmed: quality.autoModeArmed,
    audioTrackSelectedIndex, subtitleVttUrl,
    episodeNav, segments, reporting,
    fetchPlaybackInfo, changeAudio, changeSubtitle, changeQuality, retry,
  };
}
