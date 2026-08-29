import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { countLogoClick, closeLeaderboard, isLeaderboardOpen } from "./logoEggStore";

/** Le store ne lit que l'horloge : on la déplace à la main, pas via les minuteurs. */
const T0 = new Date("2026-08-05T10:00:00Z").getTime();
const advance = (ms: number) => vi.setSystemTime(new Date(vi.getMockedSystemTime()!.getTime() + ms));

describe("compteur de clics sur le logo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(T0));
    closeLeaderboard();
  });

  afterEach(() => {
    closeLeaderboard();
    vi.useRealTimers();
  });

  it("n'ouvre rien avant le quatrième clic", () => {
    for (let i = 0; i < 3; i++) {
      countLogoClick();
      expect(isLeaderboardOpen()).toBe(false);
    }
  });

  it("ouvre au quatrième clic rapproché", () => {
    for (let i = 0; i < 4; i++) countLogoClick();
    expect(isLeaderboardOpen()).toBe(true);
  });

  it("repart de zéro quand les clics s'espacent trop", () => {
    countLogoClick();
    countLogoClick();
    countLogoClick();
    advance(1200); // au-delà de la fenêtre de 900 ms
    countLogoClick();
    expect(isLeaderboardOpen()).toBe(false);
  });

  it("tolère un rythme irrégulier tant qu'on reste dans la fenêtre", () => {
    countLogoClick();
    advance(400);
    countLogoClick();
    advance(800);
    countLogoClick();
    advance(300);
    countLogoClick();
    expect(isLeaderboardOpen()).toBe(true);
  });

  it("se referme, et le compteur ne garde rien de la fois précédente", () => {
    for (let i = 0; i < 4; i++) countLogoClick();
    closeLeaderboard();
    expect(isLeaderboardOpen()).toBe(false);

    // Trois clics ne doivent PAS suffire à rouvrir : le compteur est bien remis
    // à zéro à l'ouverture, pas seulement décrémenté.
    for (let i = 0; i < 3; i++) countLogoClick();
    expect(isLeaderboardOpen()).toBe(false);
    countLogoClick();
    expect(isLeaderboardOpen()).toBe(true);
  });
});
