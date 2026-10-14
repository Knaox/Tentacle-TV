import { describe, expect, it } from "vitest";
import { panelAirApplied, panelAirOf } from "./usePanelAir";

/** L'air du bandeau : l'excédent sur son contenu, réparti — mesuré, stable, jamais négatif. */
describe("panelAirOf", () => {
  it("rend l'excédent d'un bandeau plus haut que son contenu (l'affiche à 1 440 px)", () => {
    // Bandeau de 164 px, contenu posé jusqu'à 112, pied de 10 : 42 à répartir.
    expect(panelAirOf({ bottom: 112, air: 0, height: 164, foot: 10 })).toBe(42);
  });

  it("ne bouge plus une fois l'air posé : la mesure suivante retrouve le même excédent", () => {
    const air = 42;
    const bottom = 112 + panelAirApplied(air);
    expect(panelAirOf({ bottom, air, height: 164, foot: 10 })).toBe(air);
  });

  it("rend 0 à un bandeau rempli, ou débordé (une ligne arrivée tard)", () => {
    expect(panelAirOf({ bottom: 150, air: 0, height: 156, foot: 12 })).toBe(0);
    expect(panelAirOf({ bottom: 180 + panelAirApplied(20), air: 20, height: 164, foot: 10 })).toBe(0);
  });

  it("ne répartit jamais tout : une part reste au pied", () => {
    expect(panelAirApplied(40)).toBeLessThan(40);
  });
});
