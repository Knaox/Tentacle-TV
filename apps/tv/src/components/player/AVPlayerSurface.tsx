import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { ViewStyle } from "react-native";
import { NativeModules } from "react-native";

/** Module natif tvOS : pilote AVDisplayManager pour la bascule HDR/DV HDMI. */
const TVDisplayCriteria = (NativeModules as {
  TVDisplayCriteria?: { engage?: () => void; reset?: () => void };
}).TVDisplayCriteria;
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
 *  - Sous-titres : rendus NATIVEMENT par AVPlayer, mais la SOURCE des pistes
 *    dépend du mode (AVPlayer ne sait PAS sideloader sur du HLS — limitation
 *    Apple → chargement infini si on essaie) :
 *      • direct play (fichier progressif) → sideload VTT via `source.textTracks` ;
 *      • transcode/remux HLS → pistes du manifeste Jellyfin
 *        (EnableSubtitlesInManifest) ; bascule native instantanée, aucun refetch.
 *    Sélection commune via `selectedTextTrack` (index). Les pistes sont servies
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
  /** Direct play (fichier progressif) vs transcode/remux HLS (master.m3u8).
   *  En HLS, AVPlayer NE SAIT PAS sideloader `source.textTracks` (limitation
   *  Apple) → chargement infini. On ne sideload donc qu'en direct play ; en HLS
   *  les sous-titres viennent du manifeste (EnableSubtitlesInManifest côté
   *  Jellyfin) et sont sélectionnés nativement. */
  isDirectPlay?: boolean;
  onLoad?: (duration: number) => void;
  onProgress?: (currentTime: number, bufferedTime: number) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onTracks?: (tracks: MpvTrack[]) => void;
  onVideoSize?: (width: number, height: number, pixelRatio: number) => void;
}

export const AVPlayerSurface = forwardRef<MPVPlayerHandle, AVPlayerSurfaceProps>(
  function AVPlayerSurface(
    { source, paused, progressInterval = 1000, style, textTracks, subtitleIndex, isDirectPlay = true, onLoad, onProgress, onEnd, onError, onTracks, onVideoSize },
    ref,
  ) {
    const videoRef = useRef<VideoRef>(null);
    const client = useJellyfinClient();
    const { uri, startSec } = parseStart(source);
    // Pistes texte réellement exposées par AVPlayer : sideload (direct play) ou
    // renditions du manifeste HLS (transcode, SubtitleMethod=Hls). Sert à mapper
    // l'index Jellyfin → l'index AVPlayer quand l'ordre diffère.
    const [avTextTracks, setAvTextTracks] =
      useState<Array<{ index: number; title?: string; language?: string }>>([]);
    // Piloté par setAudioTrack() (changement de piste audio en direct play).
    const [selectedAudioTrack, setSelectedAudioTrack] =
      useState<{ type: SelectedTrackType; value?: number } | undefined>(undefined);
    // Dernière piste audio DEMANDÉE (index AVPlayer). Sur certains formats lents à
    // initialiser (Dolby Atmos / E-AC3 JOC), la sélection par index posée juste
    // après onLoad est IGNORÉE par AVPlayer → lecture de la piste par défaut (VO).
    // On la RE-APPLIQUE une fois la lecture réellement démarrée (1ᵉʳ onProgress),
    // exactement comme une re-sélection manuelle (qui, elle, corrige).
    const desiredAudioRef = useRef<number | null>(null);
    const audioReappliedRef = useRef(false);

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
    // Sélection native. La position dans notre liste (`pos`) suit le même ordre
    // que les pistes texte du flux (sideload en direct play ; groupe `#EXT-X-MEDIA`
    // du manifeste en HLS) → utilisable directement comme index AVPlayer. En HLS,
    // si AVPlayer remonte un ordre différent (onTextTracks), on remappe par
    // langue + titre (NAME = DisplayTitle Jellyfin) pour fiabiliser.
    // Sélection native, valable pour les deux modes : sideload (direct play) ET
    // pistes du manifeste HLS (transcode, SubtitleMethod=Hls). La position dans
    // notre liste suit le même ordre que les pistes du flux. En HLS, si AVPlayer
    // remonte un ordre différent (onTextTracks), on remappe par langue + titre.
    const selectedTextTrack = useMemo<{ type: SelectedTrackType; value?: number }>(() => {
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
    }, [textTracks, subtitleIndex, avTextTracks]);

    const handleTextTracks = useCallback(
      (e: { textTracks?: Array<{ index: number; title?: string; language?: string }> }) => {
        setAvTextTracks(e?.textTracks ?? []);
      },
      [],
    );

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
      setAudioTrack: (id: number) => {
        desiredAudioRef.current = id;
        setSelectedAudioTrack({ type: SelectedTrackType.INDEX, value: id });
      },
      // Sous-titres = overlay JS sur tvOS → commandes natives no-op (parité ExoPlayer.tsx Android).
      setSubtitleTrack: () => {},
      addSubtitleTrack: () => {},
      loadSubtitle: () => {},
    }), []);

    // Au démontage : revenir au mode d'affichage par défaut de l'UI.
    useEffect(() => () => TVDisplayCriteria?.reset?.(), []);

    const handleLoad = useCallback(
      (data: OnLoadData) => {
        audioReappliedRef.current = false; // nouvelle source → re-appliquer l'audio voulu une fois démarré
        console.log("[AVP] onLoad dur=", data.duration, "size=", JSON.stringify(data.naturalSize));
        onLoad?.(data.duration ?? 0);

        // tvOS : AVPlayerLayer ne déclenche PAS la bascule HDR/DV de la sortie
        // HDMI → on l'engage via AVDisplayManager (préconisation Apple). Léger
        // délai pour que la couche/asset soient prêts.
        setTimeout(() => TVDisplayCriteria?.engage?.(), 250);

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
        console.log("[AVP] progress t=", data.currentTime.toFixed(1), "buf=", data.playableDuration.toFixed(1));
        // Lecture démarrée → RE-APPLIQUER la piste audio voulue une seule fois :
        // sur les formats lents (Atmos), la sélection posée à onLoad a été ignorée
        // et AVPlayer joue la piste par défaut. Re-poser un nouvel objet la force.
        if (!audioReappliedRef.current && data.currentTime > 0 && desiredAudioRef.current != null) {
          audioReappliedRef.current = true;
          setSelectedAudioTrack({ type: SelectedTrackType.INDEX, value: desiredAudioRef.current });
        }
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
        console.log("[AVP] onError", JSON.stringify(e?.error ?? e));
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
          // Remux local (127.0.0.1) : pas de headers (le serveur local les ignore) → évite un
          // resource-loader custom de react-native-video qui casserait l'indirection master→variant.
          headers: uri.includes("127.0.0.1") ? undefined : headers,
          // Sideload UNIQUEMENT en direct play PROGRESSIF (fichier) : AVPlayer ne sait pas
          // sideloader sur du HLS (.m3u8 — transcode Jellyfin OU remux local HLS) → chargement
          // infini. En HLS les pistes viennent du manifeste.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          textTracks: isDirectPlay && !uri.includes(".m3u8") && rnvTextTracks.length ? (rnvTextTracks as any) : undefined,
        }}
        style={style}
        resizeMode="contain"
        paused={paused}
        // @ts-ignore — focusable existe sur react-native-tvos ; la surface ne doit
        // jamais voler le focus de l'OSD.
        focusable={false}
        selectedAudioTrack={selectedAudioTrack}
        selectedTextTrack={selectedTextTrack}
        // @ts-ignore — onTextTracks remonte les pistes (sideload + manifeste HLS)
        onTextTracks={handleTextTracks}
        progressUpdateInterval={progressInterval}
        onLoad={handleLoad}
        onProgress={handleProgress}
        onEnd={onEnd}
        onError={handleError}
      />
    );
  },
);
