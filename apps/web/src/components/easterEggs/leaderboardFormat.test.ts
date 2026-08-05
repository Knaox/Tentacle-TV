import { describe, it, expect } from "vitest";
import { formaterDuree, ratioBarre, valeurDeRang } from "./leaderboardFormat";

describe("formaterDuree", () => {
  it("ne dit rien quand la durée est inconnue", () => {
    expect(formaterDuree(null)).toBeNull();
  });

  it("distingue « rien » de « presque rien »", () => {
    expect(formaterDuree(0)).toBe("< 1 min");
    expect(formaterDuree(59)).toBe("< 1 min");
    expect(formaterDuree(60)).toBe("1 min");
  });

  it("passe aux heures, avec des minutes sur deux chiffres", () => {
    expect(formaterDuree(3600)).toBe("1 h");
    expect(formaterDuree(3600 + 5 * 60)).toBe("1 h 05");
    expect(formaterDuree(12 * 3600 + 30 * 60)).toBe("12 h 30");
  });

  it("passe aux jours au-delà de vingt-quatre heures", () => {
    expect(formaterDuree(24 * 3600)).toBe("1 j");
    expect(formaterDuree(3 * 24 * 3600 + 4 * 3600)).toBe("3 j 4 h");
  });
});

describe("ratioBarre", () => {
  it("rend zéro quand il n'y a rien à montrer", () => {
    expect(ratioBarre(null, 100)).toBe(0);
    expect(ratioBarre(0, 100)).toBe(0);
    expect(ratioBarre(50, 0)).toBe(0);
  });

  it("remplit la barre du premier", () => {
    expect(ratioBarre(100, 100)).toBe(1);
  });

  it("garde une barre visible pour les tout petits scores", () => {
    expect(ratioBarre(1, 100_000)).toBe(0.04);
  });

  it("reste proportionnel entre les deux", () => {
    expect(ratioBarre(50, 100)).toBe(0.5);
  });
});

describe("valeurDeRang", () => {
  it("classe sur la durée quand elle est connue", () => {
    expect(valeurDeRang({ watchSeconds: 7200, totalPlayed: 3 })).toBe(7200);
  });

  it("retombe sur le nombre de titres vus sinon", () => {
    expect(valeurDeRang({ watchSeconds: null, totalPlayed: 42 })).toBe(42);
  });
});
