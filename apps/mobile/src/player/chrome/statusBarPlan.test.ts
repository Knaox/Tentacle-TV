import { describe, expect, it } from "vitest";
import { stableTopInset, statusBarPlan, systemStatusBarAvailable } from "./statusBarPlan";

const base = { os: "ios", isTablet: false, landscape: false, controlsVisible: true, pipActive: false };

describe("barre d'état du lecteur", () => {
  it("commandes masquées : ni barre, ni heure", () => {
    expect(statusBarPlan({ ...base, controlsVisible: false })).toEqual({ systemBar: false, inlineClock: false });
  });

  it("iPhone en portrait : la vraie barre d'état", () => {
    expect(statusBarPlan(base)).toEqual({ systemBar: true, inlineClock: false });
  });

  it("iPhone en paysage : iOS la refuse, le lecteur dessine l'heure", () => {
    expect(statusBarPlan({ ...base, landscape: true })).toEqual({ systemBar: false, inlineClock: true });
  });

  it("iPad en paysage : la vraie barre", () => {
    expect(statusBarPlan({ ...base, landscape: true, isTablet: true })).toEqual({ systemBar: true, inlineClock: false });
  });

  it("Android, téléphone en paysage : la vraie barre, même en immersif", () => {
    expect(statusBarPlan({ ...base, os: "android", landscape: true })).toEqual({ systemBar: true, inlineClock: false });
  });

  it("image dans l'image : rien", () => {
    expect(statusBarPlan({ ...base, landscape: true, pipActive: true })).toEqual({ systemBar: false, inlineClock: false });
    expect(statusBarPlan({ ...base, os: "android", pipActive: true })).toEqual({ systemBar: false, inlineClock: false });
  });

  it("dit où le système sait la montrer", () => {
    expect(systemStatusBarAvailable("ios", false, true)).toBe(false);
    expect(systemStatusBarAvailable("android", false, true)).toBe(true);
  });

  it("garde la plus grande marge du haut vue", () => {
    expect(stableTopInset(undefined, 24)).toBe(24);
    expect(stableTopInset(24, 0)).toBe(24);
    expect(stableTopInset(24, 47)).toBe(47);
  });
});
