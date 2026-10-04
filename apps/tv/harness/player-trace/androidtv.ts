// Android TV refondu (`TRACE_PLATFORM=androidtv`) : les scénarios de l'Apple
// TV, rejoués avec les événements tels qu'Android TV les émet, sur l'entrée
// unique d'Android (table `ANDROIDTV_BINDINGS`) — et comparés aux traces de
// RÉFÉRENCE de l'Apple TV. Le lecteur refondu doit y faire exactement la
// même chose, à la milliseconde : seuls changent les événements reçus.
import type { Scenario, Step } from "./driver";
import type { Entry } from "./rig";
import { IOS } from "./scenarios";

const PRESSES = new Set(["left", "right", "up", "down", "select", "playPause"]);

/**
 * Une étape tvOS → ce qu'Android émet au même instant :
 * - un appui (relâchement seul sur tvOS) : l'enfoncement PUIS le relâchement
 *   (`enableKeyDownEvents`) ;
 * - le début d'un maintien : l'enfoncement de la flèche, puis `longX` à 0 —
 *   react-native-tvos le tire de la première répétition et avale les autres ;
 * - sa fin : `longX` à 1 ; Menu reste la pile de couches (le Retour
 *   d'Android y entre par `BackHandler`, banc de la portée du Retour).
 */
function translate(step: Step): Step[] {
  if (!("key" in step)) return [step];
  if (PRESSES.has(step.key) && step.a === 1) return [{ key: step.key, a: 0 }, step];
  const long = /^long(Left|Right|Up|Down|Select)$/.exec(step.key);
  if (long && step.a === 0) return [{ key: long[1].toLowerCase(), a: 0 }, step];
  return [step];
}

/** Sans pavé tactile sur Android TV : les scénarios du glisser n'ont pas d'équivalent. */
const usesTouch = (scenario: Scenario) => scenario.steps.some((step) => "pan" in step);

export const ANDROIDTV: Scenario[] = IOS.filter((scenario) => !usesTouch(scenario)).map((scenario) => ({
  ...scenario,
  steps: scenario.steps.flatMap(translate),
}));

/** Ce que l'on compare : les effets et les états, pas les entrées brutes ni la prise du pan (tvOS seul). */
export function effectsOf(entries: readonly Entry[]): Entry[] {
  return entries.filter((entry) => !entry.ev.startsWith("in:") && !entry.ev.startsWith("pan:"));
}
