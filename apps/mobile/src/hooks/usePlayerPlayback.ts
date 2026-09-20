import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  useJellyfinClient, useUserId, useMediaItem, useItemAncestors,
  usePlaybackReporting, usePlaybackSegments, useEpisodeNavigation,
  type PlaybackReporter,
} from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND, ticksToSeconds } from "@tentacle-tv/shared";
import type { MediaItem, MediaStream as JfStream, MediaSource, QualityKey, QualityPreset } from "@tentacle-tv/shared";
import type { ExternalSubtitleSource, PlayerEngineKind } from "@/player/engine/types";
import {
  buildExternalSubtitles, buildStreamUrl, buildTextTracks, detectBurnIn, isBitmapSub,
  buildPlatformDeviceProfile, extractActualStartTicks,
  type PlaybackFetchOptions, type TextTrackEntry,
} from "./usePlaybackInfoFetch";
import { usePlaybackControls } from "./usePlaybackControls";
import { usePlayerQuality } from "./usePlayerQuality";
import { recordEncodingSession } from "../lib/transcodeSession";

const DBG = "[Tentacle:Playback]";

export type { QualityKey, QualityPreset, TextTrackEntry };

export interface PlaybackState {
  streamUrl: string | null;
  playSessionId: string | null;
  mediaSource: MediaSource | null;
  /** Le moteur pour lequel ce flux a été négocié : c'est lui qui le rend. */
  engine: PlayerEngineKind;
  isDirectPlay: boolean;
  isDirectStream: boolean;
  streamOffset: number;
  isLoading: boolean;
  error: string | null;
  textTracks: TextTrackEntry[];
  /** Sous-titres que le lecteur avancé ajoute lui-même, au format d'origine. */
  externalSubtitles: ExternalSubtitleSource[];
  /** Bitmap subtitle burn-in index (-1 = none) */
  burnInSubIndex: number;
  /** Native start position in ms for react-native-video source.startPosition */
  startPositionMs: number;
  /** Auth headers for react-native-video source */
  headers: Record<string, string>;
}

const INITIAL_STATE: PlaybackState = {
  streamUrl: null, playSessionId: null, mediaSource: null, engine: "native",
  isDirectPlay: false, isDirectStream: false, streamOffset: 0,
  isLoading: true, error: null, textTracks: [], externalSubtitles: [], burnInSubIndex: -1,
  startPositionMs: 0, headers: {},
};

/** Tout ce que le hook rend à l'écran — repris tel quel par `usePlayerHandlers`. */
export type PlayerPlayback = ReturnType<typeof usePlayerPlayback>;

/**
 * Le NOYAU d'une session de lecture, commun au flux serveur et au fichier
 * local : ce que les gestionnaires, l'arbitre et l'habillage consomment.
 * `PlayerPlayback` le satisfait ; le lecteur local en construit un autre,
 * sans PlaybackInfo ni réseau.
 */
export interface PlayerSessionCore {
  item: MediaItem | undefined;
  positionRef: { current: number };
  isDirectPlay: boolean;
  streamOffset: number;
  jellyfinDuration: number;
  episodeNav: { nextEpisode?: MediaItem | null; previousEpisode?: MediaItem | null };
  segments: ReturnType<typeof usePlaybackSegments>;
  reporting: PlaybackReporter;
  retry: () => void;
  fetchNonce: number;
  streamUrl: string | null;
  mediaSourceId: string;
  headers: Record<string, string>;
  /** À la sortie, jouer le rangement partagé (Ma liste, hubs) ? Hors ligne, non. */
  invalidateOnStop: () => boolean;
  /** Lecture d'un fichier de l'appareil : rien ne doit partir sur le réseau pendant. */
  localSession: boolean;
}

/**
 * La session de lecture d'un flux serveur. `engine` est le moteur décidé par
 * la façade (`usePlayerEngine`) : le profil d'appareil envoyé à Jellyfin est
 * le sien, et les pistes se changent dans le moteur en lecture directe.
 */
export function usePlayerPlayback(itemId: string, engine: PlayerEngineKind) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const { data: item } = useMediaItem(itemId);
  const { data: ancestors } = useItemAncestors(itemId);
  const fetchIdRef = useRef(0);
  const engineRef = useRef(engine);
  engineRef.current = engine;

  const [state, setState] = useState<PlaybackState>(INITIAL_STATE);
  /** Incrémenté à CHAQUE résolution aboutie — même si l'URL revient identique.
   *  L'écran s'y accroche pour réarmer ses gardes de retry : sur `streamUrl`
   *  seul, une relance qui rend la même URL laissait le lecteur muet. */
  const [fetchNonce, setFetchNonce] = useState(0);
  /** Incrémenté par une RELANCE explicite seulement : c'est lui qui force le
   *  lecteur avancé à recharger une URL identique. `fetchNonce`, lui, bouge à
   *  chaque négociation — y compris celles qui rendent la même URL (préférences
   *  de langue arrivées pendant la première), et recharger là serait un
   *  redémarrage visible pour rien. */
  const [retryNonce, setRetryNonce] = useState(0);
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

  /** Core fetch: POST PlaybackInfo with the DeviceProfile of the engine that will play. */
  const fetchPlaybackInfo = useCallback(async (opts?: PlaybackFetchOptions) => {
    if (!userId) return;
    const currentFetch = ++fetchIdRef.current;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    // Palier servi : celui des opts (changement/retry explicites), sinon la
    // photographie du moment — cap auto compris quand le mode est armé.
    const preset = opts?.maxBitrate !== undefined ? null : quality.presetForFetch();
    const bitrate = opts?.maxBitrate ?? preset?.bitrate ?? 0;
    const maxWidth = opts?.maxWidth ?? preset?.width ?? 0;
    const maxHeight = opts?.maxHeight ?? preset?.height ?? 0;
    const targetEngine = opts?.engine ?? engineRef.current;
    const mpv = targetEngine === "mpv";
    const profile = buildPlatformDeviceProfile(targetEngine, bitrate, opts?.isRetry ?? false);

    const sentAudio = opts?.audioStreamIndex ?? audioIndexRef.current;
    const sentSubtitle = opts?.subtitleStreamIndex ?? (subtitleIndexRef.current >= 0 ? subtitleIndexRef.current : undefined);

    try {
      const result = await client.getPlaybackInfo(itemId, {
        userId, deviceProfile: profile, mediaSourceId,
        audioStreamIndex: sentAudio,
        subtitleStreamIndex: sentSubtitle,
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
      // Le lecteur avancé rend les images lui-même : rien à graver.
      const burnIn = mpv ? -1 : detectBurnIn(ms, subIdx);
      // Only sideload VTT for direct play — Jellyfin embeds text subs in HLS manifest.
      const textTracks = !mpv && directPlay && burnIn < 0
        ? buildTextTracks(ms, client.getSubtitleUrl.bind(client), itemId) : [];
      const externalSubtitles = mpv
        ? buildExternalSubtitles(ms, client.getSubtitleUrl.bind(client), itemId, { externalOnly: directPlay }) : [];

      // Direct play: native startPosition avoids visible jump.
      // Transcode: HLS stream already starts at offset, no native seek needed.
      const startPositionMs = directPlay ? Math.round(positionRef.current * 1000) : 0;
      const token = ds ? ds.jellyfinToken : client.getAccessToken();
      const headers: Record<string, string> = token ? { "X-Emby-Token": token } : {};

      console.log(DBG, "resolved", {
        engine: targetEngine, directPlay, directStream, startPositionMs, subIdx, burnIn,
        container: ms.Container, url: url.slice(0, 200),
      });

      setState({
        streamUrl: url, playSessionId: result.PlaySessionId, mediaSource: ms, engine: targetEngine,
        isDirectPlay: directPlay, isDirectStream: directStream, streamOffset,
        isLoading: false, error: null,
        textTracks, externalSubtitles, burnInSubIndex: burnIn, startPositionMs, headers,
      });
      setFetchNonce((n) => n + 1);

      // Les pistes ont changé pendant la négociation (préférences de langue).
      // En lecture directe, le moteur les applique ; en transcodage, seul le
      // serveur peut — une renégociation, et une seule, avec les index frais.
      const wantedSubtitle = subtitleIndexRef.current >= 0 ? subtitleIndexRef.current : undefined;
      if (!directPlay && !opts?.isRetry
          && (audioIndexRef.current !== sentAudio || wantedSubtitle !== sentSubtitle)) {
        void fetchPlaybackInfo({
          audioStreamIndex: audioIndexRef.current, subtitleStreamIndex: wantedSubtitle,
          startTimeTicks: opts?.startTimeTicks, maxBitrate: opts?.maxBitrate,
          maxWidth: opts?.maxWidth, maxHeight: opts?.maxHeight, engine: targetEngine,
        });
      }
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

  const controls = usePlaybackControls({
    state, streams, quality, positionRef, fetchPlaybackInfo,
    audioIndexRef, subtitleIndexRef, setAudioIndex, setSubtitleIndex,
    onRetry: () => setRetryNonce((n) => n + 1),
  });

  /** VTT URL for the native overlay — every mode, every platform (text subs only).
   *  iOS never sideloads native textTracks (sidecar tracks force-disable
   *  AirPlay) and selectedTextTrack is DISABLED, so the overlay is the ONLY
   *  text renderer of the SYSTEM player; direct play has streamOffset = 0 →
   *  cues stay in sync. The advanced player renders its own subtitles: null. */
  const subtitleVttUrl = useMemo(() => {
    if (state.engine === "mpv" || subtitleIndex < 0) return null;
    const sub = streams.find((s) => s.Index === subtitleIndex && s.Type === "Subtitle");
    if (!sub || isBitmapSub(sub)) return null;
    return client.getSubtitleUrl(itemId, mediaSourceId, subtitleIndex, "vtt");
  }, [state.engine, subtitleIndex, streams, client, itemId, mediaSourceId]);

  /** Index into native audio tracks for selectedAudioTrack prop (0-based, audio streams only). */
  const audioTrackSelectedIndex = useMemo(() => {
    const audioStreams = streams.filter((s) => s.Type === "Audio");
    return audioStreams.findIndex((s) => s.Index === audioIndex);
  }, [audioIndex, streams]);

  return {
    item, ancestors, streams, mediaSourceId, jellyfinDuration,
    ...state,
    fetchNonce, retryNonce,
    audioIndex, subtitleIndex, positionRef,
    // Clé EFFECTIVE au menu (palier servi, cap compris) — comme le web.
    qualityKey: quality.qualityKeyEffective,
    qualityPresets: quality.qualityPresets,
    autoCapActive: quality.autoCapActive,
    autoModeArmed: quality.autoModeArmed,
    audioTrackSelectedIndex, subtitleVttUrl,
    episodeNav, segments, reporting,
    fetchPlaybackInfo, ...controls,
    // Flux serveur : le rangement de sortie partagé s'applique toujours.
    invalidateOnStop: () => true,
    localSession: false,
  };
}

/** Ticks Jellyfin d'une position en secondes, ou `undefined` au départ. */
export function startTicksOf(seconds: number): number | undefined {
  const ticks = Math.floor(seconds * TICKS_PER_SECOND);
  return ticks > 0 ? ticks : undefined;
}
