import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { ViewStyle } from "react-native";
import { NativeModules } from "react-native";

/** Module natif tvOS : pilote AVDisplayManager pour la bascule HDR/DV HDMI. */
const TVDisplayCriteria = (NativeModules as {
  TVDisplayCriteria?: { engage?: () => void; reset?: () => void };
}).TVDisplayCriteria;
const TVLocalRemux = (NativeModules as {
  TVLocalRemux?: { setPosition?: (seconds: number) => void };
}).TVLocalRemux;
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
 *    positionne via startPosition + seek de filet (cf. OFFSET plus bas pour le remux 0-based).
 *  - Sous-titres : rendus NATIVEMENT (AVPlayer ne sideload PAS sur HLS → chargement infini sinon) :
 *    direct play progressif → sideload VTT (`source.textTracks`) ; transcode/remux HLS → pistes du
 *    manifeste Jellyfin. Sélection via `selectedTextTrack`, servies en `.vtt`. Burn-in PGS → transcode.
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
    { source, paused, muted = false, progressInterval = 1000, style, textTracks, subtitleIndex, isDirectPlay = true, onLoad, onProgress, onEnd, onError, onTracks, onVideoSize },
    ref,
  ) {
    const videoRef = useRef<VideoRef>(null);
    const client = useJellyfinClient();
    const { uri, startSec } = parseStart(source);
    // OFFSET absolu⇄relatif CONFINÉ ici : le remux (HLS 127.0.0.1) est une session 0-based (make_zero)
    // qu'AVPlayer mesure depuis 0 mais qui représente l'absolu [startSec…]. On AJOUTE offset aux positions
    // remontées à JS (scrubber/reprise/sous-titres restent absolus) et on le RETIRE des seeks ; le pacing
    // natif reçoit la position BRUTE. Direct play/transcode (déjà absolu, lu depuis 0) → offset 0.
    const isRemux = uri.includes("127.0.0.1");
    const offset = isRemux ? startSec : 0;
    const offsetRef = useRef(0);
    offsetRef.current = offset;
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
    // ANTI-RESTART : le seek anti-bord-live (cf. handleLoad) ne doit se faire qu'UNE SEULE fois
    // par source. react-native-video refire `onLoad` à chaque mise à jour de la playlist HLS
    // EVENT croissante (segments ajoutés, ENDLIST final) → un seek non gardé relancerait la
    // vidéo au début. On le remet à zéro quand la source (uri) change.
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
      // Le JS passe une position ABSOLUE → retirer l'offset pour le seek RELATIF d'AVPlayer (remux).
      seek: (seconds: number) => videoRef.current?.seek(Math.max(0, seconds - offsetRef.current)),
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
        onLoad?.(data.duration ?? 0);

        // tvOS : la media-playlist HLS du REMUX local (127.0.0.1, sans master) ne
        // déclenche PAS la bascule HDR/DV de la sortie HDMI → on l'engage à la main via
        // AVDisplayManager (gTVDynRange fraîchement posé par TVLocalRemux.start). Léger
        // délai pour que la couche/asset soient prêts. Direct Play NATIF / transcode :
        // PAS d'engage manuel — AVPlayer bascule seul sur un fichier progressif, et
        // gTVDynRange serait périmé d'un remux précédent (mauvais badge sur du SDR natif).
        if (uri.includes("127.0.0.1")) setTimeout(() => TVDisplayCriteria?.engage?.(), 250);

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

        // Anti BORD-LIVE + reprise : AVPlayer démarre au segment récent sur une playlist EVENT. REMUX =
        // session 0-based (la reprise à T EST le début de session) → seek 0 RELATIF (PAS startSec = offset
        // absolu → viserait absolu-2T) ; direct play/transcode (absolu) → seek startSec. GARDE didSeekRef.
        if (!didSeekRef.current && (startSec > 1 || isRemux)) {
          didSeekRef.current = true;
          videoRef.current?.seek(isRemux ? 0 : Math.max(0, startSec));
        }
      },
      [onLoad, onVideoSize, onTracks, startSec, uri, isRemux],
    );

    const handleProgress = useCallback(
      (data: OnProgressData) => {
        // PHASE 2 : pousser la position au remux on-device → il ne tire que ~ce qui est consommé (+ tampon).
        // BRUT (relatif) : le pacing/purge natif raisonne en 0-based (cf. make_zero), comme currentTime.
        TVLocalRemux?.setPosition?.(Math.max(0, data.currentTime));
        // Lecture démarrée → RE-APPLIQUER la piste audio voulue une seule fois :
        // sur les formats lents (Atmos), la sélection posée à onLoad a été ignorée
        // et AVPlayer joue la piste par défaut. Re-poser un nouvel objet la force.
        if (!audioReappliedRef.current && data.currentTime > 0 && desiredAudioRef.current != null) {
          audioReappliedRef.current = true;
          setSelectedAudioTrack({ type: SelectedTrackType.INDEX, value: desiredAudioRef.current });
        }
        // + offset → positions ABSOLUES pour le JS (scrubber/reprise/sous-titres) ; relatif sur le remux.
        const off = offsetRef.current;
        onProgress?.(
          Math.max(0, data.currentTime) + off,
          data.playableDuration > 0 ? data.playableDuration + off : 0,
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
        plog("averr", `AVPlayer BRUT code=${err?.code ?? "?"} remux=${isRemux ? 1 : 0} : ${detail}`);
        // Remux : pause longue → manifeste HLS `event` figé → -11866 « ended unexpectedly » (récupérable, segments sur disque) → relance à la position.
        if (isRemux && (err?.code === -11866 || /ended unexpectedly/i.test(detail))) { onError?.("REMUX_STALL"); return; }
        // -19601 (CoreMedia) : flux remux invalide (ex. hvcC vide — extradata source introuvable).
        // Classé « codec » → PlayerScreen bascule en transcode serveur au lieu d'afficher l'erreur.
        const codecLike =
          err?.code === -11828 || err?.code === -11800 || (isRemux && err?.code === -19601)
          || /format|codec|cannot open|decode/i.test(detail);
        onError?.(codecLike ? `Could not open: ${detail}` : detail);
      },
      [onError, isRemux],
    );

    return (
      <Video
        ref={videoRef}
        source={{
          uri,
          // REMUX : session 0-based → startPosition 0 (début relatif = absolu startSec ; PAS startSec*1000
          // qui viserait relatif-startSec = absolu-2T). Direct play / transcode (absolu) → startSec*1000.
          startPosition: isRemux ? 0 : (startSec > 0 ? startSec * 1000 : undefined),
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
        muted={muted}
        // Pré-buffer (iOS/tvOS) : attendre de quoi jouer sans caler avant de démarrer (« son avant vidéo »)
        // + garder ~10 s d'avance (moins de stalls). @ts-ignore : props iOS de react-native-video.
        // @ts-ignore
        automaticallyWaitsToMinimizeStalling={true}
        // @ts-ignore
        preferredForwardBufferDuration={10}
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
