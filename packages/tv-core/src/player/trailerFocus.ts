import type { Direction } from "../remote/intents";
import { panelReturnTarget } from "./playerFocus";
import { TRAILER_CLOSE_KEY, type TrailerState } from "./trailerChrome";
import type { TrailerPanel, TrailerTools } from "./trailerPanels";

/**
 * Le FOCUS de la bande-annonce (lecteur simplifié), en règles pures. Quatre
 * cibles, sur trois étages :
 *
 * ```
 *  [×]                                   ← trailer:close (haut, à gauche)
 *
 *                     [Sous-titres] [Qualité]   ← trailer:subtitles, trailer:quality
 *  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ← trailer:timeline (la barre)
 * ```
 *
 * - Le PREMIER focus : la croix pendant le chargement, ou quand rien d'autre
 *   n'est à cibler (« indisponible ») ; sinon le premier élément hors croix —
 *   le premier bouton (sous-titres, sinon qualité), sinon la barre ; la barre
 *   quand le chrome est estompé (choix de Damien, 2026-10-11). La croix reste
 *   atteignable. La lecture qui commence RÉCLAME cette entrée
 *   (`trailerStartClaim`) : la croix du chargement garderait sinon un focus
 *   valable. Sur la barre, ←/→ avancent et reculent (`trailerControls.ts`),
 *   OK met en pause.
 * - Chrome estompé, seule la barre reste focalisable — le focus y revient
 *   (`trailerFocusClaim`) : à la réapparition, le premier OK montre, le
 *   second met en pause (la règle « OK puis OK » du grand lecteur, la même
 *   sur les deux plateformes, `osdReveal.ts`).
 * - Les boutons n'existent que si `trailerTools` les rend (capacité
 *   `trailers.player`, quelque chose à choisir).
 * - Un panneau ouvert retient le focus (feuille) ; refermé, il le rend au
 *   bouton qui l'a ouvert.
 *
 * La plateforme pose les préférences, les voisins (`trailerNeighbor`) et
 * l'infocalisable ; elle RÉCLAME l'entrée à chaque changement de
 * `trailerEntryKey`.
 */

export const TRAILER_TIMELINE_KEY = "trailer:timeline";
export const TRAILER_SUBTITLES_KEY = "trailer:subtitles";
export const TRAILER_QUALITY_KEY = "trailer:quality";

export type TrailerTargetKey =
  | typeof TRAILER_CLOSE_KEY
  | typeof TRAILER_SUBTITLES_KEY
  | typeof TRAILER_QUALITY_KEY
  | typeof TRAILER_TIMELINE_KEY;

/** Ce que les règles du focus regardent de l'écran. */
export interface TrailerFocusView {
  state: TrailerState;
  tools: TrailerTools;
  /** Le chrome est à l'écran (`trailerChromeShown`). */
  chromeShown: boolean;
  /** Le panneau ouvert, s'il y en a un. */
  panel: TrailerPanel | null;
}

/** Le bouton qui ouvre chaque panneau — celui à qui le focus revient. */
export const TRAILER_PANEL_OPENERS: Readonly<Record<TrailerPanel, TrailerTargetKey>> = {
  subtitles: TRAILER_SUBTITLES_KEY,
  quality: TRAILER_QUALITY_KEY,
};

/** Les boutons présents, dans l'ordre de lecture (gauche → droite). */
export function trailerToolKeys(tools: TrailerTools): TrailerTargetKey[] {
  const keys: TrailerTargetKey[] = [];
  if (tools.subtitles) keys.push(TRAILER_SUBTITLES_KEY);
  if (tools.quality) keys.push(TRAILER_QUALITY_KEY);
  return keys;
}

/** Les cibles montées, dans l'ordre de lecture : la croix, les boutons, la barre. */
export function trailerTargets(view: Pick<TrailerFocusView, "state" | "tools">): TrailerTargetKey[] {
  if (view.state !== "playing") return [TRAILER_CLOSE_KEY];
  return [TRAILER_CLOSE_KEY, ...trailerToolKeys(view.tools), TRAILER_TIMELINE_KEY];
}

/**
 * L'entrée : hors lecture, la croix (rien d'autre à cibler) ; en lecture, le
 * premier élément hors croix — le premier bouton, sinon la barre ; la barre
 * quand le chrome est estompé.
 */
export function trailerEntryKey(view: Pick<TrailerFocusView, "state" | "tools" | "chromeShown">): TrailerTargetKey {
  if (view.state !== "playing") return TRAILER_CLOSE_KEY;
  if (!view.chromeShown) return TRAILER_TIMELINE_KEY;
  return trailerToolKeys(view.tools)[0] ?? TRAILER_TIMELINE_KEY;
}

/**
 * La lecture COMMENCE (l'état précédent n'était pas la lecture) : l'entrée se
 * réclame, même si la croix du chargement garde un focus valable. Sinon,
 * `null`. Panneau ouvert : la feuille a la main.
 */
export function trailerStartClaim(previous: TrailerState | null, view: TrailerFocusView): TrailerTargetKey | null {
  if (previous === "playing" || view.state !== "playing" || view.panel !== null) return null;
  return trailerEntryKey(view);
}

/**
 * Une cible peut-elle prendre le focus ? Montée, aucun panneau ouvert, et —
 * chrome estompé pendant la lecture — la barre seule (ce qu'on ne voit pas
 * ne se focalise pas).
 */
export function trailerFocusable(key: string, view: TrailerFocusView): boolean {
  if (view.panel !== null) return false;
  if (!(trailerTargets(view) as string[]).includes(key)) return false;
  if (view.state === "playing" && !view.chromeShown) return key === TRAILER_TIMELINE_KEY;
  return true;
}

/**
 * La cible à RÉCLAMER, ou `null` : le focus est hors des cibles focalisables
 * (bouton disparu, chrome estompé sur la croix, rien encore) → l'entrée.
 * Panneau ouvert : la feuille a la main.
 */
export function trailerFocusClaim(view: TrailerFocusView, focusedKey: string | null): TrailerTargetKey | null {
  if (view.panel !== null) return null;
  if (focusedKey !== null && trailerFocusable(focusedKey, view)) return null;
  return trailerEntryKey(view);
}

/** Où va le focus quand un panneau se referme : son bouton, si le chrome est là. */
export function trailerPanelReturnKey(panel: TrailerPanel, chromeShown: boolean): string | null {
  return panelReturnTarget(TRAILER_PANEL_OPENERS[panel], chromeShown);
}

/** Un voisin : une cible, ou rester (le focus ne bouge pas — la barre garde ←/→ pour la vidéo). */
export type TrailerNeighbor = TrailerTargetKey | "stay";

/**
 * Le voisin d'une cible dans une direction. Rien d'aligné entre les étages :
 * ce sont des ponts, pas la géométrie. HAUT depuis la barre retrouve le
 * dernier bouton visité (`lastTool`), sinon le premier, sinon la croix ; BAS
 * depuis la croix, le premier bouton, sinon la barre. Une cible infocalisable
 * (chrome estompé, panneau) n'est jamais un voisin : on reste.
 */
export function trailerNeighbor(
  key: string,
  direction: Direction,
  view: TrailerFocusView,
  lastTool: string | null = null,
): TrailerNeighbor {
  const tools = trailerToolKeys(view.tools);
  const pick = (target: TrailerTargetKey | undefined): TrailerNeighbor =>
    target !== undefined && trailerFocusable(target, view) ? target : "stay";
  const index = tools.indexOf(key as TrailerTargetKey);
  switch (key) {
    case TRAILER_CLOSE_KEY:
      return direction === "bas" ? pick(tools[0] ?? TRAILER_TIMELINE_KEY) : "stay";
    case TRAILER_TIMELINE_KEY: {
      if (direction !== "haut") return "stay";
      const remembered = tools.find((t) => t === lastTool);
      return pick(remembered ?? tools[0] ?? TRAILER_CLOSE_KEY);
    }
    default:
      if (index < 0) return "stay";
      if (direction === "haut") return pick(TRAILER_CLOSE_KEY);
      if (direction === "bas") return pick(TRAILER_TIMELINE_KEY);
      return pick(tools[index + (direction === "droite" ? 1 : -1)]);
  }
}
