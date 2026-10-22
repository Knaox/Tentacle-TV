/**
 * Le bouton plein écran du lecteur bureau, là où le plein écran est IMPOSÉ —
 * Linux, Wayland sans colle KWin (GNOME, wlroots) avec un écran HDR branché
 * (sans écran HDR, `auto` y prend XWayland et le bouton marche).
 *
 * La coquille y épingle le plein écran tant que mpv est attaché
 * (`surfaceWayland.ts`) : « sortir » ne pouvait qu'échouer, en un éclair. Le
 * bouton, F et le double-clic ouvrent donc un choix honnête — passer en X11
 * (lecture fenêtrée, sans HDR) et relancer, ou rester —, et Échap quitte le
 * lecteur au lieu de buter sur un plein écran qui ne se quitte pas.
 */

import { useCallback, useState } from "react";
import { invoke, relaunch } from "../desktop/bridge";
import { fenetrageLinux, montageLinux } from "../desktop/detect";

export interface ForcedFullscreen {
  /** Le plein écran est-il imposé dans cette session ? Figé au démarrage. */
  forced: boolean;
  /** Remplace la bascule du lecteur : en mode imposé, ouvre le choix. */
  toggle: () => void;
  promptOpen: boolean;
  closePrompt: () => void;
  switchToX11: () => void;
}

export function forcedFullscreenSession(): boolean {
  return montageLinux() === "wayland" && fenetrageLinux() === "plein-ecran";
}

export function useForcedFullscreen(toggleWindowFullscreen: () => void): ForcedFullscreen {
  const forced = forcedFullscreenSession();
  const [promptOpen, setPromptOpen] = useState(false);
  const toggle = useCallback(() => {
    if (forced) setPromptOpen((open) => !open);
    else toggleWindowFullscreen();
  }, [forced, toggleWindowFullscreen]);
  const closePrompt = useCallback(() => setPromptOpen(false), []);
  const switchToX11 = useCallback(() => {
    void invoke("linux_session_set", { choice: "x11" })
      .then(() => relaunch())
      .catch(() => setPromptOpen(false));
  }, []);
  return { forced, toggle, promptOpen, closePrompt, switchToX11 };
}
