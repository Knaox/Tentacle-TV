import { describe, expect, it } from "vitest";
import { decideDrift, proportionalRate } from "./driftController";

const band = { engageS: 0.04, settleS: 0.025 };

describe("proportionalRate", () => {
  it("ralentit en avance, accélère en retard, borné à ±5 %", () => {
    expect(proportionalRate(0.15)).toBeCloseTo(0.95, 5);
    expect(proportionalRate(-0.15)).toBeCloseTo(1.05, 5);
    expect(proportionalRate(3)).toBeCloseTo(0.95, 5);
    expect(proportionalRate(-0.06)).toBeCloseTo(1.02, 5);
  });

  it("arrondit au pas : un changement plus fin ne vaut pas l'IPC", () => {
    expect(proportionalRate(0.02)).toBe(0.995);
    expect(proportionalRate(0.5)).toBe(0.95);
    expect(proportionalRate(0.005)).toBeCloseTo(1, 5);
  });
});

describe("decideDrift", () => {
  it("dans la zone morte, rien", () => {
    expect(decideDrift({ driftS: 0.03, paused: false, currentRate: 1, ...band, correctingForMs: null }))
      .toEqual({ rate: 1, seek: "none" });
  });

  it("au-delà, la vitesse proportionnelle", () => {
    expect(decideDrift({ driftS: 0.09, paused: false, currentRate: 1, ...band, correctingForMs: null }))
      .toEqual({ rate: 0.97, seek: "none" });
  });

  it("une correction engagée tient jusqu'au relâchement (hystérésis)", () => {
    expect(decideDrift({ driftS: 0.03, paused: false, currentRate: 0.99, ...band, correctingForMs: 800 }))
      .toEqual({ rate: 0.99, seek: "none" });
    expect(decideDrift({ driftS: 0.02, paused: false, currentRate: 0.99, ...band, correctingForMs: 900 }))
      .toEqual({ rate: 1, seek: "none" });
  });

  it("une grande dérive se saute", () => {
    expect(decideDrift({ driftS: -2, paused: false, currentRate: 1, ...band, correctingForMs: null }))
      .toEqual({ rate: 1, seek: "hard" });
  });

  it("une douceur qui n'a rien résorbé finit par sauter", () => {
    expect(decideDrift({ driftS: 0.5, paused: false, currentRate: 0.95, ...band, correctingForMs: 16_000 }))
      .toEqual({ rate: 1, seek: "hard" });
    expect(decideDrift({ driftS: 0.5, paused: false, currentRate: 0.95, ...band, correctingForMs: 14_000 }))
      .toEqual({ rate: 0.95, seek: "none" });
  });

  it("en pause : vitesse normale, recalage exact seulement si l'écart est franc", () => {
    expect(decideDrift({ driftS: 0.03, paused: true, currentRate: 1.05, ...band, correctingForMs: 100 }))
      .toEqual({ rate: 1, seek: "none" });
    expect(decideDrift({ driftS: -0.2, paused: true, currentRate: 1, ...band, correctingForMs: null }))
      .toEqual({ rate: 1, seek: "paused" });
  });
});
