import type { FamilyCreationDefaults, FamilySwitches } from "@tentacle-tv/shared";

/**
 * Admin › Utilisateurs › Familles, face à un serveur `family.creationRights` :
 * UN choix par fonction au lieu de deux réglages qui semblaient dire la même
 * chose (« Familles » et « Par défaut, un compte peut créer une famille »).
 *
 * Le serveur garde ses deux réglages — l'interrupteur maître et le défaut des
 * droits de création — ; ce module n'en fait que trois positions :
 * - `off` : l'interrupteur coupé — personne, administrateurs compris, et les
 *   profils ouverts se ferment ;
 * - `allowed` : allumé, défaut NON — les administrateurs et les comptes permis
 *   dans leur fiche ;
 * - `everyone` : allumé, défaut OUI — chaque compte, sauf ceux refusés.
 *
 * 1.30.0 (`family.guestRequestsAdmin`) : « Les invités peuvent demander des films » suit le même
 * modèle — l'interrupteur `guestRequests` (coupé = les cases des invités SUSPENDUES, gardées) et
 * le défaut du droit de compte `grantGuestRequests`.
 */

export type FamilyAccessFeature = "families" | "guests" | "guestRequests";
export type FamilyAccessLevel = "off" | "allowed" | "everyone";

export const FAMILY_ACCESS_LEVELS: readonly FamilyAccessLevel[] = ["off", "allowed", "everyone"];

const DEFAULT_KEY: Record<FamilyAccessFeature, keyof FamilyCreationDefaults> = {
  families: "createFamily",
  guests: "createGuests",
  guestRequests: "grantGuestRequests",
};

export interface FamilyAccessState {
  switches: FamilySwitches;
  defaults: FamilyCreationDefaults;
}

/** La position affichée : ce que le serveur a RÉPONDU, jamais ce qu'on a cliqué. */
export function accessLevelOf(feature: FamilyAccessFeature, state: FamilyAccessState): FamilyAccessLevel {
  if (state.switches[feature] !== true) return "off";
  return state.defaults[DEFAULT_KEY[feature]] ? "everyone" : "allowed";
}

export interface FamilyAccessChanges {
  defaults?: Partial<FamilyCreationDefaults>;
  switches?: Partial<FamilySwitches>;
}

/**
 * Ce qu'il faut écrire pour passer à `level` — seulement ce qui change. Couper
 * laisse le défaut tel quel : rallumer passe de toute façon par une position
 * explicite, qui le repose.
 */
export function accessChangesFor(feature: FamilyAccessFeature, state: FamilyAccessState, level: FamilyAccessLevel): FamilyAccessChanges {
  const changes: FamilyAccessChanges = {};
  const on = level !== "off";
  if (on) {
    const key = DEFAULT_KEY[feature];
    const everyone = level === "everyone";
    if (state.defaults[key] !== everyone) changes.defaults = { [key]: everyone };
  }
  if (state.switches[feature] !== on) changes.switches = { [feature]: on };
  return changes;
}
