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

export interface PictureInPicture {
  /** Le PiP existe dans cette coquille (Linux, colle KWin). */
  supported: boolean;
  /** Le lecteur joue dans le PiP : la page parcourt l'application. */
  active: boolean;
  mode: PipMode;
  /** Où le lecteur rend les contrôles du PiP (portail) — null tant que la fenêtre n'est pas ouverte. */
  container: HTMLElement | null;
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
   * Une navigation demandée par le lecteur pendant le PiP : un autre épisode y
   * reste, tout le reste le ferme — la page parcourue n'est jamais touchée.
   */
  navigateInPip: (to: string | -1, options?: NavigateOptions) => void;
}

const nothing = (): void => undefined;

const OUTSIDE: PictureInPicture = {
  supported: false,
  active: false,
  mode: "floating",
  container: null,
  reduce: nothing,
  expand: nothing,
  close: nothing,
  setMode: nothing,
  resizeBy: nothing,
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
