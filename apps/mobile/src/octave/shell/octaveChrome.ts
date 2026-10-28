/**
 * Octave (mobile) — ce que la COQUILLE occupe autour des pages : la barre
 * d'onglets flottante (téléphone) ou la barre latérale (tablette), et le
 * mini-lecteur mesuré. Les pages lisent `useOctaveChrome()` (ou les primitives
 * de `layout/`) pour s'écarter d'autant : rien n'est caché sous une barre fixe.
 */

import { createContext, useContext } from "react";

export interface OctaveChrome {
  layout: "phone" | "tablet";
  /** Largeur de la barre latérale (0 sur téléphone). */
  sidebarWidth: number;
  /** Hauteur de la barre d'onglets flottante, zone sûre comprise (0 sur tablette). */
  tabBarHeight: number;
  /** Hauteur du mini-lecteur mesurée (0 tant qu'il ne se montre pas). */
  miniPlayerHeight: number;
  /** Ce qu'une page laisse en bas de son défilement : barre + mini-lecteur + respiration. */
  bottomInset: number;
}

export const DEFAULT_OCTAVE_CHROME: OctaveChrome = { layout: "phone", sidebarWidth: 0, tabBarHeight: 0, miniPlayerHeight: 0, bottomInset: 24 };

export const OctaveChromeContext = createContext<OctaveChrome>(DEFAULT_OCTAVE_CHROME);

export function useOctaveChrome(): OctaveChrome {
  return useContext(OctaveChromeContext);
}

/** Largeur de la barre latérale sur tablette. */
export const OCTAVE_SIDEBAR_WIDTH = 248;
/** Écart entre le mini-lecteur et ce qui est dessous. */
export const OCTAVE_MINI_GAP = 8;
