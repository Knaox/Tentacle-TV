import { describe, expect, it } from "vitest";
import { RULER_REMOVE_INDEX, rulerAimAfter, rulerCenterIndex, rulerReading, rulerRemovable, rulerStep } from "./ratingRuler";

describe("la visée de l'échelle", () => {
  it("suit le cran focalisé", () => {
    expect(rulerAimAfter(null, 6, true)).toBe(6);
    expect(rulerAimAfter(6, "remove", true)).toBe("remove");
  });

  it("au flou, ne tombe que si c'était elle", () => {
    expect(rulerAimAfter(6, 6, false)).toBeNull();
    expect(rulerAimAfter(7, 6, false)).toBe(7);
  });
});

describe("le centre de l'échelle", () => {
  it("est la visée, sinon la note posée, sinon 5", () => {
    expect(rulerCenterIndex(8, 3)).toBe(7);
    expect(rulerCenterIndex(null, 3)).toBe(2);
    expect(rulerCenterIndex(null, null)).toBe(4);
  });

  it("place le retrait après le 10", () => {
    expect(rulerCenterIndex("remove", 3)).toBe(RULER_REMOVE_INDEX);
    expect(RULER_REMOVE_INDEX).toBe(10);
  });
});

describe("le retrait de la note", () => {
  it("paraît dès qu'une note existe, et reste une fois paru", () => {
    expect(rulerRemovable(false, null)).toBe(false);
    expect(rulerRemovable(false, 4)).toBe(true);
    expect(rulerRemovable(true, null)).toBe(true);
  });
});

describe("ce que le panneau dit de la note", () => {
  it("attend, pâli, tant qu'elle se résout", () => {
    expect(rulerReading(null, null, true)).toEqual({ stars: 0, dim: true, value: "pending", line: "pending" });
  });

  it("sans note ni visée : cinq étoiles vides, « — », pas encore noté", () => {
    expect(rulerReading(null, null, false)).toEqual({ stars: 0, dim: false, value: "none", line: "unrated" });
  });

  it("une visée différente de la note : la visée, et OK la posera", () => {
    expect(rulerReading(8, 6, false)).toEqual({ stars: 8, dim: false, value: 8, line: "rate" });
  });

  it("la visée sur la note posée : la note actuelle", () => {
    expect(rulerReading(6, 6, false)).toEqual({ stars: 6, dim: false, value: 6, line: "current" });
    expect(rulerReading(null, 6, false)).toEqual({ stars: 6, dim: false, value: 6, line: "current" });
  });

  it("le retrait visé : la note qui part, pâlie, et « — »", () => {
    expect(rulerReading("remove", 6, false)).toEqual({ stars: 6, dim: true, value: "none", line: "remove" });
  });
});

describe("GAUCHE et DROITE sur l'échelle", () => {
  it("passent au cran voisin", () => {
    expect(rulerStep(5, "droite", false)).toBe(6);
    expect(rulerStep(5, "gauche", false)).toBe(4);
  });

  it("DROITE bute sur le retrait quand il est paru, sinon sur 10", () => {
    expect(rulerStep(10, "droite", true)).toBe("remove");
    expect(rulerStep("remove", "droite", true)).toBe("remove");
    expect(rulerStep(10, "droite", false)).toBe(10);
  });

  it("GAUCHE bute sur 1, et revient du retrait sur 10", () => {
    expect(rulerStep(1, "gauche", true)).toBe(1);
    expect(rulerStep("remove", "gauche", true)).toBe(10);
  });

  it("HAUT et BAS ne se jouent pas sur l'échelle (les guides des groupes)", () => {
    expect(rulerStep(5, "haut", true)).toBe(5);
    expect(rulerStep(5, "bas", true)).toBe(5);
  });
});
