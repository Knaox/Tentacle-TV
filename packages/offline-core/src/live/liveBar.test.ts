import { describe, expect, it } from "vitest";
import { liveBarStartMs } from "./liveBar";

const NOW = 1_000_000;

describe("liveBarStartMs", () => {
  it("à mi-chemin, le départ virtuel est aussi loin derrière que la fin est loin devant", () => {
    expect(liveBarStartMs({ phase: "transferring", percent: 50, endsAtMs: NOW + 60_000 }, NOW)).toBe(NOW - 60_000);
  });

  it("au départ, la barre part de maintenant", () => {
    expect(liveBarStartMs({ phase: "transferring", percent: 0, endsAtMs: NOW + 60_000 }, NOW)).toBe(NOW);
  });

  it("la barre tombe juste à l'instant publié", () => {
    const endsAtMs = NOW + 90_000;
    const start = liveBarStartMs({ phase: "transferring", percent: 25, endsAtMs }, NOW)!;
    expect((NOW - start) / (endsAtMs - start)).toBeCloseTo(0.25, 5);
  });

  it("pas de compte à rebours, pas de barre qui avance seule", () => {
    expect(liveBarStartMs({ phase: "estimating", percent: 30, endsAtMs: null }, NOW)).toBeNull();
    expect(liveBarStartMs({ phase: "waitingWifi", percent: 30, endsAtMs: null }, NOW)).toBeNull();
    expect(liveBarStartMs({ phase: "transferring", percent: null, endsAtMs: NOW + 1_000 }, NOW)).toBeNull();
  });

  it("fin déjà passée ou lot plein : rien", () => {
    expect(liveBarStartMs({ phase: "transferring", percent: 40, endsAtMs: NOW }, NOW)).toBeNull();
    expect(liveBarStartMs({ phase: "transferring", percent: 100, endsAtMs: NOW + 1_000 }, NOW)).toBeNull();
  });
});
