import { describe, expect, it } from "vitest";
import { CROSSFADE_DEFAULT_MS, readCrossfadeSetting } from "./crossfadeRules";

describe("transition douce — le réglage de l'appareil", () => {
  it("rien d'écrit : allumée, à 3 s (le défaut de Damien)", () => {
    expect(CROSSFADE_DEFAULT_MS).toBe(3_000);
    expect([null, undefined, "", "  "].map(readCrossfadeSetting)).toEqual([3_000, 3_000, 3_000, 3_000]);
  });

  it("un choix déjà fait reste le sien : coupée reste coupée, une durée reste la sienne", () => {
    expect(readCrossfadeSetting("0")).toBe(0);
    expect(readCrossfadeSetting("6000")).toBe(6_000);
    expect(readCrossfadeSetting("40000")).toBe(12_000);
    expect(readCrossfadeSetting("n'importe quoi")).toBe(0);
  });
});
