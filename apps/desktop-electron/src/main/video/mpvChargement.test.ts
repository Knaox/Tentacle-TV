import { describe, expect, it } from "vitest";
import { chargerPremiereDisponible } from "./mpvChargement";

/**
 * Le chargeur à candidates transforme un échec silencieux en repli DIT. Ces
 * tests gardent les trois promesses : la première qui s'ouvre gagne, les
 * écartées sont rendues avec leur cause, et l'échec total nomme chaque chemin.
 */
describe("chargerPremiereDisponible", () => {
  it("retient la première candidate qui s'ouvre, sans rien essayer au-delà", () => {
    const essais: string[] = [];
    const resultat = chargerPremiereDisponible(["/a", "/b"], (chemin) => {
      essais.push(chemin);
      return { chemin };
    });

    expect(resultat.chemin).toBe("/a");
    expect(resultat.ecartes).toEqual([]);
    expect(essais).toEqual(["/a"]);
  });

  it("écarte en notant la cause COURTE, puis retient la suivante", () => {
    const resultat = chargerPremiereDisponible(["/vendoree", "/systeme"], (chemin) => {
      if (chemin === "/vendoree") {
        throw new Error("libbz2.so.1.0: cannot open shared object file\net du bruit derrière");
      }
      return { chemin };
    });

    expect(resultat.chemin).toBe("/systeme");
    expect(resultat.ecartes).toEqual([
      { chemin: "/vendoree", cause: "libbz2.so.1.0: cannot open shared object file" },
    ]);
  });

  it("quand TOUT échoue, le message nomme chaque chemin et sa cause", () => {
    expect(() =>
      chargerPremiereDisponible(["/a", "/b"], (chemin) => {
        throw new Error(`introuvable : ${chemin}`);
      }),
    ).toThrow(/\/a — introuvable : \/a[\s\S]*\/b — introuvable : \/b/);
  });

  it("une liste vide est une erreur, pas un succès muet", () => {
    expect(() => chargerPremiereDisponible([], () => null)).toThrow(/aucune libmpv candidate/);
  });
});
