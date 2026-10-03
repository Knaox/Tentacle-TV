import type { BackLayerSpec } from "../nav/backResolve";
import type { PlayerTimers } from "./playerTimers";

/** Fenêtre de grâce après chaque Retour consommé par un état passager : un
 *  double appui (ou un appui pendant le fondu de fermeture) est AVALÉ au lieu
 *  de quitter. */
export const BACK_GRACE_MS = 600;

/** Ce que Retour regarde d'une surface du lecteur (l'arbitre partagé). */
export interface PlayerBackSurface {
  kind: string;
  auto?: boolean;
  dismissible?: boolean;
}

/** Ce que le Retour du lecteur prend, dans l'ordre. */
export type PlayerBackStep = "swallow" | "cancelScrub" | "dismissSurface" | "dismissSegment";

/**
 * Le Retour du lecteur, ÉTATS PASSAGERS d'abord — pur : `null`, rien à
 * prendre, le Retour suit son cours (masquer l'habillage, quitter la lecture).
 *
 * - dans la grâce d'un Retour déjà pris : avalé ;
 * - défilement ouvert : annulé (« revient où l'on était ») ;
 * - carte « À suivre » ou affiche de fin : refusée ;
 * - passage AUTOMATIQUE encore refusable : mis en sourdine — le geste du
 *   bouton « Masquer », le même sur Apple TV et Android TV. Un passage qu'il
 *   faut demander n'est qu'une proposition : Retour y reste le Retour.
 */
export function decidePlayerBack(state: {
  now: number;
  graceUntil: number;
  scrubbing: boolean;
  surface: PlayerBackSurface;
}): PlayerBackStep | null {
  if (state.now < state.graceUntil) return "swallow";
  if (state.scrubbing) return "cancelScrub";
  if (state.surface.kind === "nextCard") return "dismissSurface";
  const { surface } = state;
  if (surface.kind === "skip" && surface.auto && surface.dismissible) return "dismissSegment";
  return null;
}

/** Ce que `routeBack` prendrait au prochain Retour — dit d'AVANCE (la couche
 *  passagère du Retour est active, Android retient le bouton système). */
export function playerBackHolding(state: {
  scrubbing: boolean;
  surfaceActive: boolean;
  skipRefusable: boolean;
  graceActive: boolean;
}): boolean {
  return state.scrubbing || state.surfaceActive || state.skipRefusable || state.graceActive;
}

export interface PlayerBackHost {
  isScrubbing: () => boolean;
  readSurface: () => PlayerBackSurface;
  cancelScrub: () => void;
  /** Ferme la surface ; vrai si un départ (navigation) est engagé — la grâce
   *  n'est alors PAS armée (elle bloquerait le départ). */
  dismissSurface: () => boolean;
  dismissSegment: () => void;
  onGrace: (active: boolean) => void;
}

/** Le routage du Retour du lecteur, avec sa grâce. Module pur, minuteurs injectés. */
export function createPlayerBack(host: PlayerBackHost, timers: PlayerTimers): {
  /** Consomme un Retour : vrai = absorbé, faux = rien de passager. */
  routeBack: () => boolean;
  destroy: () => void;
} {
  let graceUntil = 0;
  let timer: unknown = null;
  const clear = () => {
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
  };
  const armGrace = () => {
    graceUntil = timers.now() + BACK_GRACE_MS;
    host.onGrace(true);
    clear();
    timer = timers.setTimeout(() => {
      timer = null;
      host.onGrace(false);
    }, BACK_GRACE_MS);
  };
  return {
    routeBack() {
      const step = decidePlayerBack({
        now: timers.now(), graceUntil, scrubbing: host.isScrubbing(), surface: host.readSurface(),
      });
      switch (step) {
        case "swallow":
          return true;
        case "cancelScrub":
          host.cancelScrub();
          armGrace();
          return true;
        case "dismissSurface":
          if (!host.dismissSurface()) armGrace();
          return true;
        case "dismissSegment":
          host.dismissSegment();
          armGrace();
          return true;
        default:
          return false;
      }
    },
    destroy: clear,
  };
}

/** Les gestes des couches du Retour du lecteur. */
export type PlayerBackAction = "routeTransient" | "closeSettings" | "closeEpisodes" | "hideOverlay" | "leave";

/**
 * Les COUCHES du Retour du lecteur (Apple TV), dans l'ordre d'inscription
 * (`nav/backResolve` : menu > surimpression > page, la dernière activée
 * d'abord à rang égal) :
 *
 * - menu : un état passager (`playerBackHolding`), la feuille des pistes et
 *   des réglages, le panneau des épisodes — Retour ferme le menu, la lecture
 *   continue ;
 * - surimpression : l'habillage À L'ÉCRAN se masque (en pause : désépinglé),
 *   la lecture continue ;
 * - page : rien d'affiché — Retour quitte la lecture, comme la croix.
 */
export function playerBackLayers(state: {
  transient: boolean;
  showSettings: boolean;
  showEpisodes: boolean;
  osdShown: boolean;
}): BackLayerSpec<PlayerBackAction>[] {
  return [
    { id: "transient", kind: "menu", active: state.transient, action: "routeTransient" },
    { id: "settings", kind: "menu", active: state.showSettings, action: "closeSettings" },
    { id: "episodes", kind: "menu", active: state.showEpisodes, action: "closeEpisodes" },
    { id: "overlay", kind: "overlay", active: state.osdShown, action: "hideOverlay" },
    { id: "page", kind: "page", active: true, action: "leave" },
  ];
}

/** L'habillage reste ÉPINGLÉ par la pause, tant que Retour ne l'a pas masqué
 *  (`unpinned`) ; il se réépingle quand il reparaît ou que la pause change. */
export function isOsdPinned(paused: boolean, unpinned: boolean): boolean {
  return paused && !unpinned;
}
