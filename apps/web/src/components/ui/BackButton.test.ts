import { describe, expect, it } from "vitest";

import { hasHistoryBehind } from "./BackButton";

describe("le bouton Retour : y a-t-il une page derrière ?", () => {
  it("oui dès la deuxième page de l'application", () => {
    expect(hasHistoryBehind({ idx: 1 })).toBe(true);
    expect(hasHistoryBehind({ idx: 7, key: "x" })).toBe(true);
  });

  it("non sur la première (lien direct, favori, rechargement) : le repli prend le relais", () => {
    expect(hasHistoryBehind({ idx: 0 })).toBe(false);
    expect(hasHistoryBehind(null)).toBe(false);
    expect(hasHistoryBehind({})).toBe(false);
    expect(hasHistoryBehind({ idx: "2" })).toBe(false);
  });
});
