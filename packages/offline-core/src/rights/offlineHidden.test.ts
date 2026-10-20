import { describe, expect, it } from "vitest";
import {
  applyOfflineVerdict,
  isOfflineHidden,
  parseOfflineHidden,
  sameOfflineHidden,
  withoutOfflineHidden,
} from "./offlineHidden";

/**
 * Un titre gardé avant le retrait d'un droit ne se lit plus ; le droit revenu,
 * il revient. Le dernier verdict fait foi hors ligne, par identité.
 */

const PULP = "BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB";
const TOY = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const entries = [{ itemId: TOY, name: "Toy Story" }, { itemId: PULP.toLowerCase(), name: "Pulp Fiction" }];

describe("offlineHidden", () => {
  it("un titre jugé caché quitte la liste de CETTE identité seulement", () => {
    const map = applyOfflineVerdict({}, "Membre-1", { visible: [TOY], hidden: [PULP], gone: [] });
    expect(withoutOfflineHidden(map, "membre1", entries).map((e) => e.name)).toEqual(["Toy Story"]);
    expect(isOfflineHidden(map, "membre1", PULP)).toBe(true);
    expect(withoutOfflineHidden(map, "autre", entries)).toHaveLength(2);
    expect(isOfflineHidden(map, null, PULP)).toBe(false);
  });

  it("le droit revenu : le verdict suivant le rend", () => {
    const hidden = applyOfflineVerdict({}, "m", { visible: [], hidden: [PULP], gone: [] });
    const back = applyOfflineVerdict(hidden, "m", { visible: [PULP], hidden: [], gone: [] });
    expect(back).toEqual({});
    expect(withoutOfflineHidden(back, "m", entries)).toHaveLength(2);
  });

  it("le stockage relu survit au redémarrage hors ligne ; illisible = carte vide", () => {
    const map = applyOfflineVerdict({}, "m", { visible: [], hidden: [PULP, PULP], gone: [] });
    const stored = parseOfflineHidden(JSON.stringify(map));
    expect(isOfflineHidden(stored, "M", PULP)).toBe(true);
    expect(parseOfflineHidden("{oops")).toEqual({});
    expect(parseOfflineHidden(JSON.stringify([1]))).toEqual({});
    expect(parseOfflineHidden(null)).toEqual({});
  });

  it("compare deux cartes", () => {
    const a = applyOfflineVerdict({}, "m", { visible: [], hidden: [PULP], gone: [] });
    expect(sameOfflineHidden(a, parseOfflineHidden(JSON.stringify(a)))).toBe(true);
    expect(sameOfflineHidden(a, {})).toBe(false);
  });
});
