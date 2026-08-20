import { describe, expect, it } from "vitest";
import {
  CLES_REGLAGE_APPAREIL,
  creerMagasinBooleen,
  DEFAUT_REGLAGE_APPAREIL,
  type StockageAppareil,
} from "./reglagesAppareil";

/**
 * Les clés et le défaut, tenus par un banc.
 *
 * Ce ne sont pas des détails d'implémentation : cinq cibles écrivent et
 * relisent ces chaînes-là, et le défaut est porté par une COMPARAISON, pas par
 * une valeur stockée. Renommer une clé déconnecterait silencieusement les
 * appareils déjà réglés ; rétablir `=== "true"` éteindrait les trois réglages
 * pour tout le monde sans qu'aucun type ne bronche.
 */

function stockage(initial: Record<string, string> = {}) {
  const contenu = { ...initial };
  const adaptateur: StockageAppareil = {
    getItem: (cle) => (cle in contenu ? contenu[cle] : null),
    setItem: (cle, valeur) => {
      contenu[cle] = valeur;
    },
  };
  return { contenu, adaptateur };
}

describe("les clés de stockage", () => {
  it("sont celles que les cinq cibles se partagent", () => {
    expect(CLES_REGLAGE_APPAREIL).toEqual({
      sautIntroAuto: "tentacle_auto_skip_intro",
      carteASuivre: "tentacle_up_next_card",
      decompteEnchainement: "tentacle_up_next_countdown",
    });
  });

  it("sont toutes distinctes", () => {
    const valeurs = Object.values(CLES_REGLAGE_APPAREIL);
    expect(new Set(valeurs).size).toBe(valeurs.length);
  });
});

describe("le magasin booléen", () => {
  it("part du défaut quand rien n'a été choisi", () => {
    expect(DEFAUT_REGLAGE_APPAREIL).toBe(true);
    for (const cle of Object.values(CLES_REGLAGE_APPAREIL)) {
      expect(creerMagasinBooleen(stockage().adaptateur, cle).lireInstantane()).toBe(true);
    }
  });

  it("n'est éteint que par un refus EXPLICITE", () => {
    const cle = CLES_REGLAGE_APPAREIL.carteASuivre;
    for (const [brut, attendu] of [
      ["false", false],
      ["true", true],
      ["", true],
      ["0", true],
      ["oui", true],
    ] as const) {
      const { adaptateur } = stockage({ [cle]: brut });
      expect(creerMagasinBooleen(adaptateur, cle).lireInstantane()).toBe(attendu);
    }
  });

  it("respecte un défaut à faux quand on le demande", () => {
    const cle = CLES_REGLAGE_APPAREIL.decompteEnchainement;
    expect(creerMagasinBooleen(stockage().adaptateur, cle, false).lireInstantane()).toBe(false);
    const { adaptateur } = stockage({ [cle]: "true" });
    expect(creerMagasinBooleen(adaptateur, cle, false).lireInstantane()).toBe(true);
  });

  it("écrit le choix et prévient ses auditeurs", () => {
    const cle = CLES_REGLAGE_APPAREIL.decompteEnchainement;
    const { contenu, adaptateur } = stockage();
    const magasin = creerMagasinBooleen(adaptateur, cle);
    let appels = 0;
    const desabonner = magasin.sAbonner(() => {
      appels += 1;
    });

    magasin.definir(true); // déjà le défaut → rien à annoncer
    expect(appels).toBe(0);
    expect(contenu[cle]).toBeUndefined();

    magasin.definir(false);
    expect(appels).toBe(1);
    expect(contenu[cle]).toBe("false");
    expect(magasin.lireInstantane()).toBe(false);

    desabonner();
    magasin.definir(true);
    expect(appels).toBe(1);
  });

  it("survit à un stockage qui lève", () => {
    const casse: StockageAppareil = {
      getItem: () => {
        throw new Error("indisponible");
      },
      setItem: () => {
        throw new Error("indisponible");
      },
    };
    const magasin = creerMagasinBooleen(casse, CLES_REGLAGE_APPAREIL.carteASuivre);
    expect(magasin.lireInstantane()).toBe(true);
    magasin.definir(false); // ne doit pas jeter
    expect(magasin.lireInstantane()).toBe(false); // vaut pour la session
  });
});
