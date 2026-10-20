import type { SettingsAbility } from "@tentacle-tv/shared";
import { mayShow, type AccountAbilitiesState } from "./accountAbilitiesGate";

const SETTINGS_ABILITIES: readonly SettingsAbility[] = ["tickets", "manageAccount", "pairDevices", "push", "invites"];

export interface SettingsSessionAbilities {
  abilities: ReadonlySet<SettingsAbility>;
  /** Administrateur (le droit `administrator` du serveur ; d'avant : la règle de l'appelant). */
  isAdmin: boolean;
}

/**
 * Ce que le CATALOGUE DES RÉGLAGES (shared `settingsCatalog`) lit des droits
 * de la session, pour tous les clients qui le rendent (mobile, web étroit) —
 * la règle de l'adaptateur du mobile (`useSessionAbilities`) : serveur sans
 * `account.abilities` → le comportement d'avant (tous les droits, les
 * invitations et l'administration selon `legacyIsAdmin`) ; droits pas encore
 * lus → rien (jamais un geste montré puis retiré). Pure, testée.
 */
export function settingsAbilitiesOf(state: AccountAbilitiesState, legacyIsAdmin: boolean): SettingsSessionAbilities {
  const abilities = new Set<SettingsAbility>(
    state.kind === "pending" ? [] : SETTINGS_ABILITIES.filter((a) => mayShow(state, a, a === "invites" ? legacyIsAdmin : true)),
  );
  return { abilities, isAdmin: mayShow(state, "administrator", legacyIsAdmin) };
}
