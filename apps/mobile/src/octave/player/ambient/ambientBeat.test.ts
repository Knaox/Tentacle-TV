import { describe, expect, it } from "vitest";
import { BEAT_MAX_BPM, BEAT_MIN_BPM, beatNeedsResync, beatPulse, trackTempo } from "./ambientBeat";

describe("la pulsation du fond (tempo posé sur la position de lecture)", () => {
  it("un tempo stable par titre, dans la plage, par pas de 2", () => {
    const keys = ["jf:a", "jf:b", "ext:sillon:x", "", "jf:The Fall and the Roar of Water"];
    for (const key of keys) {
      const bpm = trackTempo(key);
      expect(bpm).toBe(trackTempo(key));
      expect(bpm).toBeGreaterThanOrEqual(BEAT_MIN_BPM);
      expect(bpm).toBeLessThanOrEqual(BEAT_MAX_BPM);
      expect(bpm % 2).toBe(0);
    }
    expect(new Set(["jf:1", "jf:2", "jf:3", "jf:4", "jf:5", "jf:6"].map(trackTempo)).size).toBeGreaterThan(1);
  });

  it("un coup à chaque temps, qui retombe avant le suivant", () => {
    const bpm = 120; // un temps toutes les 0,5 s
    expect(beatPulse(0, bpm)).toBe(0);
    expect(beatPulse(0.03, bpm)).toBeCloseTo(1, 5); // sommet du premier temps (temps fort)
    expect(beatPulse(0.45, bpm)).toBeLessThan(0.2); // retombé juste avant le deuxième
    expect(beatPulse(0.53, bpm)).toBeCloseTo(0.55, 5); // deuxième temps : faible
    expect(beatPulse(2.03, bpm)).toBeCloseTo(1, 5); // cinquième temps : fort de nouveau
  });

  it("toujours entre 0 et 1, jamais rien d'absurde", () => {
    for (let s = 0; s < 10; s += 0.017) {
      const v = beatPulse(s, 107);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(beatPulse(-1, 120)).toBe(0);
    expect(beatPulse(Number.NaN, 120)).toBe(0);
    expect(beatPulse(1, 0)).toBe(0);
  });

  it("se recale sur un saut ou un nouveau titre, pas sur le léger retard des nouvelles du moteur", () => {
    expect(beatNeedsResync(12.1, 12.0)).toBe(false);
    expect(beatNeedsResync(12.0, 45.0)).toBe(true);
    expect(beatNeedsResync(180, 0)).toBe(true);
    expect(beatNeedsResync(Number.NaN, 0)).toBe(true);
  });
});
