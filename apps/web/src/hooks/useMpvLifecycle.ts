import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { invoke } from "../desktop/bridge";
import type { MpvEndFileEvent } from "tauri-plugin-libmpv-api";
import { queryTrackList } from "./mpvTrackList";
import {
  awaitPendingDestroy, buildMpvInitOptions, getMpvApi, isLinux, isMacOS, isTauri, isWindows,
  loadMpvApi, setPendingDestroy, withTimeout,
  OBSERVED_PROPERTIES, type MpvState,
} from "./mpvRuntime";
import { wtLog } from "../watchTogether/wtLog";

export interface MpvLifecycleCtx {
  setState: Dispatch<SetStateAction<MpvState>>;
  setReady: (v: boolean) => void;
  setError: (v: string | null) => void;
  setFileLoaded: (v: boolean) => void;
  setMediaReady: (v: boolean) => void;
  positionRef: MutableRefObject<number>;
  bufferedRef: MutableRefObject<number>;
  mutedRef: MutableRefObject<boolean>;
  fileLoadedRef: MutableRefObject<boolean>;
  pendingTracks: MutableRefObject<{ aid?: number; sid?: number } | null>;
  playbackWatchdogRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  wakeupRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  loadfileAtRef: MutableRefObject<number>;
}

/**
 * Cycle de vie de l'instance mpv : init (sérialisée derrière le destroy
 * précédent), observation des propriétés, événements de lecture, destroy au
 * démontage. Extraction mécanique de useDesktopPlayer — la logique est
 * inchangée, seuls les setters/refs passent par `ctx`.
 */
export function useMpvLifecycle(ctx: MpvLifecycleCtx): void {
  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    const unlisteners: (() => void)[] = [];
    const {
      setState, setReady, setError, setFileLoaded, setMediaReady,
      positionRef, bufferedRef, mutedRef, fileLoadedRef, pendingTracks,
      playbackWatchdogRef, wakeupRef, loadfileAtRef,
    } = ctx;

    (async () => {
      // Wait for any previous destroy to finish before re-initializing.
      // Critical for episode switches: old DesktopPlayer unmounts (destroy) while
      // new one mounts (init) — without this gate, both Rust commands race on the
      // same RenderState causing a segfault (GL context / thread use-after-free).
      // Timeout 3 s : empêche un destroy bloqué (Windows GL lock) de geler le mount.
      await awaitPendingDestroy(3000);

      const loaded = await loadMpvApi();
      const api = getMpvApi();
      if (!loaded || cancelled || !api) return;

      try {
        // Render API custom sur macOS ET Linux (mpv dessine dans notre surface
        // GL, pas de fenêtre native → pas d'options d'embarquement `--wid`).
        const renderApi = isMacOS() || isLinux();
        await withTimeout(api.init({
          initialOptions: buildMpvInitOptions(renderApi),
          observedProperties: OBSERVED_PROPERTIES,
        }), 8000, "mpv-init");
        if (cancelled) return;
        if (isWindows()) {
          // La webview cesse de peindre son fond — sans quoi la fenêtre enfant
          // de mpv, placée dessous, resterait invisible. Hors lecture elle est
          // OPAQUE, et la fenêtre avec elle : une fenêtre transparente en
          // permanence sortait Windows du chemin de présentation opaque et
          // faisait scintiller chaque transition (cf. `mpv_window.rs`).
          //
          // Attendu, et posé AVANT `ready` : c'est `ready` qui rend la page
          // transparente à son tour, et l'ordre inverse laisserait voir le fond
          // de la webview le temps d'une image ou deux.
          await invoke("player_surface_transparent", { on: true })
            .catch((e) => console.warn("[mpv] surface transparente refusée", e));
          // mpv vient de créer sa fenêtre vidéo enfant sur son propre thread. On
          // la désarme (WS_DISABLED + hit-testing traversant) pour qu'elle ne
          // puisse jamais geler la file d'entrée partagée avec le thread UI.
          invoke("mpv_harden_child_window").catch(() => {});
        }
        setReady(true);
        // Restore persisted volume + mute (le mute doit survivre aux
        // changements d'épisode/média — remount du player).
        const sv = localStorage.getItem("tentacle_player_volume");
        if (sv != null) {
          const v = Number(sv);
          if (!Number.isNaN(v) && v >= 0 && v <= 100) api.setProperty("volume", v).catch(() => {});
        }
        if (localStorage.getItem("tentacle_player_muted") === "1") {
          api.setProperty("mute", true).catch(() => {});
        }
      } catch (e) {
        setError(String(e));
        return;
      }

      // Observe property changes — position/buffer use refs (throttled in hook)
      const unlistenProps = await api.observeProperties(
        OBSERVED_PROPERTIES,
        (event) => {
          if (cancelled) return;
          switch (event.name) {
            case "time-pos":
              positionRef.current = (event.data as number | null) ?? positionRef.current;
              return; // ref only — no setState
            case "demuxer-cache-duration":
              bufferedRef.current = (event.data as number | null) ?? 0;
              return; // ref only — no setState
            default:
              break;
          }
          setState((prev) => {
            switch (event.name) {
              case "duration":
                return { ...prev, duration: (event.data as number | null) ?? prev.duration };
              case "pause":
                if (prev.paused !== (event.data as boolean)) {
                  wtLog("mpv", `pause → ${event.data}`, { pos: positionRef.current.toFixed(1) });
                }
                return { ...prev, paused: event.data as boolean };
              case "volume":
                // État UI uniquement — la persistance se fait À L'ACTION
                // (setVolume/toggleMute, useMpvCommands). Persister ici écrasait
                // la valeur sauvée : l'émission initiale de mpv (volume=100 par
                // défaut) pouvait arriver APRÈS l'abonnement mais AVANT que le
                // restore (setProperty post-init) ne produise son évènement —
                // course visible sur Linux (thread d'évènements démarré tard).
                return { ...prev, volume: event.data as number };
              case "ao-volume": {
                // Volume du flux natif (PipeWire) — réglé par l'utilisateur via
                // l'OSD SYSTÈME (caelestia, plasma…). On le persiste pour le
                // réappliquer à chaque média : mpv recrée un flux par média et
                // WirePlumber peut le remettre à 100 % (clé de restauration liée
                // au layout 5.1/stéréo). Uniquement pendant la lecture réelle
                // (fileLoaded) : les émissions d'init/destroy sont du bruit.
                if (isLinux() && fileLoadedRef.current && typeof event.data === "number"
                    && event.data > 0 && event.data <= 200) {
                  try { localStorage.setItem("tentacle_player_ao_volume", String(Math.round(event.data))); } catch { /* storage indisponible */ }
                }
                return prev; // pas d'état UI — l'OSD système est l'affichage
              }
              case "mute":
                mutedRef.current = event.data as boolean;
                return { ...prev, muted: event.data as boolean };
              case "aid": {
                // mpv may report aid as number, string, false, or null
                const aid = event.data;
                const aidNum = typeof aid === "number" ? aid : typeof aid === "string" ? Number(aid) : null;
                console.debug("[mpv] aid changed:", { raw: aid, parsed: aidNum });
                return { ...prev, audioTrack: (aidNum != null && !Number.isNaN(aidNum)) ? aidNum : prev.audioTrack };
              }
              case "sid": {
                const sid = event.data;
                const sidNum = typeof sid === "number" ? sid
                  : typeof sid === "string" ? (sid === "no" ? 0 : Number(sid))
                  : (sid === false ? 0 : null);
                console.debug("[mpv] sid changed:", { raw: sid, parsed: sidNum });
                return { ...prev, subtitleTrack: (sidNum != null && !Number.isNaN(sidNum)) ? sidNum : prev.subtitleTrack };
              }
              case "paused-for-cache": {
                // data=null quand aucun média chargé (entre deux loadfile) → false.
                const buffering = (event.data as boolean | null) ?? false;
                if (prev.buffering !== buffering) {
                  wtLog("mpv", `paused-for-cache → ${buffering}`, { pos: positionRef.current.toFixed(1), cacheS: bufferedRef.current.toFixed(1) });
                }
                return { ...prev, buffering };
              }
              case "seeking": {
                const seeking = (event.data as boolean | null) ?? false;
                if (prev.seeking !== seeking) {
                  wtLog("mpv", `seeking → ${seeking}`, { pos: positionRef.current.toFixed(1) });
                }
                return { ...prev, seeking };
              }
              case "eof-reached":
                // With keep-open=yes, mpv doesn't fire end-file on EOF — it pauses
                // at the last frame and sets eof-reached=true instead.
                console.debug("[mpv] eof-reached raw:", event.data, typeof event.data);
                if (event.data) {
                  // Fantôme du fichier précédent (émission initiale au remount,
                  // avant tout loadfile de ce hook) : l'ignorer, sinon l'écran
                  // « épisode suivant » s'affiche au début du nouvel épisode.
                  if (!fileLoadedRef.current) return prev;
                  return { ...prev, eof: true };
                }
                return { ...prev, eof: false };
              default:
                return prev;
            }
          });
        },
      );
      unlisteners.push(unlistenProps);

      // Listen for lifecycle events
      const unlistenEvents = await api.listenEvents((event) => {
        if (cancelled) return;
        switch (event.event) {
          case "file-loaded": {
            wtLog("mpv", "file-loaded", { sinceLoadfileMs: loadfileAtRef.current ? Date.now() - loadfileAtRef.current : -1 });
            // Réapplique le volume/mute persistés à CHAQUE média — filet de
            // sécurité si le restore post-init a été perdu (course à l'init,
            // vue sur Linux). Avant la 1re frame audio → transparent.
            try {
              const sv = localStorage.getItem("tentacle_player_volume");
              if (sv != null) {
                const v = Number(sv);
                if (!Number.isNaN(v) && v >= 0 && v <= 100) api.setProperty("volume", v).catch(() => {});
              }
              const sm = localStorage.getItem("tentacle_player_muted");
              if (sm != null) api.setProperty("mute", sm === "1").catch(() => {});
            } catch { /* storage indisponible */ }
            // DON'T set tracks or apply preferences here — mpv properties
            // may not be accessible until playback-restart.
            // Just start the track list query (delayed).
            const doQuery = () => {
              if (cancelled) return;
              queryTrackList(api).then((trackList) => {
                if (!cancelled) {
                  console.debug("[mpv] tracks loaded:", trackList.length);
                  setState((prev) => ({ ...prev, tracks: trackList }));
                }
              }).catch((e) => {
                console.error("[mpv] queryTrackList failed, retrying:", e);
                setTimeout(() => {
                  if (cancelled) return;
                  queryTrackList(api).then((trackList) => {
                    if (!cancelled) setState((prev) => ({ ...prev, tracks: trackList }));
                  }).catch((e2) => console.error("[mpv] queryTrackList retry failed:", e2));
                }, 1000);
              });
            };
            // Delay — mpv needs time after file-loaded to populate track properties
            setTimeout(doQuery, 300);
            break;
          }
          case "playback-restart": {
            if (cancelled) return;
            wtLog("mpv", "playback-restart (média prêt, première frame)", {
              sinceLoadfileMs: loadfileAtRef.current ? Date.now() - loadfileAtRef.current : -1,
              pos: positionRef.current.toFixed(1),
            });
            // playback-restart reçu : on annule les watchdogs
            if (playbackWatchdogRef.current) {
              clearTimeout(playbackWatchdogRef.current);
              playbackWatchdogRef.current = null;
            }
            if (wakeupRef.current) {
              clearTimeout(wakeupRef.current);
              wakeupRef.current = null;
            }
            setState((prev) => ({ ...prev, playing: true, eof: false }));
            // Linux : réapplique le volume du flux système (ao-volume) persisté.
            // Ici seulement — l'AO n'existe qu'une fois la lecture démarrée
            // (ao-volume est inaccessible avant). Sans ça, chaque média repart
            // au volume WirePlumber par défaut (souvent 100 %).
            if (isLinux()) {
              try {
                const sav = localStorage.getItem("tentacle_player_ao_volume");
                if (sav != null) {
                  const v = Number(sav);
                  if (!Number.isNaN(v) && v > 0 && v <= 200) api.setProperty("ao-volume", v).catch(() => {});
                }
              } catch { /* storage indisponible */ }
            }
            // Sync pause state to close startup race condition
            api.getProperty("pause", "flag").then((p) => {
              if (!cancelled && p !== null) setState((prev) => ({ ...prev, paused: p }));
            }).catch(() => {});

            // Apply deferred audio/subtitle track selections NOW (mpv is ready)
            const tracks = pendingTracks.current;
            if (tracks) {
              console.debug("[mpv] playback-restart: applying pending tracks", tracks);
              pendingTracks.current = null;
              if (tracks.aid != null) api.command("set", ["aid", String(tracks.aid)]).catch((e) => console.error("[mpv] set aid failed:", e));
              if (tracks.sid != null) {
                if (tracks.sid === 0) {
                  api.command("set", ["sid", "no"]).catch((e) => console.error("[mpv] set sid=no failed:", e));
                } else {
                  api.command("set", ["sid", String(tracks.sid)]).catch((e) => console.error("[mpv] set sid failed:", e));
                  api.command("set", ["sub-visibility", "yes"]).catch(() => {});
                }
              }
            }

            // Signal that mpv is ready to accept property changes
            // (preference effects in DesktopPlayer depend on this)
            if (!cancelled) {
              setFileLoaded(true);
              setMediaReady(true);
            }
            break;
          }
          case "end-file": {
            // Only set eof for real EOF — not for loadfile replacements (Bug 7)
            const reason = (event as MpvEndFileEvent).reason;
            wtLog("mpv", `end-file (reason=${reason})`, { pos: positionRef.current.toFixed(1) });
            setState((prev) => ({ ...prev, playing: false, eof: reason === "eof" }));
            break;
          }
          case "idle":
            wtLog("mpv", "idle (aucun média chargé)");
            setState((prev) => ({ ...prev, playing: false }));
            break;
        }
      });
      unlisteners.push(unlistenEvents);
    })();

    return () => {
      cancelled = true;
      if (playbackWatchdogRef.current) {
        clearTimeout(playbackWatchdogRef.current);
        playbackWatchdogRef.current = null;
      }
      if (wakeupRef.current) {
        clearTimeout(wakeupRef.current);
        wakeupRef.current = null;
      }
      for (const unlisten of unlisteners) unlisten();
      // La webview reprend son fond opaque. Sur Windows c'est ce qui met fin au
      // scintillement du retour au média : la fenêtre enfant de mpv SURVIT à ce
      // démontage — `destroy()` part sans être attendu, et c'est le `gui_thread`
      // de mpv qui détruira la fenêtre, plus tard. Jusque-là une webview sans
      // fond la laissait transparaître par-dessous la page en cours de repeint.
      //
      // Ce nettoyage-ci passe en premier — l'effet est déclaré avant celui qui
      // rend son fond à la page (`DesktopPlayer`) — mais l'`invoke` est
      // asynchrone : la commande atterrit après le tick de démontage, donc après
      // que la page soit redevenue opaque. C'est le bon sens. L'inverse ne
      // coûterait de toute façon qu'un fond noir ; ce sont les deux
      // TRANSPARENTS en même temps qui laisseraient voir le bureau.
      if (isWindows()) invoke("player_surface_transparent", { on: false }).catch(() => {});
      const api = getMpvApi();
      setPendingDestroy(api ? api.destroy().catch(() => {}) : Promise.resolve());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
