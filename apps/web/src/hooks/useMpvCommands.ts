import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { getMpvApi, isLinux, isMacOS, isTauri, setPendingDestroy, type MpvState } from "./mpvRuntime";
import { queryTrackList } from "./mpvTrackList";
import { noterAid, noterSid } from "./mpvTrackIntent";
import { tracerCommande } from "./startupTrace";
import { invoke, isElectronShell, listen } from "../desktop/bridge";

/**
 * Commandes de contrôle mpv (pause/seek/pistes/volume/vitesse/plein écran) +
 * effets annexes (anti-veille macOS/Linux, resync plein écran au montage).
 * Extraction mécanique de useDesktopPlayer — logique inchangée.
 */

// Aucun de nos shells ne peut compter sur le `stop-screensaver` de mpv.
//
// macOS et Linux : Render API (vo=libmpv) → mpv n'a AUCUNE fenêtre native, son
// `stop-screensaver` n'a rien à quoi s'accrocher. On gère l'anti-veille
// nous-mêmes côté Rust : IOPMAssertion sur macOS (macos/sleep_assertion.rs),
// inhibiteurs D-Bus ScreenSaver/SessionManager/PowerManagement + logind sur
// Linux (linux/sleep_inhibit.rs).
//
// Windows : mpv a bien sa fenêtre (--wid), mais c'est une fenêtre ENFANT, et le
// système n'envoie SC_SCREENSAVE/SC_MONITORPOWER qu'à la fenêtre de premier
// plan. La coquille Electron pose donc un powerSaveBlocker (main/powerSave.ts).
function needsKeepAwake(): boolean {
  return isElectronShell() || (isTauri() && (isMacOS() || isLinux()));
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
    const cmd = shouldKeepAwake ? "prevent_display_sleep_start" : "prevent_display_sleep_stop";
    void invoke(cmd).catch((e) => {
      if (!cancelled) console.warn(`[mpv] ${cmd} failed:`, e);
    });
    return () => { cancelled = true; };
  }, [state.playing, state.paused]);

  // Filet de sécurité : libère toujours l'assertion au démontage du player,
  // même si l'effet ci-dessus n'a pas eu le temps de se déclencher.
  useEffect(() => {
    return () => {
      if (!needsKeepAwake()) return;
      void invoke("prevent_display_sleep_stop").catch(() => {});
    };
  }, []);

  const togglePause = useCallback(async () => { getMpvApi()?.command("cycle", ["pause"]).catch(() => {}); }, []);
  const setPause = useCallback(async (paused: boolean) => { getMpvApi()?.setProperty("pause", paused).catch(() => {}); }, []);
  const seek = useCallback(async (pos: number) => {
    tracerCommande("seek absolu", `${pos.toFixed(1)} s`);
    getMpvApi()?.command("seek", [pos, "absolute"]).catch(() => {});
  }, []);
  const seekRelative = useCallback(async (off: number) => {
    tracerCommande("seek relatif", `${off > 0 ? "+" : ""}${off} s`);
    getMpvApi()?.command("seek", [off, "relative"]).catch(() => {});
  }, []);
  const setAudioTrack = useCallback(async (id: number) => {
    const api = getMpvApi();
    if (!api) return;
    console.debug("[mpv] setAudioTrack", id);
    tracerCommande("set aid", String(id));
    // Use command("set") with string value — setProperty("aid", number)
    // fails because the plugin sends MPV_FORMAT_DOUBLE but mpv expects MPV_FORMAT_INT64.
    //
    // ⚠️ AUCUNE garde ici : c'est le chemin du choix explicite de l'utilisateur
    // (handleAudioChange). Filtrer à cet endroit avalerait une sélection
    // légitime — l'erreur exacte qui avait valu son revert à 7dd496ce. La
    // déduplication vit dans les effets de PRÉFÉRENCE, pas ici.
    try { await api.command("set", ["aid", String(id)]); noterAid(id); }
    catch (e) { console.error("[mpv] setAudioTrack failed:", e); }
  }, []);
  const setSubtitleTrack = useCallback(async (id: number) => {
    const api = getMpvApi();
    if (!api) return;
    console.debug("[mpv] setSubtitleTrack", id);
    tracerCommande("set sid", id === 0 ? "no" : String(id));
    try {
      // `sub-visibility` n'est plus reposé au passage : rien dans l'app ne le
      // met jamais à `no`, son défaut mpv est `yes`, et c'était une commande de
      // plus dans la fenêtre où chacune coûte le cache entier.
      await api.command("set", ["sid", id === 0 ? "no" : String(id)]);
      noterSid(id);
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
      const isFs = await invoke<boolean>("toggle_fullscreen");
      setState((prev) => ({ ...prev, fullscreen: isFs }));
    } catch (e) {
      // Plus de repli `getCurrentWindow().setFullscreen()` : la permission
      // `core:window:allow-set-fullscreen` n'est PAS dans `core:default`
      // (seule `allow-is-fullscreen` l'est), donc ce repli échouait TOUJOURS —
      // et son `catch` vide avalait l'échec. Élargir l'ACL n'en vaut pas la
      // peine pour un chemin mort : la commande Rust est la seule vraie voie.
      console.warn("[mpv] toggle_fullscreen a échoué :", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ouvre la session plein écran du lecteur — le Rust y mémorise si la fenêtre
  // était DÉJÀ en plein écran, pour ne défaire à la sortie que ce que le
  // lecteur a lui-même posé (cf. video_surface.rs) — et renvoie l'état courant,
  // qui amorce le state React. Indispensable au changement d'épisode : le
  // lecteur est remonté (key={itemId}) alors que la fenêtre, elle, reste en
  // plein écran.
  //
  // Puis RESTE à l'écoute : un plein écran déclenché hors de l'application
  // (bouton vert, Ctrl+Cmd+F, Mission Control) n'était jusqu'ici jamais
  // détecté, ce qui laissait l'icône du bouton, la touche Échap et les gardes
  // de sortie en désaccord avec la fenêtre réelle.
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const fs = await invoke<boolean>("player_fullscreen_enter");
        if (!cancelled) setState((prev) => ({ ...prev, fullscreen: fs }));
      } catch { /* hors Tauri ou commande indisponible */ }
      try {
        const un = await listen<boolean>("window://fullscreen", (e) => {
          if (!cancelled) setState((prev) => ({ ...prev, fullscreen: e.payload }));
        });
        if (cancelled) un();
        else unlisten = un;
      } catch { /* évènement indisponible */ }
    })();
    return () => { cancelled = true; unlisten?.(); };
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
        // Le sid attribué par mpv devient l'intention courante : sans ça,
        // l'effet de préférence — que la relecture de track-list ci-dessus
        // redéclenche — reposait `sid` à chaque tour.
        if (typeof sid === "number") { noterSid(sid); return sid; }
        return null;
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
