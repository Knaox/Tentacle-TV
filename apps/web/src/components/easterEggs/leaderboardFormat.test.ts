import { describe, it, expect } from "vitest";
import { formatDuration, barRatio, rankValue } from "./leaderboardFormat";

describe("formaterDuree", () => {
  it("ne dit rien quand la durée est inconnue", () => {
    expect(formatDuration(null)).toBeNull();
  });

  it("distingue « rien » de « presque rien »", () => {
    expect(formatDuration(0)).toBe("< 1 min");
    expect(formatDuration(59)).toBe("< 1 min");
    expect(formatDuration(60)).toBe("1 min");
  });

  it("passe aux heures, avec des minutes sur deux chiffres", () => {
    expect(formatDuration(3600)).toBe("1 h");
    expect(formatDuration(3600 + 5 * 60)).toBe("1 h 05");
    expect(formatDuration(12 * 3600 + 30 * 60)).toBe("12 h 30");
  });

  it("passe aux jours au-delà de vingt-quatre heures", () => {
    expect(formatDuration(24 * 3600)).toBe("1 j");
    expect(formatDuration(3 * 24 * 3600 + 4 * 3600)).toBe("3 j 4 h");
  });
});

describe("ratioBarre", () => {
  it("rend zéro quand il n'y a rien à montrer", () => {
    expect(barRatio(null, 100)).toBe(0);
    expect(barRatio(0, 100)).toBe(0);
    expect(barRatio(50, 0)).toBe(0);
  });

  it("remplit la barre du premier", () => {
    expect(barRatio(100, 100)).toBe(1);
  });

  it("garde une barre visible pour les tout petits scores", () => {
    expect(barRatio(1, 100_000)).toBe(0.04);
  });

  it("reste proportionnel entre les deux", () => {
    expect(barRatio(50, 100)).toBe(0.5);
  });
});

describe("valeurDeRang", () => {
  it("classe sur la durée quand elle est connue", () => {
    expect(rankValue({ watchSeconds: 7200, totalPlayed: 3 })).toBe(7200);
  });

  it("retombe sur le nombre de titres vus sinon", () => {
    expect(rankValue({ watchSeconds: null, totalPlayed: 42 })).toBe(42);
  });
});
