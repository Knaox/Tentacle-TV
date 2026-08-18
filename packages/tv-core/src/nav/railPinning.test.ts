import { beforeEach, describe, expect, it, vi } from "vitest";

import { CLE_STOCKAGE_RAIL, creerMagasinEpinglageRail, type StockageRail } from "./railPinning";

function stockageFactice(initial?: string): StockageRail & { contenu: Map<string, string> } {
  const contenu = new Map<string, string>();
  if (initial !== undefined) contenu.set(CLE_STOCKAGE_RAIL, initial);
  return {
    contenu,
    getItem: (c) => contenu.get(c) ?? null,
    setItem: (c, v) => void contenu.set(c, v),
  };
}

describe("le rail montre tout par défaut", () => {
  it("part sans rien de masqué quand le stockage est vide", () => {
    const m = creerMagasinEpinglageRail(stockageFactice());
    expect(m.lireInstantane().masquees).toEqual([]);
  });

  it("montre tout plutôt que rien si le stockage est corrompu", () => {
    // Un rail vide serait le pire cas : plus aucune destination atteignable.
    const m = creerMagasinEpinglageRail(stockageFactice("{ceci n'est pas du JSON"));
    expect(m.lireInstantane().masquees).toEqual([]);
  });

  it("ignore une forme inattendue sans se casser", () => {
    const m = creerMagasinEpinglageRail(stockageFactice('{"masquees":"lib-3"}'));
    expect(m.lireInstantane().masquees).toEqual([]);
  });

  it("relit ce qui avait été masqué", () => {
    const m = creerMagasinEpinglageRail(stockageFactice('{"masquees":["lib-3","favorites"]}'));
    expect(m.estMasquee("lib-3")).toBe(true);
    expect(m.estMasquee("watchlist")).toBe(false);
  });
});

describe("masquer et rétablir", () => {
  let stockage: ReturnType<typeof stockageFactice>;
  let magasin: ReturnType<typeof creerMagasinEpinglageRail>;

  beforeEach(() => {
    stockage = stockageFactice();
    magasin = creerMagasinEpinglageRail(stockage);
  });

  it("bascule une entrée et la persiste", () => {
    magasin.basculer("lib-7");
    expect(magasin.estMasquee("lib-7")).toBe(true);
    expect(JSON.parse(stockage.contenu.get(CLE_STOCKAGE_RAIL)!)).toEqual({ masquees: ["lib-7"] });
  });

  it("rebasculer la fait revenir", () => {
    magasin.basculer("lib-7");
    magasin.basculer("lib-7");
    expect(magasin.estMasquee("lib-7")).toBe(false);
  });

  it("« Tout afficher » vide la liste d'un coup", () => {
    magasin.basculer("lib-1");
    magasin.basculer("lib-2");
    magasin.toutAfficher();
    expect(magasin.lireInstantane().masquees).toEqual([]);
  });

  it("prévient les abonnés à chaque changement", () => {
    const auditeur = vi.fn();
    magasin.sAbonner(auditeur);
    magasin.basculer("lib-1");
    expect(auditeur).toHaveBeenCalledTimes(1);
    magasin.toutAfficher();
    expect(auditeur).toHaveBeenCalledTimes(2);
  });

  it("ne prévient personne quand « Tout afficher » n'a rien à faire", () => {
    // Sans cette garde, chaque rendu du rail rejouerait une écriture et une
    // notification pour rien — sur une dalle, ça se paie.
    const auditeur = vi.fn();
    magasin.sAbonner(auditeur);
    magasin.toutAfficher();
    expect(auditeur).not.toHaveBeenCalled();
  });

  it("se désabonne proprement", () => {
    const auditeur = vi.fn();
    magasin.sAbonner(auditeur)();
    magasin.basculer("lib-1");
    expect(auditeur).not.toHaveBeenCalled();
  });

  it("survit à un stockage en écriture seule cassée", () => {
    // Une dalle en navigation privée, ou un quota atteint : le rail doit
    // continuer de fonctionner pour la session en cours.
    const cassé: StockageRail = {
      getItem: () => null,
      setItem: () => { throw new Error("quota"); },
    };
    const m = creerMagasinEpinglageRail(cassé);
    expect(() => m.basculer("lib-1")).not.toThrow();
    expect(m.estMasquee("lib-1")).toBe(true);
  });
});
