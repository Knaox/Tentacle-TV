import type { FirstRunStep } from "./firstRunPlan";

/**
 * Le déroulé du premier lancement, PAS À PAS — module PUR (testé sous vitest).
 * Une seule surface à l'écran à la fois : la carte de l'étape, OU la feuille
 * qu'elle ouvre (le code PIN, la galerie des avatars). Entre les deux, un
 * passage (`toSheet`, `toCard`) où rien n'est montré : l'hôte attend que la
 * surface précédente se soit retirée (`whenNoModal`) avant de présenter la
 * suivante — deux modales présentées l'une sur l'autre coinceraient la pile
 * native d'iOS.
 */
export type FirstRunSurface = "card" | "toSheet" | "sheet" | "toCard" | "done";

export interface FirstRunFlow {
  steps: readonly FirstRunStep[];
  index: number;
  surface: FirstRunSurface;
}

export type FirstRunAction = "next" | "openSheet" | "presented" | "sheetClosed";

export function startFirstRun(steps: readonly FirstRunStep[]): FirstRunFlow {
  return { steps, index: 0, surface: steps.length > 0 ? "card" : "done" };
}

export function currentStep(flow: FirstRunFlow): FirstRunStep | null {
  return flow.surface === "done" ? null : flow.steps[flow.index] ?? null;
}

function advance(flow: FirstRunFlow, surface: "card" | "toCard"): FirstRunFlow {
  const index = flow.index + 1;
  return index < flow.steps.length ? { ...flow, index, surface } : { ...flow, index, surface: "done" };
}

export function reduceFirstRun(flow: FirstRunFlow, action: FirstRunAction): FirstRunFlow {
  switch (action) {
    case "next":
      return flow.surface === "card" ? advance(flow, "card") : flow;
    case "openSheet":
      return flow.surface === "card" ? { ...flow, surface: "toSheet" } : flow;
    case "presented":
      if (flow.surface === "toSheet") return { ...flow, surface: "sheet" };
      if (flow.surface === "toCard") return { ...flow, surface: "card" };
      return flow;
    case "sheetClosed":
      return flow.surface === "sheet" ? advance(flow, "toCard") : flow;
  }
}
