/**
 * Octave (mobile) — la règle PURE des droits du registre (testée sans React
 * Native) : une entrée s'affiche, se tait ou attend.
 *
 * - Capacités : un serveur qui a RÉPONDU sans la déclarer → masquée (un serveur
 *   d'avant 1.40.0 ne déclare rien : rien d'Octave). Une configuration en PANNE
 *   (hors ligne) ne prouve aucune absence : la coquille est déjà ouverte sur la
 *   foi du miroir, l'entrée reste (une panne n'est jamais une absence).
 * - Droit : `false` → masquée ; `null` → on attend, sans rien montrer.
 */

import type { OctaveGated, OctaveRequirement } from "./octaveRegistryTypes";

export type OctaveRequirementState = "met" | "unmet" | "pending";

export interface OctaveRequirementContext {
  capabilities: ReadonlySet<string>;
  /** La configuration a répondu ou échoué. */
  capsSettled: boolean;
  /** La configuration a RÉPONDU (sa liste vient du serveur). */
  capsKnown: boolean;
  /** Ce que dit le crochet de droit (`undefined` : l'entrée n'en a pas). */
  allowed: boolean | null | undefined;
}

export function octaveRequirementState(requires: OctaveRequirement | undefined, ctx: OctaveRequirementContext): OctaveRequirementState {
  const needed = requires?.capabilities ?? [];
  if (needed.length > 0 && !needed.every((key) => ctx.capabilities.has(key))) {
    if (ctx.capsKnown) return "unmet";
    if (!ctx.capsSettled) return "pending";
    // Panne : aucune absence prouvée, le droit tranche seul.
  }
  if (ctx.allowed === false) return "unmet";
  if (ctx.allowed === null) return "pending";
  return "met";
}

/** Le composant et son droit, quelle que soit la forme de l'entrée. */
export function gatedEntry<T extends object>(entry: OctaveGated<T> | undefined): { component: T; requires?: OctaveRequirement } | null {
  if (!entry) return null;
  // Un composant `memo` ou `forwardRef` est un objet aussi, mais sans champ `component`.
  if (typeof entry === "object" && "component" in entry) return entry as { component: T; requires?: OctaveRequirement };
  return { component: entry as T };
}
