import { describe, expect, it } from "vitest";
import { mergeOrder, movedKeys, withOccurrences, withoutOccurrence } from "./orderMerge";

const s = (text: string) => text.split("");

describe("movedKeys", () => {
  it("un titre glissé est le seul déplacé", () => {
    expect([...movedKeys(s("abcde"), s("adbce"))]).toEqual(["d"]);
  });
  it("une clé absente de la base compte comme déplacée", () => {
    expect([...movedKeys(s("abc"), s("xabc"))]).toEqual(["x"]);
  });
  it("rien de déplacé : vide", () => {
    expect(movedKeys(s("abc"), s("abc")).size).toBe(0);
  });
});

describe("mergeOrder", () => {
  it("sans geste concurrent : exactement l'ordre local", () => {
    expect(mergeOrder(s("abcde"), s("eadbc"), s("abcde"))).toEqual(s("eadbc"));
  });
  it("un titre ajouté ailleurs reste à sa place", () => {
    expect(mergeOrder(s("abcd"), s("dabc"), s("abxcd"))).toEqual(s("dabxc"));
  });
  it("un titre retiré ailleurs ne revient pas", () => {
    expect(mergeOrder(s("abcd"), s("dabc"), s("acd"))).toEqual(s("dac"));
  });
  it("un réordonnancement fait ailleurs sur des titres non touchés est gardé", () => {
    // Ici : « e » mis en tête hors ligne ; ailleurs, « b » et « c » échangés.
    expect(mergeOrder(s("abcde"), s("eabcd"), s("acbde"))).toEqual(s("eacbd"));
  });
  it("le même titre déplacé des deux côtés : la place choisie hors ligne gagne", () => {
    expect(mergeOrder(s("abcd"), s("dabc"), s("adbc"))).toEqual(s("dabc"));
  });
  it("plusieurs titres déplacés gardent leur ordre relatif local", () => {
    expect(mergeOrder(s("abcdef"), s("fedabc"), s("abcdef"))).toEqual(s("fedabc"));
  });
  it("un titre déplacé dont le prédécesseur local a disparu se pose après le précédent qui reste", () => {
    expect(mergeOrder(s("abcd"), s("bdac"), s("abc"))).toEqual(s("bac"));
  });
  it("union : une clé que le serveur ne cite pas n'est pas retirée", () => {
    expect(mergeOrder(s("abcd"), s("dabc"), s("ab"), "union")).toEqual(s("dabc"));
  });
  it("union : l'ordre personnalisé du serveur, partiel, prend le geste local", () => {
    expect(mergeOrder(s("abcd"), s("cabd"), s("ba"), "union")).toEqual(s("cbad"));
  });
  it("tient de longues listes", () => {
    const base = Array.from({ length: 5000 }, (_, i) => `k${i}`);
    const local = [...base].reverse();
    expect(mergeOrder(base, local, base)).toEqual(local);
  });
});

describe("withOccurrences", () => {
  it("distingue les doublons et se défait", () => {
    const keys = withOccurrences(["a", "b", "a"]);
    expect(keys[0]).toBe("a");
    expect(keys[2]).not.toBe("a");
    expect(keys.map(withoutOccurrence)).toEqual(["a", "b", "a"]);
  });
});
