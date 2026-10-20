import type { AccountAbilitiesDto, AccountAbility } from "@tentacle-tv/shared";

/**
 * Ce qu'un client sait de la session : le serveur ne dit rien (serveur d'avant :
 * `legacy`, chaque écran garde son comportement d'avant), pas encore su
 * (`pending` : rien ne s'affiche — un geste n'apparaît qu'une fois permis), ou su.
 */
export type AccountAbilitiesState =
  | { kind: "legacy" }
  | { kind: "pending" }
  | { kind: "known"; abilities: AccountAbilitiesDto };

/**
 * Ce geste se montre-t-il ? Règle de Damien (20/10) : tout ce qu'on a le droit
 * de faire se voit, le reste non. `legacy` : ce que l'écran faisait avant
 * (sa propre règle, passée par l'appelant).
 */
export function mayShow(state: AccountAbilitiesState, ability: AccountAbility, legacy = true): boolean {
  if (state.kind === "legacy") return legacy;
  if (state.kind === "pending") return false;
  return state.abilities[ability];
}

/** Watch Together : rien, rejoindre seulement, ou tout (créer, inviter). */
export function watchTogetherAbility(state: AccountAbilitiesState, legacy: "full" | "joinOnly" | "none" = "full"): "full" | "joinOnly" | "none" {
  if (state.kind === "legacy") return legacy;
  if (state.kind === "pending") return "none";
  return state.abilities.watchTogether;
}
