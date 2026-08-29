import { describe, expect, it } from "vitest";
import { loadFirstAvailable } from "./mpvLoad";

/**
 * Le chargeur à candidates transforme un échec silencieux en repli DIT. Ces
 * tests gardent les trois promesses : la première qui s'ouvre gagne, les
 * écartées sont rendues avec leur cause, et l'échec total nomme chaque chemin.
 */
describe("chargerPremiereDisponible", () => {
  it("retient la première candidate qui s'ouvre, sans rien essayer au-delà", () => {
    const tries: string[] = [];
    const result = loadFirstAvailable(["/a", "/b"], (path) => {
      tries.push(path);
      return { path };
    });

    expect(result.path).toBe("/a");
    expect(result.skipped).toEqual([]);
    expect(tries).toEqual(["/a"]);
  });

  it("écarte en notant la cause COURTE, puis retient la suivante", () => {
    const result = loadFirstAvailable(["/vendoree", "/systeme"], (path) => {
      if (path === "/vendoree") {
        throw new Error("libbz2.so.1.0: cannot open shared object file\net du bruit derrière");
      }
      return { path };
    });

    expect(result.path).toBe("/systeme");
    expect(result.skipped).toEqual([
      { path: "/vendoree", cause: "libbz2.so.1.0: cannot open shared object file" },
    ]);
  });

  it("quand TOUT échoue, le message nomme chaque chemin et sa cause", () => {
    expect(() =>
      loadFirstAvailable(["/a", "/b"], (path) => {
        throw new Error(`introuvable : ${path}`);
      }),
    ).toThrow(/\/a — introuvable : \/a[\s\S]*\/b — introuvable : \/b/);
  });

  it("une liste vide est une erreur, pas un succès muet", () => {
    expect(() => loadFirstAvailable([], () => null)).toThrow(/aucune libmpv candidate/);
  });
});
