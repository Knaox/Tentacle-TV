import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
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
import { parseStart } from "../../utils/playerHelpers";
import { plog } from "../../utils/playerDiag";
import type { MPVPlayerHandle, MpvTrack, ExoTextTrack } from "./playerTypes";

/**
 * Surface native tvOS (AVPlayer via react-native-video) : MÊME contrat `MPVPlayerHandle` + events que les
 * vues Android → toute l'UI/OSD partagée (`PlayerScreen`, `useTVMpvTracks`, `useTVPlayerEventHandlers`)
 * marche sans modif. Différences plateforme assumées :
 *  - Reprise : on parse `#tnt-start=` de l'URL (AVPlayer ne le lit pas), on l'enlève de l'URI, on
 *    positionne via startPosition + seek de filet. La timeline est ABSOLUE quel que soit le flux
 *    (fichier progressif, HLS de transcodage, HLS local de PrismCore).
 *  - Sous-titres : rendus NATIVEMENT (AVPlayer ne sideload PAS sur HLS → chargement infini sinon) :
 *    direct play progressif → sideload VTT (`source.textTracks`) ; HLS → pistes du manifeste.
 *    Sélection via `selectedTextTrack`, servies en `.vtt`. Burn-in PGS → transcode.
 */

export interface AVPlayerSurfaceProps {
  source: string;
  paused: boolean;
  /** Coupe l'audio pendant une transition (reload/reprise) : la session SORTANTE ne doit pas être audible
   *  derrière l'image figée. Piloté par `reloadFrameSec != null && hasStarted` (TVPlayerView). */
  muted?: boolean;
  progressInterval?: number;
  style?: ViewStyle;
  /** Pistes texte VTT (Jellyfin) à charger nativement (sideload AVPlayer). */
  textTracks?: ExoTextTrack[];
  /** Index Jellyfin du sous-titre sélectionné (-1 = aucun). */
  subtitleIndex?: number;
  /** Direct play (fichier progressif) vs HLS (master.m3u8, transcodage ou PrismCore).
   *  En HLS, AVPlayer NE SAIT PAS sideloader `source.textTracks` (limitation
   *  Apple) → chargement infini. On ne sideload donc qu'en direct play ; en HLS
   *  les sous-titres viennent du manifeste et sont sélectionnés nativement. */
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
    { source, paused, muted = false, progressInterval = 1000, style, textTracks, subtitleIndex, isDirectPlay = true, onLoad, onProgress, onEnd, onError, onTracks, onVideoSize },
    ref,
  ) {
    const videoRef = useRef<VideoRef>(null);
    const client = useJellyfinClient();
    const { uri, startSec } = parseStart(source);
    // Serveur HLS LOCAL (PrismCore, 127.0.0.1) : il ignore les en-têtes d'auth — et en
    // poser ferait passer react-native-video par un resource-loader maison qui casse
    // l'indirection master → variantes. Tout le reste (Jellyfin direct ou proxy) les exige.
    const isLoopback = uri.startsWith("http://127.0.0.1");
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
    // ANTI-RESTART : le seek de filet ne se fait qu'UNE SEULE fois par source.
    // react-native-video refire `onLoad` à chaque mise à jour d'une playlist HLS
    // EVENT (transcodage serveur : segments ajoutés, ENDLIST final) → un seek non
    // gardé relancerait la vidéo à la position de départ. Remis à zéro quand la
    // source (uri) change.
    const didSeekRef = useRef(false);
    useEffect(() => { didSeekRef.current = false; }, [uri]);
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
    // Sélection native, valable pour les deux modes : sideload (direct play) ET
    // pistes du manifeste HLS (transcode, SubtitleMethod=Hls). La position dans
    // notre liste suit le même ordre que les pistes du flux. En HLS, si AVPlayer
    // remonte un ordre différent (onTextTracks), on remappe par langue + titre
    // (NAME = DisplayTitle Jellyfin) pour fiabiliser.
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
      // Timeline absolue partout : la position JS est celle d'AVPlayer.
      seek: (seconds: number) => videoRef.current?.seek(Math.max(0, seconds)),
      setAudioTrack: (id: number) => {
        desiredAudioRef.current = id;
        setSelectedAudioTrack({ type: SelectedTrackType.INDEX, value: id });
      },
      // Sous-titres = overlay JS sur tvOS → commandes natives no-op (parité ExoPlayer.tsx Android).
      setSubtitleTrack: () => {},
      addSubtitleTrack: () => {},
      loadSubtitle: () => {},
    }), []);

    const handleLoad = useCallback(
      (data: OnLoadData) => {
        audioReappliedRef.current = false; // nouvelle source → re-appliquer l'audio voulu une fois démarré
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

        // Reprise : `startPosition` fait l'essentiel, le seek de filet rattrape AVPlayer
        // quand il démarre au segment récent d'une playlist EVENT. GARDE didSeekRef.
        if (!didSeekRef.current && startSec > 1) {
          didSeekRef.current = true;
          videoRef.current?.seek(startSec);
        }
      },
      [onLoad, onVideoSize, onTracks, startSec],
    );

    const handleProgress = useCallback(
      (data: OnProgressData) => {
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
        const err = e?.error;
        const detail = err?.localizedDescription || err?.localizedFailureReason || JSON.stringify(err ?? e);
        plog("averr", `AVPlayer BRUT code=${err?.code ?? "?"} local=${isLoopback ? 1 : 0} : ${detail}`);
        const codecLike =
          err?.code === -11828 || err?.code === -11800
          || /format|codec|cannot open|decode/i.test(detail);
        onError?.(codecLike ? `Could not open: ${detail}` : detail);
      },
      [onError, isLoopback],
    );

    return (
      <Video
        ref={videoRef}
        source={{
          uri,
          // Timeline absolue : la reprise est la position demandée, telle quelle.
          startPosition: startSec > 0 ? startSec * 1000 : undefined,
          headers: isLoopback ? undefined : headers,
          // Sideload UNIQUEMENT en direct play PROGRESSIF (fichier) : AVPlayer ne sait pas
          // sideloader sur du HLS (.m3u8 — transcode Jellyfin OU PrismCore) → chargement
          // infini. En HLS les pistes viennent du manifeste.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          textTracks: isDirectPlay && !uri.includes(".m3u8") && rnvTextTracks.length ? (rnvTextTracks as any) : undefined,
        }}
        style={style}
        resizeMode="contain"
        paused={paused}
        muted={muted}
        // Pré-buffer (iOS/tvOS) : attendre de quoi jouer sans caler avant de démarrer (« son avant vidéo »)
        // + garder ~10 s d'avance (moins de stalls). @ts-expect-error : props iOS de react-native-video.
        automaticallyWaitsToMinimizeStalling={true}
        preferredForwardBufferDuration={10}
        // Anti-veille : défaut de la lib déjà true (RCTVideo) — gravé ici pour que la
        // politique soit lisible. AVPlayer ne bloque QUE la lecture active ; la pause
        // rend la main à la veille système (protection OLED), c'est l'arbitrage voulu.
        preventsDisplaySleepDuringVideoPlayback={true}
        // jamais voler le focus de l'OSD.
        focusable={false}
        selectedAudioTrack={selectedAudioTrack}
        selectedTextTrack={selectedTextTrack}
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
