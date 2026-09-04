import { describe, expect, it } from "vitest";
import { canSwapImmediately } from "./useSettledRecoPage";

const page = (...rows: string[][]) => ({ rows: rows.map((keys) => ({ items: keys.map((key) => ({ key })) })) });

describe("canSwapImmediately", () => {
  it("la première page s'affiche sans attendre", () => {
    expect(canSwapImmediately(undefined, page(["a", "b"]))).toBe(true);
  });
  it("un contenu déjà affiché (retrait, rafraîchissement) s'échange tout de suite", () => {
    expect(canSwapImmediately(page(["a", "b", "c"], ["d"]), page(["a", "c"], ["d"]))).toBe(true);
  });
  it("une affiche nouvelle dans les deux premières rangées fait attendre", () => {
    expect(canSwapImmediately(page(["a", "b"]), page(["a", "z"]))).toBe(false);
    expect(canSwapImmediately(page(["a"]), page(["a"], ["z"]))).toBe(false);
  });
  it("hors fenêtre de préchauffe (3e rangée, 9e affiche), rien à attendre", () => {
    expect(canSwapImmediately(page(["a"]), page(["a"], [], ["z"]))).toBe(true);
    const nine = ["a", "b", "c", "d", "e", "f", "g", "h", "z"];
    expect(canSwapImmediately(page(nine.slice(0, 8)), page(nine))).toBe(true);
  });
});
