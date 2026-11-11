import { afterEach, describe, expect, it, vi } from "vitest";
import { lastInputWasKeyboard, setInputModalityForTests } from "./inputModality";

/**
 * La modalité d'entrée se lit en JavaScript (`lastInputWasKeyboard`) ET dans la feuille de
 * style (`<html data-input="keyboard">`, lu par `overlays.css`) : les deux disent la même chose.
 */
describe("inputModality", () => {
  afterEach(() => {
    setInputModalityForTests("pointer");
    vi.unstubAllGlobals();
  });

  function stubRoot() {
    const root = { setAttribute: vi.fn(), removeAttribute: vi.fn() };
    vi.stubGlobal("document", { documentElement: root });
    return root;
  }

  it("pose l'attribut au clavier, le retire au pointeur", () => {
    const root = stubRoot();
    setInputModalityForTests("keyboard");
    expect(lastInputWasKeyboard()).toBe(true);
    expect(root.setAttribute).toHaveBeenCalledWith("data-input", "keyboard");

    setInputModalityForTests("pointer");
    expect(lastInputWasKeyboard()).toBe(false);
    expect(root.removeAttribute).toHaveBeenCalledWith("data-input");
  });

  it("n'écrit rien tant que la modalité ne change pas", () => {
    const root = stubRoot();
    setInputModalityForTests("keyboard");
    setInputModalityForTests("keyboard");
    setInputModalityForTests("keyboard");
    expect(root.setAttribute).toHaveBeenCalledTimes(1);
  });
});
