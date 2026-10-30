import { describe, expect, it } from "vitest";
import { octaveModeAvailability } from "./octaveModeAvailability";

const base = { failed: false, configKnown: true, offline: false, mirrorAvailable: false };
const absent = { available: false, settled: true };
const pending = { available: false, settled: false };

describe("octaveModeAvailability", () => {
  it("hors ligne : Octave reste disponible, même sans réponse ni miroir (le mode est celui de l'appareil)", () => {
    expect(octaveModeAvailability({ ...base, offline: true, configKnown: false, fresh: absent })).toEqual({ available: true, settled: true });
  });

  it("démarrage à froid sans réseau AVANT que la sonde ne tranche : /api/config fini sans réponse n'est pas une absence", () => {
    expect(octaveModeAvailability({ ...base, configKnown: false, fresh: absent })).toEqual({ available: true, settled: true });
  });

  it("statut de la musique en erreur : une panne, Octave reste", () => {
    expect(octaveModeAvailability({ ...base, failed: true, fresh: absent }).available).toBe(true);
  });

  it("un serveur qui a RÉPONDU sans musique : absence établie, le mode s'éteindra", () => {
    expect(octaveModeAvailability({ ...base, fresh: absent })).toEqual(absent);
  });

  it("rien de connu : on attend, sauf si le miroir dit Octave disponible", () => {
    expect(octaveModeAvailability({ ...base, configKnown: false, fresh: pending })).toEqual(pending);
    expect(octaveModeAvailability({ ...base, configKnown: false, mirrorAvailable: true, fresh: pending }).available).toBe(true);
  });

  it("en ligne et disponible : ouvert", () => {
    expect(octaveModeAvailability({ ...base, fresh: { available: true, settled: true } }).available).toBe(true);
  });
});
