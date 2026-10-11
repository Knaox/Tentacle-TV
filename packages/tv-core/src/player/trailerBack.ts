import type { BackLayerSpec } from "../nav/backResolve";
import { playerBackHolding } from "./playerBack";
import type { TrailerState } from "./trailerChrome";
import type { TrailerPanel } from "./trailerPanels";

/**
 * Le RETOUR de la bande-annonce, en couches — celles du grand lecteur
 * (`playerBackLayers`), réduites à ce que l'écran a :
 *
 * - menu : un état passager — défilement ouvert : annulé, on revient où
 *   l'on était ; grâce d'un Retour déjà pris : avalé (`createPlayerBack`,
 *   routé tel quel) ; puis le panneau ouvert (sous-titres, qualité) : fermé,
 *   la lecture continue, le focus revient à son bouton ;
 * - surimpression : le chrome À L'ÉCRAN pendant la lecture se masque (en
 *   pause : désépinglé, `isOsdPinned`) — comme le grand lecteur ; un second
 *   Retour quitte ;
 * - page : rien d'affiché, ou rien à lire (chargement, « indisponible ») —
 *   Retour quitte, comme la croix.
 */

export type TrailerBackAction = "routeTransient" | "closePanel" | "hideChrome" | "leave";

export function trailerBackLayers(state: {
  trailer: TrailerState;
  scrubbing: boolean;
  graceActive: boolean;
  panel: TrailerPanel | null;
  /** Le chrome à l'écran (`trailerChromeShown`). */
  chromeShown: boolean;
}): BackLayerSpec<TrailerBackAction>[] {
  const transient = playerBackHolding({
    scrubbing: state.scrubbing, surfaceActive: false, skipRefusable: false, graceActive: state.graceActive,
  });
  return [
    { id: "transient", kind: "menu", active: transient, action: "routeTransient" },
    { id: "panel", kind: "menu", active: state.panel !== null, action: "closePanel" },
    { id: "chrome", kind: "overlay", active: state.trailer === "playing" && state.chromeShown, action: "hideChrome" },
    { id: "page", kind: "page", active: true, action: "leave" },
  ];
}

/** Ce que `createPlayerBack` regarde d'une surface : la bande-annonce n'en a aucune. */
export const TRAILER_NO_SURFACE = { kind: "none" } as const;
