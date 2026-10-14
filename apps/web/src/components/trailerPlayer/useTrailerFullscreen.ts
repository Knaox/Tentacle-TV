/**
 * Le plein écran du lecteur des bandes-annonces, et l'écran gardé allumé.
 *
 * Le lecteur occupe déjà toute la FENÊTRE ; le vrai plein écran se demande
 * (F, double-clic, le bouton).
 *
 * - Bureau : `requestFullscreen` du HTML est refusé par la coquille (elle
 *   refuse toute permission web, `security.ts`) : la FENÊTRE passe en plein
 *   écran par l'IPC du lecteur (`player_fullscreen_enter` ouvre la session et
 *   dit l'état, `toggle_fullscreen` bascule, `window://fullscreen` le suit).
 *   En sortant, `player_fullscreen_leave` rend la fenêtre comme avant sous
 *   Windows, maximisée sous Linux ; macOS ne défait rien pour un film — pour
 *   une bande-annonce, si : un plein écran posé PENDANT elle est défait.
 * - Web : l'API Fullscreen sur la scène du lecteur.
 *
 * Bureau seulement : l'écran reste allumé pendant la lecture
 * (`prevent_display_sleep_start` / `_stop`), comme pour un film.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { desktopPlatform, invoke, isElectronShell, listen } from "../../desktop/bridge";

export function useTrailerFullscreen(stageRef: RefObject<HTMLElement | null>, playing: boolean) {
  const desktop = isElectronShell();
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenRef = useRef(false);
  fullscreenRef.current = fullscreen;
  /** La fenêtre était-elle en plein écran à l'ouverture du lecteur ? */
  const atOpen = useRef<boolean | null>(null);

  useEffect(() => {
    if (!desktop) {
      const onChange = () => setFullscreen(document.fullscreenElement !== null);
      document.addEventListener("fullscreenchange", onChange);
      return () => {
        document.removeEventListener("fullscreenchange", onChange);
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      };
    }
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const fs = await invoke<boolean>("player_fullscreen_enter");
        atOpen.current = fs;
        if (!cancelled) setFullscreen(fs);
      } catch { /* commande indisponible : fenêtré */ }
      try {
        const un = await listen<boolean>("window://fullscreen", (e) => {
          if (!cancelled) setFullscreen(e.payload);
        });
        if (cancelled) un();
        else unlisten = un;
      } catch { /* évènement indisponible */ }
    })();
    return () => {
      cancelled = true;
      unlisten?.();
      const enteredHere = atOpen.current === false && fullscreenRef.current;
      void invoke("player_fullscreen_leave")
        .then(() => {
          // macOS laisse la fenêtre comme elle est : le plein écran de la bande-annonce se défait ici.
          if (enteredHere && desktopPlatform() === "macos") return invoke("toggle_fullscreen");
          return undefined;
        })
        .catch(() => undefined);
    };
  }, [desktop]);

  // L'écran reste allumé pendant la lecture (bureau) ; toujours rendu en sortant.
  useEffect(() => {
    if (!desktop) return;
    void invoke(playing ? "prevent_display_sleep_start" : "prevent_display_sleep_stop").catch(() => undefined);
  }, [desktop, playing]);
  useEffect(() => () => {
    if (desktop) void invoke("prevent_display_sleep_stop").catch(() => undefined);
  }, [desktop]);

  const toggleFullscreen = useCallback(() => {
    if (desktop) {
      void invoke("toggle_fullscreen").catch(() => undefined);
      return;
    }
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void stageRef.current?.requestFullscreen?.().catch(() => undefined);
  }, [desktop, stageRef]);

  return { fullscreen, fullscreenRef, toggleFullscreen };
}
