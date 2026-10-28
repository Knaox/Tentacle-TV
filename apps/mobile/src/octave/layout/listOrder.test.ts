import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { listOrderIdentity } from "./listOrder";

describe("identité d'un ordre de cartes", () => {
  it("un même ordre garde la même rangée, contenu rafraîchi compris", () => {
    expect(listOrderIdentity(["jf:a", "jf:b", "jf:c"])).toBe(listOrderIdentity(["jf:a", "jf:b", "jf:c"]));
  });

  it("un ordre changé (l'album écouté remonte en tête) donne une rangée neuve", () => {
    const before = listOrderIdentity(["jf:a", "jf:b", "jf:c"]);
    expect(listOrderIdentity(["jf:c", "jf:a", "jf:b"])).not.toBe(before);
    expect(listOrderIdentity(["jf:d", "jf:a", "jf:b", "jf:c"])).not.toBe(before);
    expect(listOrderIdentity(["jf:a", "jf:b"])).not.toBe(before);
  });

  it("deux découpes différentes des mêmes caractères ne se confondent pas", () => {
    expect(listOrderIdentity(["jf:ab", "jf:c"])).not.toBe(listOrderIdentity(["jf:a", "bjf:c"]));
  });

  it("l'étagère d'Octave tire la clé de sa rangée de l'ordre de ses cartes", () => {
    // Garde : sans cette clé, un réordonnancement déplace des cellules en pleine entrée (cartes invisibles).
    const shelf = readFileSync(fileURLToPath(new URL("../pages/ui/Shelf.tsx", import.meta.url)), "utf8");
    expect(shelf).toMatch(/<FlatList\s+key=\{order\}/);
    expect(shelf).toMatch(/listOrderIdentity\(items\.map\(\(item\) => keyOf\(item\)\)\)/);
  });
});
