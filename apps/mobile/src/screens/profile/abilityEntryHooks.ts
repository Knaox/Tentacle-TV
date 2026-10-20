import type { SettingsAbility } from "@tentacle-tv/shared";

/**
 * Ce que les réglages lisent des DROITS de la session — l'ADAPTATEUR vers
 * `useAccountAbilities()` + `mayShow(state, ability, legacy)` de l'api-client
 * (session « droits-mobile », lot du 2026-10-20, capacité `account.abilities`).
 * Tant qu'ils ne sont pas fusionnés, ce module rend le comportement d'AVANT :
 * tous les droits, et l'administrateur selon son profil — jamais une erreur.
 */

const LEGACY: ReadonlySet<SettingsAbility> = new Set<SettingsAbility>(["tickets", "manageAccount", "pairDevices", "push", "invites"]);

export interface SessionAbilities {
  abilities: ReadonlySet<SettingsAbility>;
  /** Administrateur (le droit `administrator` du serveur ; d'avant : la politique Jellyfin du profil). */
  isAdmin: boolean;
}

export function useSessionAbilities(legacyIsAdmin: boolean): SessionAbilities {
  return { abilities: LEGACY, isAdmin: legacyIsAdmin };
}
