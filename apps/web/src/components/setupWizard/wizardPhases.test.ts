import { describe, expect, it } from "vitest";
import { setupFlowSteps, type SetupStep } from "@tentacle-tv/shared";
import { phaseOf, phaseState, WIZARD_PHASES } from "./wizardPhases";

/**
 * Les grandes étapes de l'en-tête : chaque écran de chaque parcours en a une,
 * et elles avancent dans l'ordre — jamais un retour en arrière en avançant.
 */
describe("les grandes étapes de l'assistant", () => {
  const shapes = [
    { needsCode: true, path: "fresh" as const, asksTmdb: true },
    { needsCode: false, path: "configured" as const, asksTmdb: true },
    { needsCode: false, path: "configured" as const, noLibraries: true, asksTmdb: false },
  ];

  it("chaque parcours les traverse dans l'ordre, de « Démarrage » à « Finitions »", () => {
    for (const shape of shapes) {
      const phases = setupFlowSteps(shape).map((step) => WIZARD_PHASES.indexOf(phaseOf(step)));
      expect(phases.every((index, i) => i === 0 || index >= phases[i - 1])).toBe(true);
      expect(phases[0]).toBe(0);
      expect(phases[phases.length - 1]).toBe(WIZARD_PHASES.length - 1);
    }
  });

  it("faite, en cours, à venir", () => {
    const step: SetupStep = "libraries";
    expect(WIZARD_PHASES.map((phase) => phaseState(phase, step))).toEqual(["done", "done", "current", "upcoming", "upcoming"]);
  });
});
