import type { FamilyProfileKind } from "@tentacle-tv/shared";

/**
 * SON code PIN, depuis son profil sur l'Apple TV (Réglages › Compte) — créer,
 * changer, retirer. Module pur : les étapes et ce qui part au serveur, qui
 * seul juge (l'ancien code d'abord, s'il y en a un — mêmes essais, même
 * blocage qu'à l'ouverture d'un profil). Le code ne fait que transiter : il
 * part dans le corps de l'appel, jamais dans une URL, et rien ne le garde.
 *
 * Un invité n'a pas ce geste : son code est posé par le propriétaire.
 */

export type OwnPinMode = "create" | "change" | "remove";
export type OwnPinStep = "current" | "new" | "confirm";

export interface OwnPinFlow {
  mode: OwnPinMode;
  step: OwnPinStep;
  /** Le code actuel, tapé à la première étape (changer, retirer). */
  current: string | null;
  /** Le nouveau code, tapé une première fois. */
  fresh: string | null;
  /** La confirmation ne correspondait pas : on recommence le nouveau code. */
  mismatch: boolean;
}

/** Ce qui part au serveur : le nouveau code (null : le retirer), et l'actuel s'il y en a un. */
export interface OwnPinSubmit {
  pin: string | null;
  currentPin?: string;
}

/** Les gestes offerts : aucun pour un invité ; créer sans code ; changer ou retirer avec. */
export function ownPinModes(kind: FamilyProfileKind, hasPin: boolean): OwnPinMode[] {
  if (kind === "guest") return [];
  return hasPin ? ["change", "remove"] : ["create"];
}

export function ownPinStart(mode: OwnPinMode): OwnPinFlow {
  return { mode, step: mode === "create" ? "new" : "current", current: null, fresh: null, mismatch: false };
}

/** Quatre chiffres tapés à l'étape courante : l'étape suivante, ou ce qui part au serveur. */
export function ownPinEntered(flow: OwnPinFlow, pin: string): { flow: OwnPinFlow; submit: OwnPinSubmit | null } {
  const withCurrent = (submit: OwnPinSubmit): OwnPinSubmit => (flow.current ? { ...submit, currentPin: flow.current } : submit);
  if (flow.step === "current") {
    if (flow.mode === "remove") return { flow: { ...flow, current: pin }, submit: { pin: null, currentPin: pin } };
    return { flow: { ...flow, current: pin, step: "new", mismatch: false }, submit: null };
  }
  if (flow.step === "new") return { flow: { ...flow, fresh: pin, step: "confirm", mismatch: false }, submit: null };
  if (pin === flow.fresh) return { flow, submit: withCurrent({ pin }) };
  return { flow: { ...flow, fresh: null, step: "new", mismatch: true }, submit: null };
}

/** Le serveur a refusé le code ACTUEL (faux, ou bloqué) : on le redemande. */
export function ownPinCurrentRefused(flow: OwnPinFlow): OwnPinFlow {
  return { ...flow, step: flow.mode === "create" ? "new" : "current", current: null, fresh: null, mismatch: false };
}
