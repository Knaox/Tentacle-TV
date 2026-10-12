import type { SetupStep } from "@tentacle-tv/shared";

/**
 * Les grandes étapes que montre l'en-tête de l'assistant : cinq, les mêmes
 * d'un parcours à l'autre (Jellyfin neuf ou déjà configuré, avec ou sans
 * code) — le nombre d'écrans, lui, ne se connaît qu'une fois le Jellyfin
 * choisi. Pur affichage : l'ordre des écrans reste celui du serveur
 * (`setupFlowContract.ts`, par `wizardModel.ts`).
 */
export type WizardPhase = "start" | "jellyfin" | "content" | "install" | "finish";

export const WIZARD_PHASES: readonly WizardPhase[] = ["start", "jellyfin", "content", "install", "finish"];

const PHASE_OF: Readonly<Record<SetupStep, WizardPhase>> = {
  welcome: "start",
  code: "start",
  jellyfin: "jellyfin",
  account: "jellyfin",
  signIn: "jellyfin",
  libraries: "content",
  recommended: "content",
  tmdb: "content",
  recap: "install",
  apply: "install",
  remote: "finish",
  done: "finish",
};

export function phaseOf(step: SetupStep): WizardPhase {
  return PHASE_OF[step];
}

/** L'état d'une grande étape vue depuis l'écran `step` : faite, en cours, ou à venir. */
export function phaseState(phase: WizardPhase, step: SetupStep): "done" | "current" | "upcoming" {
  const here = WIZARD_PHASES.indexOf(phaseOf(step));
  const index = WIZARD_PHASES.indexOf(phase);
  return index < here ? "done" : index === here ? "current" : "upcoming";
}
