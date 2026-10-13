import type { PickerProfilesDto } from "@tentacle-tv/shared";
import { launchOutcome, verifyOutcome, type LaunchVerdict } from "./launchDecision";

/**
 * La PORTE de « Qui regarde ? » (`useProfileLaunchGate`) : ce qu'elle montre,
 * et ce que la réponse fraîche du serveur y change. Module pur
 * (`gateMachine.test.ts`).
 *
 * - `app` : l'application (la porte s'efface) ;
 * - `picker` : le sélecteur plein écran, AVANT l'application ;
 * - `check` : on attend le serveur (premier lancement, fin d'un profil) ;
 * - `error` : le serveur ne répond pas alors que le sélecteur est EXIGÉ
 *   (fin d'un profil) — Réessayer, jamais le compte sans son code.
 */
export type GatePhase = "app" | "picker" | "check" | "error";

/** `launch` : l'ouverture, préférence comprise ; `verify` : l'application est
 *  déjà là, seule la sécurité compte (`verifyOutcome`). */
export type GateMode = "launch" | "verify";

export interface GateState {
  phase: GatePhase;
  mode: GateMode;
  requested: boolean;
  heldProfileId: string | null;
}

export type FreshAnswer =
  | { kind: "listing"; listing: PickerProfilesDto }
  /** Le serveur ne déclare pas la capacité (ou la Famille) : rien de tout cela. */
  | { kind: "incapable" }
  /** Pas de réponse (réseau, 5xx, délai). */
  | { kind: "failed" }
  /** La session personnelle a été refusée (401). */
  | { kind: "accountLost" };

export interface GateStep {
  phase: GatePhase;
  /** La session de profil gardée est morte : y mettre fin (retour au compte, sélecteur). */
  endProfile?: true;
  /** La session personnelle n'est plus : déconnexion. */
  logout?: true;
}

export function initialGate(verdict: LaunchVerdict, requested: boolean, heldProfileId: string | null): GateState {
  return { phase: verdict, mode: verdict === "app" ? "verify" : "launch", requested, heldProfileId };
}

export function afterFresh(state: GateState, answer: FreshAnswer): GateStep {
  switch (answer.kind) {
    case "accountLost":
      return { phase: "app", logout: true };
    case "failed":
      if (state.requested) return { phase: "error" };
      return { phase: state.phase === "check" ? "app" : state.phase === "error" ? "error" : state.phase };
    case "incapable":
      return { phase: "app" };
    case "listing": {
      const outcome = state.mode === "verify"
        ? verifyOutcome(answer.listing, state.heldProfileId)
        : launchOutcome(answer.listing, state.heldProfileId, state.requested);
      if (outcome === "ended") return { phase: state.phase === "app" ? "app" : "check", endProfile: true };
      return { phase: outcome };
    }
  }
}

/** L'attente bornée d'une ouverture sans miroir est écoulée : l'application, sauf sélecteur EXIGÉ. */
export function afterBudget(state: GateState): GatePhase {
  return state.phase === "check" && !state.requested ? "app" : state.phase;
}
