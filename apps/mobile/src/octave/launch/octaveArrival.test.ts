import { describe, expect, it, vi } from "vitest";
import { clearTentacleAbove, isOctaveLink, rootBaseState } from "./octaveArrival";

/** Un lien d'Octave reçu dans Tentacle : Octave arrive sur la base, jamais dans une modale de Tentacle. */
describe("arrivée d'un lien d'Octave, app ouverte", () => {
  const stack = (names: string[], index = names.length - 1) => ({ key: "root-1", index, routes: names.map((name) => ({ name })) });

  it("reconnaît les chemins d'Octave, et eux seuls", () => {
    expect(isOctaveLink("octave/import?shared=x")).toBe(true);
    expect(isOctaveLink("/octave/search?q=x")).toBe(true);
    expect(isOctaveLink("tentacle://octave/import")).toBe(true);
    expect(isOctaveLink("/octave")).toBe(true);
    expect(isOctaveLink("/octaves")).toBe(false);
    expect(isOctaveLink("/media/123")).toBe(false);
  });

  it("la recherche de Tentacle (modale) ouverte : la pile revient à l'accueil", () => {
    expect(rootBaseState(stack(["(tabs)", "search"]))).toEqual(stack(["(tabs)"], 0));
    expect(rootBaseState(stack(["(tabs)", "media/[itemId]", "watch/[itemId]"]))).toEqual(stack(["(tabs)"], 0));
  });

  it("rien d'empilé, ou déjà dans Octave : rien", () => {
    expect(rootBaseState(stack(["(tabs)"]))).toBeNull();
    expect(rootBaseState(stack(["(tabs)", "octave"]))).toBeNull();
  });

  it("le geste vise la pile de la racine (sous `__root`), une fois la navigation prête", () => {
    const dispatch = vi.fn();
    const ref = { isReady: () => true, getRootState: () => ({ routes: [{ state: stack(["(tabs)", "search"]) }] }), dispatch };
    clearTentacleAbove(ref);
    expect(dispatch).toHaveBeenCalledWith({ type: "RESET", payload: stack(["(tabs)"], 0), target: "root-1" });
    dispatch.mockClear();
    clearTentacleAbove({ ...ref, isReady: () => false });
    expect(dispatch).not.toHaveBeenCalled();
  });
});
