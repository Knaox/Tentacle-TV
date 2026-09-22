import { describe, expect, it } from "vitest";
import { leftmostVisible, type TrackCard } from "./trackEntry";

/** Une carte factice de 200 de large posée à `left`. */
function card(name: string, left: number, width = 200): TrackCard {
  return { element: { id: name } as unknown as HTMLElement, box: { left, right: left + width, top: 0, bottom: 300 } };
}

const VIEW = { left: 100, right: 1800 };

describe("entrée d'une piste", () => {
  it("vise la première carte d'une piste jamais parcourue", () => {
    const cards = [card("a", 150), card("b", 370), card("c", 590)];
    expect(leftmostVisible(cards, VIEW)).toBe(cards[0].element);
  });

  it("ignore la carte coupée au bord gauche d'une piste qu'on a fait défiler", () => {
    // « a » dépasse à gauche de la fenêtre : on entre par « b », la première
    // que la piste montre en entier — pas par celle que l'abscisse désignerait.
    const cards = [card("a", 20), card("b", 240), card("c", 460)];
    expect(leftmostVisible(cards, VIEW)).toBe(cards[1].element);
  });

  it("n'est pas trompée par l'ordre du recensement", () => {
    const cards = [card("c", 590), card("a", 150), card("b", 370)];
    expect(leftmostVisible(cards, VIEW)).toBe(cards[1].element);
  });

  it("accepte un bord à un pixel près", () => {
    const cards = [card("a", 99.5), card("b", 320)];
    expect(leftmostVisible(cards, VIEW)).toBe(cards[0].element);
  });

  it("se rabat sur la carte la plus visible quand aucune ne tient entière", () => {
    // « a » en montre 120, « b » 70 : aucune n'est entière, « a » l'emporte.
    const narrow = { left: 100, right: 250 };
    const cards = [card("a", 20), card("b", 180)];
    expect(leftmostVisible(cards, narrow)).toBe(cards[0].element);
  });

  it("ne rend rien d'une piste vide", () => {
    expect(leftmostVisible([], VIEW)).toBeNull();
  });
});
