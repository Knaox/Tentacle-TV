import type { RemoteTraits } from "../remote/bindings/types";
import { holdDirection, type Direction, type RemoteIntent } from "../remote/intents";
import type { ScrubDir } from "./arrowHold";
import type { PlayerRemoteHandlers } from "./playerControls";

/**
 * La TABLE « intention → geste du lecteur » : ce que chaque intention de la
 * télécommande déclenche dans les contrôles du lecteur (`playerControls.ts`),
 * et dans quel ordre. Le CONTEXTE (habillage masqué ou affiché, défilement,
 * panneau…) est lu par chaque geste au moment où il s'applique — la table
 * complète, contexte par contexte, est dans `docs/tv-navigation/lecteur.md`
 * et se vérifie dans `playerControls.test.ts`.
 *
 * - `release` : chaque RELÂCHEMENT. Sur une plateforme qui n'annonce un appui
 *   qu'au relâchement (`pressOnRelease`), tout appui en est un ; la fin d'un
 *   maintien aussi, toujours. Il horodate l'appui (le toucher du pavé qui
 *   l'accompagne n'est pas un geste) et clôt un maintien en cours.
 * - Un maintien de ←/→ dont la plateforme ne dit pas la phase (tvOS :
 *   « Changed ») vaut RELÂCHEMENT, comme l'adaptateur d'origine le traitait ;
 *   pour les autres touches, il ne fait rien.
 * - Retour (`retour`) n'est jamais un geste du lecteur : c'est la pile du
 *   Retour (`nav/backLayers`, couches de `playerBack.ts`) qui le sert. Le
 *   glisser (`drag`) a son interprète (`touchScrub.ts`) ; le glisser rapide
 *   (`swipe`) et les pages n'agissent pas.
 */

export type PlayerRemoteStep =
  | { kind: "release" }
  | { kind: "arrow"; dir: ScrubDir }
  | { kind: "arrowHold"; dir: ScrubDir }
  | { kind: "mediaSeek"; dir: ScrubDir }
  | { kind: "vertical" }
  | { kind: "select" }
  | { kind: "playPause" }
  | { kind: "anyPress" };

const RELEASE: PlayerRemoteStep = { kind: "release" };
const ANY_PRESS: PlayerRemoteStep = { kind: "anyPress" };

/** Le sens d'une direction HORIZONTALE dans la vidéo ; `null` pour haut et bas. */
export function scrubDirOf(direction: Direction): ScrubDir | null {
  if (direction === "droite") return "forward";
  if (direction === "gauche") return "backward";
  return null;
}

export function playerRemoteSteps(
  intent: RemoteIntent,
  traits: Pick<RemoteTraits, "pressOnRelease">,
): PlayerRemoteStep[] {
  const released = traits.pressOnRelease ? [RELEASE] : [];
  switch (intent.type) {
    case "move": {
      const dir = scrubDirOf(intent.direction);
      return dir ? [...released, { kind: "arrow", dir }, ANY_PRESS] : [...released, { kind: "vertical" }, ANY_PRESS];
    }
    case "select":
      return [...released, { kind: "select" }, ANY_PRESS];
    case "playPause":
      return [...released, { kind: "playPause" }];
    case "page":
      return released;
    case "hold": {
      const direction = holdDirection(intent.key);
      const dir = direction ? scrubDirOf(direction) : null;
      if (intent.phase === "start") return dir ? [{ kind: "arrowHold", dir }] : [];
      if (intent.phase === "end") return [RELEASE];
      return dir ? [RELEASE] : [];
    }
    case "transport":
      if (intent.command === "avance") return [{ kind: "mediaSeek", dir: "forward" }, ANY_PRESS];
      if (intent.command === "retour") return [{ kind: "mediaSeek", dir: "backward" }, ANY_PRESS];
      return [];
    case "retour":
    case "swipe":
    case "drag":
      return [];
  }
}

/** Applique les gestes, dans l'ordre, aux contrôles du lecteur. */
export function applyPlayerRemoteSteps(steps: readonly PlayerRemoteStep[], handlers: PlayerRemoteHandlers): void {
  for (const step of steps) {
    switch (step.kind) {
      case "release": handlers.release(); break;
      case "arrow": handlers.arrow(step.dir); break;
      case "arrowHold": handlers.arrowHold(step.dir); break;
      case "mediaSeek": handlers.mediaSeek(step.dir); break;
      case "vertical": handlers.vertical(); break;
      case "select": handlers.select(); break;
      case "playPause": handlers.playPause(); break;
      case "anyPress": handlers.anyPress(); break;
    }
  }
}
