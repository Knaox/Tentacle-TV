/**
 * La taille et le cadre du PiP — règles pures, sans fenêtre ni mpv.
 *
 * Electron ne donne aucune marge de redimensionnement à une fenêtre
 * transparente sans cadre sous Linux (banc du 09.10.2026) : la taille change
 * en tirant un coin (geste que la colle KWin exécute, ratio gardé) ou à la
 * molette, par crans — la colle garde alors fixe le coin le plus proche du
 * bord de l'écran. Toutes les tailles sont celles de la VIDÉO : la coquille y
 * ajoute le cadre (`PipFrame`).
 */

import type { PipMode } from "./pictureInPictureStore";

export interface PipSize {
  width: number;
  height: number;
}

/** En deçà, les boutons ne tiennent plus — la coquille borne aussi (`pip/pipWindow.ts`). */
export const PIP_MIN_WIDTH = 256;
export const PIP_MIN_HEIGHT = 144;

/** Un cran de molette de souris (~100 pixels de défilement) : 10 %. */
export const PIP_WHEEL_STEP = 1.1;

/** Un geste de défilement, en pixels (`deltaMode` 1 : des lignes). */
const LINE_PX = 40;

/**
 * Le facteur de taille d'un évènement de molette, PROPORTIONNEL au défilement :
 * un cran de souris vaut 10 %, un pavé tactile — des dizaines de petits pas —
 * agrandit d'un mouvement continu au lieu de sauter de 10 % à chaque pas. Un
 * pincement (Chromium le rend en molette avec Ctrl) va trois fois plus vite.
 */
export function pipWheelFactor(deltaY: number, deltaMode: number, pinch: boolean): number {
  const pixels = deltaMode === 1 ? deltaY * LINE_PX : deltaY;
  const rate = (Math.log(PIP_WHEEL_STEP) / 100) * (pinch ? 3 : 1);
  const factor = Math.exp(-pixels * rate);
  return Math.min(Math.max(factor, 1 / PIP_WHEEL_STEP), PIP_WHEEL_STEP);
}

/**
 * Le cadre que la coquille dessine autour de la vidéo, rendu par `pip_open`
 * (`pip/pipFrame.ts` côté coquille) : un liseré opaque qui recouvre les coins
 * carrés de mpv, et une marge transparente pour l'ombre.
 */
export interface PipFrame {
  shadow: number;
  bezel: number;
}

/** Sans réponse lisible de la coquille : ni ombre ni liseré, la vidéo bord à bord. */
const NO_FRAME: PipFrame = { shadow: 0, bezel: 0 };

export function parsePipFrame(raw: unknown): PipFrame {
  if (typeof raw !== "object" || raw === null) return NO_FRAME;
  const { shadow, bezel } = raw as Record<string, unknown>;
  const valid = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 64;
  return valid(shadow) && valid(bezel) ? { shadow, bezel } : NO_FRAME;
}

/** Le rayon des coins, au-delà duquel le dessin cesse d'être un arrondi. */
const MAX_RADIUS = 16;

/**
 * Les rayons du cadre : extérieur (le liseré) et intérieur (la vidéo). Le plus
 * grand arrondi dont le liseré recouvre encore la pointe du coin carré de mpv —
 * la flèche d'un quart de cercle vaut `r (1 - 1/√2)`, elle ne doit pas
 * dépasser l'épaisseur du liseré.
 */
export function pipFrameRadii(frame: PipFrame): { outer: number; inner: number } {
  const outer = Math.min(MAX_RADIUS, Math.floor(frame.bezel / (1 - Math.SQRT1_2)));
  return { outer, inner: Math.max(0, outer - frame.bezel) };
}

/** La taille de la vidéo dans une fenêtre PiP de cette taille. */
export function pipVideoSize(windowWidth: number, windowHeight: number, frame: PipFrame): PipSize {
  const inset = 2 * (frame.shadow + frame.bezel);
  return { width: Math.max(0, windowWidth - inset), height: Math.max(0, windowHeight - inset) };
}

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
 * La taille de départ : la largeur que l'utilisateur a choisie, dans les deux
 * modes — le PiP est le même, ancré ou détaché (retour de Damien). Sans
 * choix : flottant, le quart de l'écran — les bornes du PiP natif de KDE —
 * entre 320 et 640 points ; ancré, 28 % de la fenêtre, 320 points au moins.
 * Toujours bornée par le mode (`maxWidth`).
 */
export function initialPipSize(
  mode: PipMode,
  aspect: number,
  screenWidth: number,
  windowWidth: number,
  rememberedWidth: number | null,
): PipSize {
  const base =
    rememberedWidth ??
    (mode === "docked" ? Math.max(320, windowWidth * 0.28) : Math.min(Math.max(screenWidth * 0.25, 320), 640));
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

/**
 * La largeur de vidéo que l'utilisateur a choisie — molette, coin tiré, bords
 * du système —, reprise au prochain PiP et quand il change de mode.
 *
 * ⚠️ L'ancienne clé `tentacle_pip_width` n'est plus lue : elle retenait aussi
 * la taille du LECTEUR, celle que le PiP flottant traverse en y revenant
 * (animation de la coquille) — le PiP suivant naissait à 60 % de l'écran.
 * Effacée à la première largeur choisie.
 */
const WIDTH_KEY = "tentacle_pip_video_width";
const LEGACY_WIDTH_KEY = "tentacle_pip_width";

export function rememberedPipWidth(): number | null {
  try {
    const raw = localStorage.getItem(WIDTH_KEY);
    const width = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(width) && width >= PIP_MIN_WIDTH ? width : null;
  } catch {
    return null;
  }
}

export function rememberPipWidth(width: number): void {
  if (!Number.isFinite(width) || width < PIP_MIN_WIDTH) return;
  try {
    localStorage.setItem(WIDTH_KEY, String(Math.round(width)));
    localStorage.removeItem(LEGACY_WIDTH_KEY);
  } catch {
    /* stockage indisponible : la taille par défaut reviendra */
  }
}
