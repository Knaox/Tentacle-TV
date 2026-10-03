import { describe, expect, it } from "vitest";
import { createChoiceEntry } from "./choiceEntry";

const KEYS = ["a", "b", "c", "d"];

describe("le verrou d'entrée d'une liste en Modal", () => {
  it("verrouille tout sauf l'entrée, avant le rendu de la liste", () => {
    const entry = createChoiceEntry();
    expect(entry.enter(KEYS, "c")).toEqual({ unlock: [], lock: ["a", "b", "d"] });
    expect(entry.waiting()).toBe(true);
  });

  it("ne fait rien tant que l'entrée ne change pas", () => {
    const entry = createChoiceEntry();
    entry.enter(KEYS, "c");
    expect(entry.enter(KEYS, "c")).toBeNull();
    expect(entry.enter(["a", "b", "c", "d", "e"], "c")).toBeNull();
  });

  it("une entrée encore inconnue ne verrouille rien", () => {
    const entry = createChoiceEntry();
    expect(entry.enter(KEYS, null)).toBeNull();
    expect(entry.waiting()).toBe(false);
    expect(entry.focused("a")).toBeNull();
    expect(entry.timedOut()).toBeNull();
  });

  it("libère tout au premier focus posé sur l'entrée, une seule fois", () => {
    const entry = createChoiceEntry();
    entry.enter(KEYS, "c");
    expect(entry.focused("a")).toBeNull();
    expect(entry.focused("c")).toEqual(["a", "b", "d"]);
    expect(entry.waiting()).toBe(false);
    expect(entry.focused("c")).toBeNull();
    expect(entry.timedOut()).toBeNull();
  });

  it("libère tout au filet si le premier focus tarde", () => {
    const entry = createChoiceEntry();
    entry.enter(KEYS, "b");
    expect(entry.timedOut()).toEqual(["a", "c", "d"]);
    expect(entry.focused("b")).toBeNull();
  });

  it("verrouille de nouveau à une nouvelle entrée, liste ouverte", () => {
    const entry = createChoiceEntry();
    entry.enter(KEYS, "c");
    entry.focused("c");
    expect(entry.enter(KEYS, "a")).toEqual({ unlock: [], lock: ["b", "c", "d"] });
    expect(entry.waiting()).toBe(true);
    expect(entry.focused("a")).toEqual(["b", "c", "d"]);
  });

  it("une nouvelle entrée avant la libération rend d'abord l'ancien lot", () => {
    const entry = createChoiceEntry();
    entry.enter(KEYS, "c");
    expect(entry.enter(KEYS, "d")).toEqual({ unlock: ["a", "b", "d"], lock: ["a", "b", "c"] });
    expect(entry.focused("c")).toBeNull();
    expect(entry.focused("d")).toEqual(["a", "b", "c"]);
  });

  it("l'entrée retombée à rien rend tout et n'attend plus", () => {
    const entry = createChoiceEntry();
    entry.enter(KEYS, "c");
    expect(entry.enter(KEYS, null)).toEqual({ unlock: ["a", "b", "d"], lock: [] });
    expect(entry.waiting()).toBe(false);
  });
});
