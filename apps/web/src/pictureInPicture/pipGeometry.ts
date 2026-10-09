/**
 * La taille du PiP — règles pures, sans fenêtre ni mpv.
 *
 * Electron ne donne aucune marge de redimensionnement à une fenêtre
 * transparente sans cadre sous Linux (banc du 09.10.2026) : la taille change
 * à la molette, par crans, le ratio de l'image gardé, et la colle KWin garde
 * fixe le coin le plus proche du bord de l'écran.
 */

import type { PipMode } from "./pictureInPictureStore";

export interface PipSize {
  width: number;
  height: number;
}

/** En deçà, les boutons ne tiennent plus — la coquille borne aussi (`pip/pipWindow.ts`). */
export const PIP_MIN_WIDTH = 256;
export const PIP_MIN_HEIGHT = 144;

/** Un cran de molette. */
export const PIP_WHEEL_STEP = 1.1;

/** Le ratio de l'image, ramené à ce qu'un PiP peut montrer — 16:9 sans réponse de mpv. */
export function pipAspect(raw: number | null | undefined): number {
  if (raw === null || raw === undefined || !Number.isFinite(raw) || raw <= 0) return 16 / 9;
  return Math.min(Math.max(raw, 0.5), 3);
}

/** Au plus 60 % de l'écran flottant, 45 % de la fenêtre ancré. */
function maxWidth(mode: PipMode, screenWidth: number, windowWidth: number): number {
  return Math.max(PIP_MIN_WIDTH, mode === "docked" ? windowWidth * 0.45 : screenWidth * 0.6);
}

function fit(width: number, aspect: number, max: number): PipSize {
  let w = Math.round(Math.min(Math.max(width, PIP_MIN_WIDTH), max));
  let h = Math.round(w / aspect);
  if (h < PIP_MIN_HEIGHT) {
    h = PIP_MIN_HEIGHT;
    w = Math.round(h * aspect);
  }
  return { width: w, height: h };
}

/**
 * La taille de départ. Flottant : la dernière largeur choisie, sinon le quart
 * de l'écran — les bornes du PiP natif de KDE — entre 320 et 640 points.
 * Ancré : 28 % de la fenêtre de l'application, 320 points au moins.
 */
export function initialPipSize(
  mode: PipMode,
  aspect: number,
  screenWidth: number,
  windowWidth: number,
  rememberedWidth: number | null,
): PipSize {
  const base =
    mode === "docked"
      ? Math.max(320, windowWidth * 0.28)
      : rememberedWidth ?? Math.min(Math.max(screenWidth * 0.25, 320), 640);
  return fit(base, aspect, maxWidth(mode, screenWidth, windowWidth));
}

/** Un cran de molette (`factor` > 1 agrandit), le ratio gardé. */
export function scalePipSize(
  current: PipSize,
  factor: number,
  aspect: number,
  mode: PipMode,
  screenWidth: number,
  windowWidth: number,
): PipSize {
  return fit(current.width * factor, aspect, maxWidth(mode, screenWidth, windowWidth));
}

/** La largeur choisie à la molette, reprise au prochain PiP flottant. */
const WIDTH_KEY = "tentacle_pip_width";

export function rememberedPipWidth(): number | null {
  try {
    const raw = Number(localStorage.getItem(WIDTH_KEY));
    return Number.isFinite(raw) && raw >= PIP_MIN_WIDTH ? raw : null;
  } catch {
    return null;
  }
}

export function rememberPipWidth(width: number): void {
  try {
    localStorage.setItem(WIDTH_KEY, String(Math.round(width)));
  } catch {
    /* stockage indisponible : la taille par défaut reviendra */
  }
}
