import { beforeEach, describe, expect, it } from "vitest";
import { getClockOffsetMs, getClockRttMs, recordClockSample, resetClockSamples } from "./clockSync";

/**
 * L'offset retenu est celui du pong au plus court aller-retour ; la fenêtre
 * oublie le trop vieux et repart de zéro sur un saut d'horloge.
 */

const T0 = 1_700_000_000_000;

beforeEach(() => resetClockSamples());

describe("recordClockSample", () => {
  it("retient l'échantillon au plus petit aller-retour", () => {
    recordClockSample(T0, T0 + 1_000 + 40, T0 + 80);   // rtt 80, offset 1000
    recordClockSample(T0 + 100, T0 + 100 + 1_003 + 10, T0 + 120); // rtt 20, offset 1003
    recordClockSample(T0 + 200, T0 + 200 + 1_020 + 100, T0 + 400); // rtt 200, offset 1020
    expect(getClockOffsetMs(T0 + 400)).toBe(1_003);
    expect(getClockRttMs(T0 + 400)).toBe(20);
  });

  it("oublie un échantillon trop vieux, même meilleur", () => {
    recordClockSample(T0, T0 + 1_000 + 5, T0 + 10);         // rtt 10, offset 1000
    const later = T0 + 200_000;
    recordClockSample(later, later + 1_010 + 30, later + 60); // rtt 60, offset 1010
    expect(getClockOffsetMs(later + 60)).toBe(1_010);
  });

  it("repart de zéro sur un saut d'horloge aussi net que le meilleur", () => {
    recordClockSample(T0, T0 + 1_000 + 10, T0 + 20);       // rtt 20, offset 1000
    recordClockSample(T0 + 50, T0 + 50 + 5_000 + 10, T0 + 70); // rtt 20, offset 5000 : saut
    expect(getClockOffsetMs(T0 + 70)).toBe(5_000);
  });

  it("un échantillon lointain mais LENT n'est pas un saut, juste du bruit", () => {
    recordClockSample(T0, T0 + 1_000 + 10, T0 + 20);         // rtt 20, offset 1000
    recordClockSample(T0 + 50, T0 + 50 + 5_000 + 200, T0 + 450); // rtt 400, offset 5000
    expect(getClockOffsetMs(T0 + 450)).toBe(1_000);
  });

  it("null tant que rien n'est mesuré", () => {
    expect(getClockOffsetMs()).toBeNull();
    expect(getClockRttMs()).toBeNull();
  });
});
