/**
 * La visée d'écran par la MESURE de la page — la seule qui dise vrai sur Wayland.
 *
 * # Pourquoi mesurer, plutôt que demander à Electron
 *
 * Sur Wayland, `getBounds()` rend (0,0) pour TOUTE fenêtre — le protocole ne
 * donne pas la position. `getDisplayMatching()` désigne donc toujours l'écran
 * posé à l'origine, et la visée qui s'y fiait envoyait mpv sur le mauvais
 * moniteur (mesuré, docs/LINUX-FENETRE-VIDEO.md, « L'empilement multi-écrans »).
 *
 * Le trio `innerWidth` / `innerHeight` / `devicePixelRatio` d'une fenêtre
 * PLEIN ÉCRAN, lui, est celui de son moniteur : la taille logique et la densité
 * suffisent à le reconnaître — sur le poste de mesure, deux écrans partagent la
 * même taille logique et seule la densité les sépare.
 *
 * # Pourquoi la garde « plein écran », et pourquoi une attente
 *
 * Une fenêtre FENÊTRÉE de 1920×1080 posée sur un écran 4K correspondrait à
 * l'écran 1080p d'à côté : identification d'apparence valide, écran faux. Le
 * trio ne dit quelque chose que d'une fenêtre plein écran effectivement mappée
 * — et le compositeur met ~200 ms à la mapper (202-203 ms sur trois runs).
 * D'où `labelOnceMapped` : la mesure se rejoue jusqu'à désigner un écran.
 *
 * Un zoom de page (Ctrl+molette) fausse le trio : plus aucune correspondance,
 * et l'on rend `null` — dans le doute, on ne force rien (cf. `displays.ts`).
 */

import { screen } from "electron";
import { displayForMeasure, type DisplayCandidate, type PageMeasure } from "./displays";

/** Le strict nécessaire d'une fenêtre — et ce qu'un test sait imiter. */
export interface MeasurableWindow {
  isDestroyed(): boolean;
  isFullScreen(): boolean;
  webContents: {
    executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
  };
}

/** Les écrans d'Electron, réduits à ce que la mesure sait comparer. */
export function shownCandidates(): DisplayCandidate[] {
  return screen.getAllDisplays().map((d) => ({
    label: d.label,
    width: d.size.width,
    height: d.size.height,
    density: d.scaleFactor,
  }));
}

/** Le trio mesuré par la page — ou `null` si elle ne répond pas en nombres. */
export async function pageMeasure(
  page: MeasurableWindow["webContents"],
): Promise<PageMeasure | null> {
  try {
    const raw: unknown = await page.executeJavaScript(
      "[innerWidth, innerHeight, devicePixelRatio]",
      true,
    );
    if (!Array.isArray(raw) || raw.length !== 3) return null;
    const count = (n: unknown): n is number =>
      typeof n === "number" && Number.isFinite(n) && n > 0;
    const [width, height, density] = raw as unknown[];
    if (!count(width) || !count(height) || !count(density)) return null;
    return { width, height, density };
  } catch {
    return null;
  }
}

/**
 * Le libellé de l'écran qui porte la fenêtre, par la mesure de la page.
 * `null` tant que la fenêtre n'est pas en plein écran, si la mesure échoue,
 * ou si elle reste ambiguë (deux écrans jumeaux).
 */
export async function labelByMeasure(
  host: MeasurableWindow,
  candidates: readonly DisplayCandidate[],
): Promise<string | null> {
  if (host.isDestroyed() || !host.isFullScreen()) return null;
  const measure = await pageMeasure(host.webContents);
  return measure ? displayForMeasure(measure, candidates) : null;
}

/** Ce que `labelOnceMapped` accepte de régler. */
export interface MappingWait {
  /** Nombre de mesures avant d'abandonner (défaut 20, soit ~2 s). */
  tries?: number;
  /** Pas entre deux mesures, en millisecondes (défaut 100). */
  stepMs?: number;
  /** Rend `false` pour couper une attente devenue sans objet (détachement). */
  still?: () => boolean;
  /** Écrans candidats — recalculés à chaque pas si absent (un écran peut arriver). */
  candidates?: readonly DisplayCandidate[];
}

/**
 * Attend que la mesure désigne un écran — la fenêtre vient d'être mise en
 * plein écran et le compositeur ne l'a pas encore mappée. `null` après
 * épuisement : fenêtre jamais mappée, trio jamais reconnu, ou attente coupée.
 */
export async function labelOnceMapped(
  host: MeasurableWindow,
  settings: MappingWait = {},
): Promise<string | null> {
  const { tries = 20, stepMs = 100, still = () => true } = settings;
  for (let i = 0; i < tries; i++) {
    if (!still() || host.isDestroyed()) return null;
    const label = await labelByMeasure(host, settings.candidates ?? shownCandidates());
    if (label !== null) return label;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return null;
}
