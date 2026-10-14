import { describe, expect, it } from "vitest";
import { setHoverCompanion, withinHoverCompanion } from "./hoverCompanion";

/**
 * Le compagnon d'un survol : le pointeur posé sur la mini-carte d'aperçu (un
 * portail) n'a quitté ni sa carte ni sa rangée. De faux éléments suffisent :
 * seul `contains` est lu.
 */
const node = (...inside: object[]) => {
  const self = { contains: (other: object) => other === self || inside.includes(other) };
  return self as unknown as Element;
};

describe("hoverCompanion", () => {
  const anchor = node();
  const card = node(anchor);
  const row = node(card, anchor);
  const button = node();
  const preview = node(button);
  const elsewhere = node();

  it("compte le compagnon comme la carte qui l'a ouvert, et comme sa rangée", () => {
    const release = setHoverCompanion(anchor, preview);
    expect(withinHoverCompanion(card, button)).toBe(true);
    expect(withinHoverCompanion(row, preview)).toBe(true);
    expect(withinHoverCompanion(elsewhere, button)).toBe(false);
    expect(withinHoverCompanion(card, elsewhere)).toBe(false);
    release();
    expect(withinHoverCompanion(card, button)).toBe(false);
  });

  it("le retrait d'un ancien compagnon n'efface pas celui qui l'a remplacé", () => {
    const releaseOld = setHoverCompanion(anchor, preview);
    const other = node();
    const otherCard = node(other);
    const releaseNew = setHoverCompanion(other, preview);
    releaseOld();
    expect(withinHoverCompanion(otherCard, button)).toBe(true);
    releaseNew();
    expect(withinHoverCompanion(otherCard, button)).toBe(false);
  });
});
