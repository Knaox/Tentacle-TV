import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { ViewStyle } from "react-native";
import Video, {
  type OnLoadData,
  type OnProgressData,
  type VideoRef,
  SelectedTrackType,
  TextTrackType,
} from "react-native-video";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { JELLYFIN_AUTH_HEADER, JELLYFIN_TOKEN_HEADER } from "@tentacle-tv/shared";
import type { MPVPlayerHandle, MpvTrack, ExoTextTrack } from "./playerTypes";

/**
 * Surface native tvOS (AVPlayer via react-native-video) implémentant le MÊME
 * contrat `MPVPlayerHandle` + events que les vues natives Android (ExoPlayer /
 * MPV). Toute l'UI/OSD/contrôles partagée (`PlayerScreen`, `useTVMpvTracks`,
 * `useTVPlayerEventHandlers`) fonctionne sans modification.
 *
 * Différences plateforme assumées (inévitables) :
 *  - Reprise : Android lit le fragment `#tnt-start=` dans l'URL ; AVPlayer non.
 *    On le parse, on retire le fragment de l'URI, et on alimente
 *    `source.startPosition` (positionne AVANT la 1ʳᵉ frame) + un seek de filet.
 *  - Sous-titres : rendus NATIVEMENT par AVPlayer (sideload VTT via
 *    `source.textTracks` + `selectedTextTrack`). Le risque AirPlay/external
 *    playback (raison de l'overlay JS sur mobile) ne concerne PAS l'Apple TV qui
 *    EST la TV. AVPlayer ne lit que le WebVTT sideloadé → les pistes sont servies
 *    en `.vtt` (useTVTextTracks force vtt sur iOS). Burn-in PGS → transcode.
 */

const START_RE = /#tnt-start=(\d+)/;

function parseStart(source: string): { uri: string; startSec: number } {
  const m = source.match(START_RE);
  if (!m) return { uri: source, startSec: 0 };
  return { uri: source.replace(START_RE, ""), startSec: Number(m[1]) };
}

export interface AVPlayerSurfaceProps {
  source: string;
  paused: boolean;
  progressInterval?: number;
  style?: ViewStyle;
  /** Pistes texte VTT (Jellyfin) à charger nativement (sideload AVPlayer). */
  textTracks?: ExoTextTrack[];
  /** Index Jellyfin du sous-titre sélectionné (-1 = aucun). */
  subtitleIndex?: number;
  onLoad?: (duration: number) => void;
  onProgress?: (currentTime: number, bufferedTime: number) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onTracks?: (tracks: MpvTrack[]) => void;
  onVideoSize?: (width: number, height: number, pixelRatio: number) => void;
}

export const AVPlayerSurface = forwardRef<MPVPlayerHandle, AVPlayerSurfaceProps>(
  function AVPlayerSurface(
    { source, paused, progressInterval = 1000, style, textTracks, subtitleIndex, onLoad, onProgress, onEnd, onError, onTracks, onVideoSize },
    ref,
  ) {
    const videoRef = useRef<VideoRef>(null);
    const client = useJellyfinClient();
    const { uri, startSec } = parseStart(source);
    // Piloté par setAudioTrack() (changement de piste audio en direct play).
    const [selectedAudioTrack, setSelectedAudioTrack] =
      useState<{ type: SelectedTrackType; value?: number } | undefined>(undefined);

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
    // Sélection native : index dans la liste sideloadée (≠ index Jellyfin).
    const selectedTextTrack = useMemo<{ type: SelectedTrackType; value?: number }>(() => {
      if (subtitleIndex == null || subtitleIndex < 0 || !textTracks?.length) {
        return { type: SelectedTrackType.DISABLED };
      }
      const pos = textTracks.findIndex((t) => t.jellyfinIndex === subtitleIndex);
      return pos >= 0 ? { type: SelectedTrackType.INDEX, value: pos } : { type: SelectedTrackType.DISABLED };
    }, [textTracks, subtitleIndex]);

    // Headers d'auth Jellyfin — INDISPENSABLES sur tvOS : l'URL passe par le proxy
    // `/api/jellyfin` qui authentifie via X-Emby-Authorization / X-Emby-Token (le
    // player natif Android les injecte ; AVPlayer ne reçoit rien → 401/-1013 sans).
    // En direct streaming, on utilise le vrai token Jellyfin (sinon le token apparié).
    const headers = useMemo(() => {
      const ds = client.getDirectStreaming?.();
      const token = ds?.jellyfinToken ?? client.getAccessToken();
      if (!token) return undefined;
      return {
        [JELLYFIN_AUTH_HEADER]: client.getAuthHeader(token),
        [JELLYFIN_TOKEN_HEADER]: token,
      } as Record<string, string>;
    }, [client]);

    useImperativeHandle(ref, () => ({
      seek: (seconds: number) => videoRef.current?.seek(seconds),
      setAudioTrack: (id: number) => setSelectedAudioTrack({ type: SelectedTrackType.INDEX, value: id }),
      // Sous-titres = overlay JS sur tvOS → commandes natives no-op (parité ExoPlayer.tsx Android).
      setSubtitleTrack: () => {},
      addSubtitleTrack: () => {},
      loadSubtitle: () => {},
    }), []);

    const handleLoad = useCallback(
      (data: OnLoadData) => {
        onLoad?.(data.duration ?? 0);

        const ns = data.naturalSize;
        if (ns && ns.width > 0 && ns.height > 0) onVideoSize?.(ns.width, ns.height, 1);

        // Mapping AVPlayer → MpvTrack[] : `id` = index AVPlayer (utilisable avec
        // SelectedTrackType.INDEX). useTVMpvTracks mappe ensuite par position
        // jellyfinAudio[i] ↔ audioTracks[i], exactement comme sur Android.
        const tracks: MpvTrack[] = (data.audioTracks ?? []).map((a, i) => ({
          id: a.index ?? i,
          type: "audio" as const,
          lang: a.language ?? "",
          title: a.title || a.language || `Audio ${i + 1}`,
          codec: "",
          default: !!a.selected,
          selected: !!a.selected,
        }));
        onTracks?.(tracks);

        // Filet de reprise : `startPosition` est ignoré sur certains flux HLS.
        if (startSec > 1) videoRef.current?.seek(startSec);
      },
      [onLoad, onVideoSize, onTracks, startSec],
    );

    const handleProgress = useCallback(
      (data: OnProgressData) => {
        onProgress?.(
          Math.max(0, data.currentTime),
          data.playableDuration > 0 ? data.playableDuration : 0,
        );
      },
      [onProgress],
    );

    // Traduit l'erreur AVPlayer en un marqueur reconnu par
    // `PlayerScreen.handleError` ("codec"/"Could not open") → bascule transcode.
    // -11828 = format/conteneur non lisible, -11800 = opération échouée.
    const handleError = useCallback(
      (e: { error?: { code?: number; localizedDescription?: string; localizedFailureReason?: string } }) => {
        const err = e?.error;
        const detail = err?.localizedDescription || err?.localizedFailureReason || JSON.stringify(err ?? e);
        const codecLike =
          err?.code === -11828 || err?.code === -11800 || /format|codec|cannot open|decode/i.test(detail);
        onError?.(codecLike ? `Could not open: ${detail}` : detail);
      },
      [onError],
    );

    return (
      <Video
        ref={videoRef}
        source={{
          uri,
          startPosition: startSec > 0 ? startSec * 1000 : undefined,
          headers,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          textTracks: rnvTextTracks.length ? (rnvTextTracks as any) : undefined,
        }}
        style={style}
        resizeMode="contain"
        paused={paused}
        // @ts-ignore — focusable existe sur react-native-tvos ; la surface ne doit
        // jamais voler le focus de l'OSD.
        focusable={false}
        selectedAudioTrack={selectedAudioTrack}
        selectedTextTrack={selectedTextTrack}
        progressUpdateInterval={progressInterval}
        onLoad={handleLoad}
        onProgress={handleProgress}
        onEnd={onEnd}
        onError={handleError}
      />
    );
  },
);
