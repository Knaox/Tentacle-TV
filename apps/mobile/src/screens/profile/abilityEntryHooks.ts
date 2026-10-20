import type { SettingsAbility } from "@tentacle-tv/shared";
import { mayShow, useAccountAbilities } from "@tentacle-tv/api-client";

/**
 * Ce que les réglages lisent des DROITS de la session — l'ADAPTATEUR vers
 * `useAccountAbilities()` + `mayShow(state, ability, legacy)` de l'api-client
 * (session « droits-mobile », lot du 2026-10-20, capacité `account.abilities`).
 * BRANCHÉ : un serveur sans la capacité rend le comportement d'avant (tous les
 * droits, l'administrateur selon son profil) ; pendant la lecture des droits, rien.
 */

const ABILITIES: readonly SettingsAbility[] = ["tickets", "manageAccount", "pairDevices", "push", "invites"];

export interface SessionAbilities {
  abilities: ReadonlySet<SettingsAbility>;
  /** Administrateur (le droit `administrator` du serveur ; d'avant : la politique Jellyfin du profil). */
  isAdmin: boolean;
}

export function useSessionAbilities(legacyIsAdmin: boolean): SessionAbilities {
  const state = useAccountAbilities();
  // Pendant la lecture des droits : rien ne s'affiche (jamais un geste montré puis retiré).
  const abilities = new Set<SettingsAbility>(
    state.kind === "pending" ? [] : ABILITIES.filter((a) => mayShow(state, a, a === "invites" ? legacyIsAdmin : true)),
  );
  return { abilities, isAdmin: mayShow(state, "administrator", legacyIsAdmin) };
}
