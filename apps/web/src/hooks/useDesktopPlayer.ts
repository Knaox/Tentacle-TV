import { useState, useEffect, useCallback, useRef } from "react";
import {
  defaultMpvState, getMpvApi,
  type MpvState, type PlayOptions,
} from "./mpvRuntime";
import { useMpvLifecycle } from "./useMpvLifecycle";
import { useMpvCommands } from "./useMpvCommands";
import { wtLog } from "../watchTogether/wtLog";

// Ré-exports de compatibilité — de nombreux modules importent la détection de
// plateforme et les types depuis ce hook (découpage mpvRuntime/lifecycle/commands).
export { isTauri, isMacOS, isWindows, isLinux, isAppStoreBuild } from "./mpvRuntime";
export type { MpvState, PlayOptions } from "./mpvRuntime";
export type { MpvTrack } from "./mpvTrackList";

export function useDesktopPlayer() {
  const [state, setState] = useState<MpvState>(() => {
    const sv = localStorage.getItem("tentacle_player_volume");
    const vol = sv != null ? Number(sv) : 100;
    return { ...defaultMpvState, volume: (!Number.isNaN(vol) && vol >= 0 && vol <= 100) ? vol : 100 };
  });
  const [ready, setReady] = useState(false);
  const [fileLoaded, setFileLoadedState] = useState(false);
  // Vrai playback-restart du média courant (première frame rendue) — jamais
  // forcé par le watchdog, contrairement à fileLoaded. Signal « prêt » fiable
  // pour Watch Together (un watchdog-forcé ferait repartir le groupe sans nous).
  const [mediaReady, setMediaReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // État mute courant (observé) — lu par toggleMute/setVolume pour persister.
  const mutedRef = useRef(false);
  // Miroir synchrone de fileLoaded — lu par l'observer (mpv émet la valeur
  // INITIALE des propriétés observées à l'abonnement : un eof-reached=true de
  // l'ANCIEN fichier arrive au remount, avant tout chargement par ce hook).
  const fileLoadedRef = useRef(false);
  const setFileLoaded = useCallback((v: boolean) => {
    fileLoadedRef.current = v;
    setFileLoadedState(v);
  }, []);
  const pendingTracks = useRef<{ aid?: number; sid?: number } | null>(null);
  // Watchdog : si playback-restart n'est pas émis après un loadfile, UN retry
  // complet puis erreur visible (voir play()).
  const playbackWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Wake-up Windows : sur cold start, mpv n'émet parfois pas playback-restart
  // tant qu'on n'a pas seeké — la vidéo et l'UI restent figées. On force un
  // mini-seek (+50 ms) à 600 ms pour réveiller le pipeline si nécessaire.
  // 600 ms : assez long pour laisser un cold start sain finir sans seek,
  // assez court pour que l'utilisateur ne perçoive pas le freeze.
  const wakeupRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // High-frequency refs — synced to React state via throttle timer
  const positionRef = useRef(0);
  const bufferedRef = useRef(0);
  // Diagnostic : horodatage du dernier loadfile — mesure loadfile→restart.
  const loadfileAtRef = useRef(0);

  // Init mpv + observers + destroy (sérialisé) au montage/démontage.
  useMpvLifecycle({
    setState, setReady, setError, setFileLoaded, setMediaReady,
    positionRef, bufferedRef, mutedRef, fileLoadedRef, pendingTracks,
    playbackWatchdogRef, wakeupRef, loadfileAtRef,
  });

  // Throttle position/buffer sync to React state at ~4Hz
  useEffect(() => {
    const id = setInterval(() => {
      setState((prev) => {
        const pos = positionRef.current;
        const buf = bufferedRef.current;
        if (pos === prev.position && buf === prev.buffered) return prev;
        return { ...prev, position: pos, buffered: buf };
      });
    }, 250);
    return () => clearInterval(id);
  }, []);

  const play = useCallback(async (options: PlayOptions, attempt = 1) => {
    const api = getMpvApi();
    if (!api) return;
    setFileLoaded(false); // Reset — will be set again on file-loaded event
    setMediaReady(false);
    // Purge des restes du fichier précédent (un eof=true collé afficherait
    // l'écran de fin dès le chargement du nouveau média).
    setState((prev) => ({ ...prev, eof: false, playing: false }));

    const isHls = options.url.includes(".m3u8");
    wtLog("mpv", `play() attempt=${attempt} ${isHls ? "HLS/transcode" : "direct"}`, {
      url: options.url.substring(0, 110),
      startPosition: options.startPosition?.toFixed(1) ?? "none",
    });

    // Watchdog : un HLS transcodé démarre lentement mais LÉGITIMEMENT
    // (spawn ffmpeg + far-seek : 2-5 s, parfois plus) → 20 s ; direct play
    // → 8 s. À expiration : UN retry loadfile complet (seul moyen de
    // récupérer un demuxer resté muet — flipper fileLoaded ne répare rien),
    // puis erreur visible (l'UI propose déjà le fallback web ; en groupe,
    // wt:playbackError fait que les autres ne nous attendent plus).
    const watchdogMs = isHls ? 20_000 : 8_000;
    if (playbackWatchdogRef.current) clearTimeout(playbackWatchdogRef.current);
    playbackWatchdogRef.current = setTimeout(() => {
      playbackWatchdogRef.current = null;
      if (attempt === 1) {
        wtLog("mpv", `WATCHDOG: playback-restart absent après ${watchdogMs / 1000}s — retry loadfile`, { url: options.url.substring(0, 110) });
        void play(options, 2);
      } else {
        wtLog("mpv", "WATCHDOG: playback-restart absent après retry — flux en échec (setError → fallback web)");
        setFileLoaded(true); // débloque l'UI (spinner/preferences)
        setError("Le flux vidéo n'a pas démarré. Réessayez ou changez de qualité.");
      }
    }, watchdogMs);

    // Wake-up cold start (Windows) : réservé au DIRECT PLAY. Sur un HLS
    // transcodé encore en cours d'ouverture, ce seek forcé tombait PENDANT
    // le seek initial `start=+pos` et coinçait le demuxer → jamais de
    // playback-restart (écran noir, pas de son). Jamais de nudge sur .m3u8.
    if (wakeupRef.current) { clearTimeout(wakeupRef.current); wakeupRef.current = null; }
    if (!isHls) {
      wakeupRef.current = setTimeout(() => {
        wtLog("mpv", "wake-up: nudge pipeline (+50ms seek, cold start direct play)");
        getMpvApi()?.command("seek", [0.05, "relative"]).catch(() => {});
        wakeupRef.current = null;
      }, 600);
    }
    try {
      // La propriété `pause` de mpv PERSISTE entre les loadfile : un rebuild
      // lancé pendant une pause (de groupe notamment) chargerait le nouveau
      // stream en pause → aucune frame décodée, pas de playback-restart →
      // écran noir/silence jusqu'au watchdog. Toujours charger en lecture ;
      // une pause légitime (group-wait d'un autre membre) sera réappliquée
      // par le moteur de sync juste après.
      await api.setProperty("pause", false).catch(() => {});
      if (options.startPosition != null && options.startPosition > 0) {
        console.debug("[mpv] play: setting start position", options.startPosition);
        await api.command("set", ["start", `+${options.startPosition.toFixed(1)}`]);
      } else {
        // Reset start property so the stream starts from its natural beginning
        // (important for transcoded streams where position is baked into the URL)
        //
        // ⚠️ `none`, et surtout PAS `no`. `--start` attend un temps relatif, dont
        // la valeur « aucune » s'écrit `none` ; `no` ne s'analyse pas, la
        // commande rend MPV_ERROR_COMMAND (-12), et le `.catch` ci-dessous
        // avalait l'échec. La remise à zéro n'avait donc JAMAIS lieu : après une
        // reprise à 30:00, le média suivant lancé depuis le début repartait à
        // 30:00. Mesuré sur le libmpv du dépôt :
        //   set start no   -> -12, start vaut toujours "+1800"
        //   set start none ->   0, start vaut "none"
        await api.command("set", ["start", "none"]).catch((e) => console.warn("[mpv] reset start:", e));
      }
      const tracks: { aid?: number; sid?: number } = {};
      if (options.audioTrack != null && options.audioTrack > 0) {
        tracks.aid = options.audioTrack;
      }
      if (options.subtitleTrack != null) {
        tracks.sid = options.subtitleTrack;
      }
      pendingTracks.current = Object.keys(tracks).length > 0 ? tracks : null;
      loadfileAtRef.current = Date.now();
      await api.command("loadfile", [options.url]);
      setError(null);
    } catch (e) {
      wtLog("mpv", "play() FAILED (commande mpv en erreur)", { error: String(e) });
      setError(String(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commands = useMpvCommands({ state, setState, mutedRef });

  return { state, ready, fileLoaded, mediaReady, error, play, ...commands };
}
