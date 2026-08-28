import { useState, useEffect, useCallback, useRef } from "react";
import {
  defaultMpvState, getMpvApi, isWindows as estWindows,
  type MpvState, type PlayOptions,
} from "./mpvRuntime";
import { useMpvLifecycle } from "./useMpvLifecycle";
import { useMpvCommands } from "./useMpvCommands";
import { classifyEndFileFailure, type PlaybackFailure } from "./playbackFailure";
import type { MpvEndFileEvent } from "../lib/mpvTypes";
import { noterAid, noterSid, oublierPistesDemandees } from "./mpvTrackIntent";
import { ouvrirDemarrage, tracerCommande } from "./startupTrace";
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
  // Échec courant, TYPÉ : « media » (fichier local disparu — écran dédié, mpv
  // épargné) ou « player » (défaut du lecteur — bascule de secours). Voir
  // `playbackFailure.ts` pour la règle de classement.
  const [failure, setFailure] = useState<PlaybackFailure | null>(null);
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
  // Miroir synchrone de `paused-for-cache` : le nudge s'exécute dans un timer,
  // hors rendu React, et ne peut donc pas lire `state.buffering`.
  const bufferingRef = useRef(false);
  // Diagnostic : horodatage du dernier loadfile — mesure loadfile→restart.
  const loadfileAtRef = useRef(0);
  // Dernier play() lancé — relu quand un end-file(ERROR) tue le chargement :
  // il porte l'URL à rejouer et le numéro de tentative.
  const lastPlayRef = useRef<{ options: PlayOptions; attempt: number } | null>(null);
  // Trampoline : le ctx du cycle de vie est construit AVANT que `play` (donc le
  // vrai gestionnaire) n'existe — la ref se remplit plus bas, par effet.
  const endFileFailureRef = useRef<(fin: MpvEndFileEvent) => void>(() => {});

  // Init mpv + observers + destroy (sérialisé) au montage/démontage.
  useMpvLifecycle({
    setState, setReady, setFailure, setFileLoaded, setMediaReady,
    positionRef, bufferedRef, bufferingRef, mutedRef, fileLoadedRef,
    playbackWatchdogRef, wakeupRef, loadfileAtRef,
    onEndFileFailure: (fin) => endFileFailureRef.current(fin),
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
    lastPlayRef.current = { options, attempt };
    setFileLoaded(false); // Reset — will be set again on file-loaded event
    setMediaReady(false);
    // Purge des restes du fichier précédent (un eof=true collé afficherait
    // l'écran de fin dès le chargement du nouveau média).
    // `tracks` compris : sur un rebuild de source (qualité, burn-in), la
    // track-list du fichier PRÉCÉDENT survivait, et le premier passage des
    // effets de préférence calculait un mapping par langue depuis une liste
    // périmée — donc une commande de piste juste après la première image, et
    // le cache de mpv jeté avec (mpv#8422). Vide, la liste force le repli
    // positionnel, qui coïncide avec ce qu'on vient de poser avant l'ouverture.
    setState((prev) => ({ ...prev, eof: false, playing: false, tracks: [] }));

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
        tracerCommande("WATCHDOG — retry loadfile", `${watchdogMs / 1000} s sans playback-restart`);
        void play(options, 2);
      } else {
        wtLog("mpv", "WATCHDOG: playback-restart absent après retry — flux en échec (setFailure → fallback web)");
        setFileLoaded(true); // débloque l'UI (spinner/preferences)
        setFailure({ kind: "player", messageKey: "player:streamStartFailed" });
      }
    }, watchdogMs);

    // Wake-up cold start (Windows) : réservé au DIRECT PLAY. Sur un HLS
    // transcodé encore en cours d'ouverture, ce seek forcé tombait PENDANT
    // le seek initial `start=+pos` et coinçait le demuxer → jamais de
    // playback-restart (écran noir, pas de son). Jamais de nudge sur .m3u8.
    //
    // ⚠️ WINDOWS UNIQUEMENT, et sur un pipeline réellement figé.
    //
    // Ce nudge répare une fenêtre ENFANT Win32 qui n'émet pas toujours
    // `playback-restart` (cf. 6c39b06c). Il n'a jamais rien réparé ailleurs, et
    // depuis `cache-pause-initial` il fait activement du mal : mpv retient
    // désormais l'image jusqu'à avoir sa réserve, donc le seek tombait dans le
    // remplissage et jetait tout — mesuré, cache à 7 s puis 0 à l'instant où
    // l'image sort. Le repousser pendant `paused-for-cache` a même empiré les
    // choses : il tirait alors précisément à la fin du remplissage, dans
    // l'intervalle qui précède l'annulation par `playback-restart`.
    //
    // Deuxième garde, pour Windows : un cache qui BOUGE prouve que mpv lit des
    // données. Le pipeline que ce nudge vise, lui, est immobile — cache stable,
    // rien qui avance. On ne réveille donc que ce qui dort vraiment.
    //
    // Ailleurs, le watchdog ci-dessus reste le filet : il fait un vrai retry de
    // loadfile, seul moyen de récupérer un demuxer resté muet.
    if (wakeupRef.current) { clearTimeout(wakeupRef.current); wakeupRef.current = null; }
    if (!isHls && estWindows()) {
      const armerReveil = () => {
        const cacheAuDepart = bufferedRef.current;
        wakeupRef.current = setTimeout(() => {
          wakeupRef.current = null;
          if (bufferingRef.current || bufferedRef.current !== cacheAuDepart) { armerReveil(); return; }
          wtLog("mpv", "wake-up: nudge pipeline (+50ms seek, cold start direct play)");
          tracerCommande("seek de réveil", "+50 ms");
          getMpvApi()?.command("seek", [0.05, "relative"]).catch(() => {});
        }, 600);
      };
      armerReveil();
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
      // Pistes AVANT le loadfile, comme `start` et `pause` : `aid`/`sid`
      // persistent d'un fichier à l'autre, donc mpv ouvre celui-ci déjà sur la
      // bonne piste. Les appliquer APRÈS la première image — ce que faisait
      // pendingTracks, sur playback-restart — réinitialisait la chaîne audio et
      // resynchronisait par un seek interne : mpv jetait son cache et la barre
      // de chargement retombait à zéro juste après le démarrage.
      // Nouveau média : ce qu'on avait demandé pour le précédent n'a plus cours.
      oublierPistesDemandees();
      if (options.audioTrack != null && options.audioTrack > 0) {
        tracerCommande("set aid (avant ouverture)", String(options.audioTrack));
        // Noté seulement si la commande a ABOUTI : un `set` refusé ne doit pas
        // laisser croire à une intention posée, sans quoi la correction
        // ultérieure serait avalée.
        await api.command("set", ["aid", String(options.audioTrack)])
          .then(() => noterAid(options.audioTrack as number))
          .catch((e) => console.warn("[mpv] set aid:", e));
      }
      if (options.subtitleTrack != null) {
        const sid = options.subtitleTrack === 0 ? "no" : String(options.subtitleTrack);
        tracerCommande("set sid (avant ouverture)", sid);
        await api.command("set", ["sid", sid])
          .then(() => noterSid(options.subtitleTrack as number))
          .catch((e) => console.warn("[mpv] set sid:", e));
      }
      // Nouveau média : la réserve du précédent n'a plus cours. À remettre à
      // zéro EXPLICITEMENT, maintenant qu'un `null` ne l'écrase plus.
      bufferedRef.current = 0;
      loadfileAtRef.current = Date.now();
      ouvrirDemarrage(`${isHls ? "HLS/transcode" : "lecture directe"} · départ ${
        options.startPosition != null && options.startPosition > 0
          ? `${options.startPosition.toFixed(0)} s` : "début"}`);
      await api.command("loadfile", [options.url]);
      setFailure(null);
    } catch (e) {
      wtLog("mpv", "play() FAILED (commande mpv en erreur)", { error: String(e) });
      setFailure({ kind: "player", detail: String(e) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // end-file(ERROR) pendant un chargement (le cycle de vie a déjà désarmé le
  // watchdog) : même sémantique deux-tentatives que le watchdog, mais SANS les
  // attentes mortes — l'échec est explicite, 2×8 s n'apporteraient rien.
  // Mesuré (rejeu du 28.08) : fichier local illisible = end-file(4) immédiat,
  // deux fois, puis 16 s de watchdog avant la bascule. Désormais < 1 s.
  const handleEndFileFailure = useCallback((fin: MpvEndFileEvent) => {
    const dernier = lastPlayRef.current;
    if (dernier !== null && dernier.attempt === 1) {
      wtLog("mpv", `end-file en erreur pendant le chargement (error=${fin.error ?? "-"}) — retry immédiat`);
      tracerCommande("retry loadfile (end-file en erreur)", `error=${fin.error ?? "-"}`);
      void play(dernier.options, 2);
      return;
    }
    wtLog("mpv", `end-file en erreur après retry (error=${fin.error ?? "-"}) — échec définitif`);
    setFileLoaded(true); // débloque l'UI, comme le watchdog
    setFailure(classifyEndFileFailure({
      errorCode: fin.error,
      isLocalPlayback: false,
      localFilePresent: null,
    }));
  }, [play, setFileLoaded]);
  useEffect(() => { endFileFailureRef.current = handleEndFileFailure; }, [handleEndFileFailure]);

  const commands = useMpvCommands({ state, setState, mutedRef });

  return { state, ready, fileLoaded, mediaReady, failure, play, ...commands };
}
