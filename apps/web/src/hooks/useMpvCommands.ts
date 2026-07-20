import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { getMpvApi, isLinux, isMacOS, isTauri, setPendingDestroy, type MpvState } from "./mpvRuntime";
import { queryTrackList } from "./mpvTrackList";

/**
 * Commandes de contrôle mpv (pause/seek/pistes/volume/vitesse/plein écran) +
 * effets annexes (anti-veille macOS/Linux, resync plein écran au montage).
 * Extraction mécanique de useDesktopPlayer — logique inchangée.
 */

// macOS et Linux : Render API (vo=libmpv) → mpv n'a AUCUNE fenêtre native, son
// `stop-screensaver` est inopérant. On gère l'anti-veille nous-mêmes côté Rust :
// IOPMAssertion sur macOS (macos/sleep_assertion.rs), inhibiteurs D-Bus
// ScreenSaver/SessionManager/PowerManagement + logind sur Linux
// (linux/sleep_inhibit.rs). Windows n'en a pas besoin : mpv y possède sa propre
// fenêtre (--wid) et applique stop-screensaver (SetThreadExecutionState).
function needsKeepAwake(): boolean {
  return isTauri() && (isMacOS() || isLinux());
}

export function useMpvCommands({
  state,
  setState,
  mutedRef,
}: {
  state: MpvState;
  setState: Dispatch<SetStateAction<MpvState>>;
  mutedRef: MutableRefObject<boolean>;
}) {
  // Empêche la mise en veille (écran + système) pendant la lecture.
  useEffect(() => {
    if (!needsKeepAwake()) return;
    const shouldKeepAwake = state.playing && !state.paused;
    let cancelled = false;
    import("@tauri-apps/api/core").then(({ invoke }) => {
      if (cancelled) return;
      const cmd = shouldKeepAwake ? "prevent_display_sleep_start" : "prevent_display_sleep_stop";
      invoke(cmd).catch((e) => console.warn(`[mpv] ${cmd} failed:`, e));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [state.playing, state.paused]);

  // Filet de sécurité : libère toujours l'assertion au démontage du player,
  // même si l'effet ci-dessus n'a pas eu le temps de se déclencher.
  useEffect(() => {
    return () => {
      if (!needsKeepAwake()) return;
      import("@tauri-apps/api/core").then(({ invoke }) => {
        invoke("prevent_display_sleep_stop").catch(() => {});
      }).catch(() => {});
    };
  }, []);

  const togglePause = useCallback(async () => { getMpvApi()?.command("cycle", ["pause"]).catch(() => {}); }, []);
  const setPause = useCallback(async (paused: boolean) => { getMpvApi()?.setProperty("pause", paused).catch(() => {}); }, []);
  const seek = useCallback(async (pos: number) => { getMpvApi()?.command("seek", [pos, "absolute"]).catch(() => {}); }, []);
  const seekRelative = useCallback(async (off: number) => { getMpvApi()?.command("seek", [off, "relative"]).catch(() => {}); }, []);
  const setAudioTrack = useCallback(async (id: number) => {
    const api = getMpvApi();
    if (!api) return;
    console.debug("[mpv] setAudioTrack", id);
    // Use command("set") with string value — setProperty("aid", number)
    // fails because the plugin sends MPV_FORMAT_DOUBLE but mpv expects MPV_FORMAT_INT64.
    try { await api.command("set", ["aid", String(id)]); }
    catch (e) { console.error("[mpv] setAudioTrack failed:", e); }
  }, []);
  const setSubtitleTrack = useCallback(async (id: number) => {
    const api = getMpvApi();
    if (!api) return;
    console.debug("[mpv] setSubtitleTrack", id);
    try {
      if (id === 0) {
        await api.command("set", ["sid", "no"]);
      } else {
        await api.command("set", ["sid", String(id)]);
        await api.command("set", ["sub-visibility", "yes"]).catch(() => {});
      }
    } catch (e) { console.error("[mpv] setSubtitleTrack failed:", e); }
  }, []);
  const setVolume = useCallback(async (v: number) => {
    getMpvApi()?.setProperty("volume", v).catch(() => {});
    // Persisté À L'ACTION (comme le mute) — ne plus compter sur l'aller-retour
    // property-change : son émission initiale (volume=100 par défaut mpv)
    // pouvait écraser la valeur sauvée au démarrage (course observe/restore,
    // vue sur Linux).
    try { localStorage.setItem("tentacle_player_volume", String(Math.round(v))); } catch { /* storage indisponible */ }
    // Monter le volume démute (et efface le mute persisté).
    if (v > 0 && mutedRef.current) {
      getMpvApi()?.setProperty("mute", false).catch(() => {});
      try { localStorage.setItem("tentacle_player_muted", "0"); } catch { /* storage indisponible */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Watch Together : rattrapage doux (0.95/1.05) — pitch préservé par mpv
  // (audio-pitch-correction=yes par défaut).
  const setSpeed = useCallback(async (v: number) => { getMpvApi()?.setProperty("speed", v).catch(() => {}); }, []);
  const toggleMute = useCallback(async () => {
    const next = !mutedRef.current;
    getMpvApi()?.setProperty("mute", next).catch(() => {});
    // Persisté : le mute survit aux changements d'épisode/média (remount).
    try { localStorage.setItem("tentacle_player_muted", next ? "1" : "0"); } catch { /* storage indisponible */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const isFs = await invoke<boolean>("toggle_fullscreen");
      setState((prev) => ({ ...prev, fullscreen: isFs }));
    } catch {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        const current = await win.isFullscreen();
        await win.setFullscreen(!current);
        setState((prev) => ({ ...prev, fullscreen: !current }));
      } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Au montage, resynchronise l'état React du plein écran avec l'état RÉEL de la
  // fenêtre native Tauri. Nécessaire car un changement d'épisode remonte le
  // lecteur (key={itemId}) : la fenêtre reste en plein écran alors que le state
  // React repart à false → sans cette resync, l'icône du bouton plein écran
  // serait incohérente jusqu'au prochain toggle.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const fs = await invoke<boolean>("is_fullscreen");
        if (!cancelled) setState((prev) => ({ ...prev, fullscreen: fs }));
      } catch { /* ignore — hors Tauri ou commande indisponible */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Load an external subtitle file (URL or path) into mpv.
   *  Retourne le sid attribué (piste sélectionnée) — permet une re-sélection
   *  ultérieure sans re-sub-add (mpv dupliquerait la piste). */
  const addSubtitle = useCallback(async (url: string, select = true): Promise<number | null> => {
    const api = getMpvApi();
    if (!api) return null;
    console.debug("[mpv] sub-add", { url: url.substring(0, 100), select });
    try {
      await api.command("sub-add", [url, select ? "select" : "auto"]);
      // La piste ajoutée n'était pas dans la track-list lue au file-loaded :
      // sans relecture, l'état mpv l'ignore (surbrillance et mappings faux).
      void queryTrackList(api)
        .then((tracks) => {
          if (tracks.length > 0) setState((prev) => ({ ...prev, tracks }));
        })
        .catch(() => {});
      if (select) {
        await api.setProperty("sub-visibility", true).catch(() => {});
        const sid = await api.getProperty("sid", "int64").catch(() => null);
        return typeof sid === "number" ? sid : null;
      }
    } catch (e) {
      console.error("[mpv] sub-add failed:", e);
    }
    return null;
  }, [setState]);

  const stop = useCallback(async () => {
    const api = getMpvApi();
    if (api) {
      const p = api.destroy().catch(() => {});
      setPendingDestroy(p);
      await p;
    }
  }, []);

  return {
    togglePause, setPause, seek, seekRelative,
    setAudioTrack, setSubtitleTrack, addSubtitle,
    setVolume, setSpeed, toggleMute, toggleFullscreen, stop,
  };
}
