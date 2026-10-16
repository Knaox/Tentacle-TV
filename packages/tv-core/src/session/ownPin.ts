import { sameUserId, type FamilyProfileKind, type TvProfilesDto } from "@tentacle-tv/shared";
import type { ProfileManageState } from "./profileRole";
import type { ProfileLaunch } from "./tvProfileSession";

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
  /** Les saisies reprises de zéro après une confirmation différente : chacune
   *  ramène le focus au début du pavé (`profilesEntryRound`). */
  restarts: number;
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

/** Ce que `ownPinModesFor` lit du profil ouvert. */
export interface OwnPinSubject {
  kind: FamilyProfileKind;
  hasPin: boolean;
  /** `openProfileState(...).manage`. */
  manage: ProfileManageState;
  /** Comment la session s'est ouverte (`TvProfileRecord.launch`). */
  launch: ProfileLaunch;
  /** Seul dans la liste relue de « Qui regarde ? » ; null : la liste n'est pas lue. */
  alone: boolean | null;
}

/**
 * Le compte de DÉMONSTRATION (revue Apple) : le serveur lui refuse tout code
 * (`family.review_account`). Il ne se dit pas à la TV (ni la liste des profils,
 * ni la famille, fermée sans code) ; il se reconnaît à ce que TOUT le désigne,
 * et seulement lui :
 * - il est ouvert d'office (`solo`), SEUL dans la liste, sans code : jamais un
 *   membre d'une famille (même « Qui regarde ? » coupé, la liste en montre
 *   d'autres) ;
 * - il ne gère rien, ni avec ni sans code (`manage` « none ») — alors qu'un
 *   compte sans famille, propriétaire de lui-même, le gérerait avec un code.
 */
export function isDemoProfile(subject: OwnPinSubject): boolean {
  return subject.kind !== "guest" && !subject.hasPin && subject.manage === "none" && subject.launch === "solo" && subject.alone !== false;
}

/** Le profil ouvert est-il seul dans la liste relue ? null : liste pas encore lue. */
export function profileAloneIn(listing: Pick<TvProfilesDto, "profiles"> | null, profileId: string): boolean | null {
  return listing ? listing.profiles.every((profile) => sameUserId(profile.userId, profileId)) : null;
}

/**
 * Les gestes offerts au profil ouvert : ceux de toujours (`ownPinModes`) —
 * un membre simple ou mineur, sans code ni droit de gestion, garde « Créer un
 * code PIN » — sauf le compte de démonstration, qui n'en voit aucun.
 */
export function ownPinModesFor(subject: OwnPinSubject): OwnPinMode[] {
  return isDemoProfile(subject) ? [] : ownPinModes(subject.kind, subject.hasPin);
}

export function ownPinStart(mode: OwnPinMode): OwnPinFlow {
  return { mode, step: mode === "create" ? "new" : "current", current: null, fresh: null, mismatch: false, restarts: 0 };
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
  return { flow: { ...flow, fresh: null, step: "new", mismatch: true, restarts: flow.restarts + 1 }, submit: null };
}

/** Le serveur a refusé le code ACTUEL (faux, ou bloqué) : on le redemande. */
export function ownPinCurrentRefused(flow: OwnPinFlow): OwnPinFlow {
  return { ...flow, step: flow.mode === "create" ? "new" : "current", current: null, fresh: null, mismatch: false };
}
