/**
 * Ce que le lecteur sait du PiP, et ce qu'il peut lui demander.
 *
 * Fourni par `PlayerStage`, qui garde le lecteur monté hors des routes. Hors de
 * lui — une coquille sans PiP, le navigateur —, la valeur par défaut dit « ni
 * possible ni actif » et ne fait rien : le lecteur se comporte comme avant.
 */

import { createContext, useCallback, useContext } from "react";
import { useNavigate, type NavigateOptions } from "react-router-dom";
import type { PipMode } from "./pictureInPictureStore";
import type { PipFrame } from "./pipGeometry";

/**
 * Un geste sur la fenêtre PiP — la glisser, tirer un coin —, que la colle KWin
 * (Linux) ou la coquille (macOS) exécute en suivant le curseur
 * (`pip/pipCaptions.ts`, `pip/pipShell.ts` côté coquille).
 */
export type PipGesture = "move" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface PictureInPicture {
  /** Le PiP existe dans cette coquille (Linux et sa colle KWin, macOS Apple Silicon). */
  supported: boolean;
  /** Le lecteur joue dans le PiP : la page parcourt l'application. */
  active: boolean;
  mode: PipMode;
  /** Où le lecteur rend les contrôles du PiP (portail) — null tant que la fenêtre n'est pas ouverte. */
  container: HTMLElement | null;
  /** Le cadre à dessiner autour de la vidéo, tel que la coquille l'a posé. */
  frame: PipFrame;
  /** Réduit la lecture dans le PiP et rend la page d'où l'on venait. */
  reduce: (options: { restoreFullscreen: boolean }) => void;
  /** Revient au lecteur, plein écran rendu s'il l'était. */
  expand: () => void;
  /** Arrête la lecture et ferme le PiP. */
  close: () => void;
  setMode: (mode: PipMode) => void;
  /** Un cran de taille (molette) : > 1 agrandit. */
  resizeBy: (factor: number) => void;
  /**
   * Le geste commence (bouton enfoncé, déjà bougé) ou finit (`null`). Glisser
   * donne le point saisi, depuis le coin haut-gauche de la fenêtre PiP.
   */
  gesture: (gesture: PipGesture | null, grab?: { x: number; y: number }) => void;
  /**
   * Une navigation demandée par le lecteur pendant le PiP : un autre épisode y
   * reste, tout le reste le ferme — la page parcourue n'est jamais touchée.
   * (Une lecture lancée par l'APPLICATION pendant le PiP s'y joue aussi :
   * `PlayerStage`.)
   */
  navigateInPip: (to: string | -1, options?: NavigateOptions) => void;
}

const nothing = (): void => undefined;

const OUTSIDE: PictureInPicture = {
  supported: false,
  active: false,
  mode: "floating",
  container: null,
  frame: { shadow: 0, bezel: 0 },
  reduce: nothing,
  expand: nothing,
  close: nothing,
  setMode: nothing,
  resizeBy: nothing,
  gesture: nothing,
  navigateInPip: nothing,
};

export const PictureInPictureContext = createContext<PictureInPicture>(OUTSIDE);

export function usePictureInPicture(): PictureInPicture {
  return useContext(PictureInPictureContext);
}

/**
 * La navigation du lecteur : ordinaire, sauf pendant le PiP, où elle ne quitte
 * jamais la page que l'utilisateur parcourt (`navigateInPip`).
 */
export function usePlayerNavigate(): (to: string | -1, options?: NavigateOptions) => void {
  const navigate = useNavigate();
  const pip = usePictureInPicture();
  return useCallback(
    (to: string | -1, options?: NavigateOptions) => {
      if (pip.active) {
        pip.navigateInPip(to, options);
        return;
      }
      if (to === -1) void navigate(-1);
      else void navigate(to, options);
    },
    [navigate, pip],
  );
}
