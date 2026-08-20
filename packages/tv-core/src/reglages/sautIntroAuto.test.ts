import { describe, expect, it } from "vitest";
import { CLE_SAUT_INTRO_AUTO, creerMagasinSautIntro, type StockageSautIntro } from "./sautIntroAuto";

/**
 * Le défaut de « passer l'intro automatiquement », et sa frontière.
 *
 * Ce banc existe pour une raison précise : le défaut est porté par une
 * COMPARAISON, `!== "false"`, et non par une valeur écrite quelque part. Rien
 * dans le stockage ne dit « allumé » — c'est l'absence de refus qui l'allume.
 * Une relecture distraite qui rétablirait `=== "true"` éteindrait le réglage
 * pour tout le monde sans qu'aucun type ne bronche.
 */

function stockage(initial: Record<string, string> = {}): StockageSautIntro & {
  contenu: Record<string, string>;
} {
  const contenu = { ...initial };
  return {
    contenu,
    getItem: (cle) => (cle in contenu ? contenu[cle] : null),
    setItem: (cle, valeur) => {
      contenu[cle] = valeur;
    },
  };
}

describe("le défaut de saut d'intro", () => {
  it("est ALLUMÉ quand rien n'a jamais été choisi", () => {
    expect(creerMagasinSautIntro(stockage()).lireInstantane()).toBe(true);
  });

  it("reste allumé si le stockage est illisible", () => {
    const cassé: StockageSautIntro = {
      getItem: () => {
        throw new Error("stockage indisponible");
      },
      setItem: () => {},
    };
    expect(creerMagasinSautIntro(cassé).lireInstantane()).toBe(true);
  });

  it("respecte un refus explicite", () => {
    const s = stockage({ [CLE_SAUT_INTRO_AUTO]: "false" });
    expect(creerMagasinSautIntro(s).lireInstantane()).toBe(false);
  });

  it("respecte un accord explicite", () => {
    const s = stockage({ [CLE_SAUT_INTRO_AUTO]: "true" });
    expect(creerMagasinSautIntro(s).lireInstantane()).toBe(true);
  });
});

describe("le magasin", () => {
  it("écrit le refus, pour qu'il survive au redémarrage", () => {
    const s = stockage();
    const magasin = creerMagasinSautIntro(s);
    magasin.definir(false);
    expect(s.contenu[CLE_SAUT_INTRO_AUTO]).toBe("false");
    expect(creerMagasinSautIntro(s).lireInstantane()).toBe(false);
  });

  it("prévient ses auditeurs, et seulement quand la valeur change", () => {
    const magasin = creerMagasinSautIntro(stockage());
    let appels = 0;
    magasin.sAbonner(() => {
      appels += 1;
    });
    magasin.definir(true); // déjà la valeur par défaut → rien à annoncer
    expect(appels).toBe(0);
    magasin.definir(false);
    expect(appels).toBe(1);
  });

  it("réhydrate depuis un cache rempli après coup (Android TV)", () => {
    const s = stockage();
    const magasin = creerMagasinSautIntro(s);
    expect(magasin.lireInstantane()).toBe(true);
    // `hydrate()` a fini : le refus de l'utilisateur apparaît enfin.
    s.contenu[CLE_SAUT_INTRO_AUTO] = "false";
    magasin.rehydrater();
    expect(magasin.lireInstantane()).toBe(false);
  });
});
