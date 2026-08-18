import { describe, expect, it } from "vitest";
import { decider, tailleDuPas, type EtatDefilement } from "./border";

/**
 * Le défaut que ces tests ferment est passé DEUX FOIS au travers d'une
 * vérification à l'œil : la barre de défilement qui monte puis redescend au
 * bout d'une page. Il ne se voit qu'en tenant compte de la taille du pas, qui
 * dépend de la hauteur de l'élément d'où l'on part — un bouton et une affiche
 * ne donnent pas le même seuil, et c'est ce qui rendait le défaut capricieux.
 */

const VUE = 720;
const MARGE = 96;
const PLAFOND = 0.4;

function etat(partiel: Partial<EtatDefilement>): EtatDefilement {
  return {
    mou: 0,
    hauteurDepart: 48,
    vue: VUE,
    marge: MARGE,
    plafond: PLAFOND,
    seuil: VUE,
    candidatAuDela: false,
    ...partiel,
  };
}

describe("tailleDuPas", () => {
  it("vaut une rangée : la hauteur du départ plus la marge", () => {
    expect(tailleDuPas(48, VUE, MARGE, PLAFOND)).toBe(144);
  });

  it("est plafonnée à une fraction de l'écran", () => {
    // Une affiche de 300 px donnerait un pas de 396 : plus d'un demi-écran, et
    // la fenêtre de recensement glisserait de plusieurs rangées d'un coup.
    expect(tailleDuPas(300, VUE, MARGE, PLAFOND)).toBe(288);
  });
});

describe("decider", () => {
  it("ne fait rien quand il n'y a plus rien à défiler", () => {
    expect(decider(etat({ mou: 0 }))).toEqual({ type: "rien" });
  });

  it("ne fait rien pour une fraction de pixel", () => {
    // Les positions de défilement sont fractionnaires sur un écran mis à
    // l'échelle ; un demi-pixel n'est pas un pas, c'est une oscillation.
    expect(decider(etat({ mou: 0.4 }))).toEqual({ type: "rien" });
  });

  it("accoste en un pas quand le mou tient dedans", () => {
    expect(decider(etat({ mou: 100, candidatAuDela: true }))).toEqual({
      type: "pas",
      pas: 100,
      accoste: true,
    });
  });

  it("ne fait qu'un pas non accosté entre un et deux pas", () => {
    // NON-RÉGRESSION du correctif précédent : c'est le second pas qui accoste,
    // et la révocation ne doit pas se déclencher pour autant.
    const decision = decider(etat({ mou: 250, candidatAuDela: true }));
    expect(decision).toEqual({ type: "pas", pas: 144, accoste: false });
  });

  it("rejoint le bord quand plus rien n'est à viser au-delà", () => {
    // LE DÉFAUT : 284 px de bannière au-dessus du premier élément d'une
    // bibliothèque, un champ de 48 px, donc deux pas de 144 — 288, quatre
    // pixels de trop. Tout était révoqué : la barre montait puis redescendait.
    expect(decider(etat({ mou: 284 }))).toEqual({ type: "bord", delta: 284 });
  });

  it("rejoint le bord même pour un très petit reste", () => {
    expect(decider(etat({ mou: 12 }))).toEqual({ type: "bord", delta: 12 });
  });

  it("ne rejoint JAMAIS le bord tant qu'un candidat existe au-delà", () => {
    // Le garde-fou du banc d'essai : une piste posée plus loin que la fenêtre
    // de recensement doit rester atteignable PAR LES PAS. Sauter au bout de la
    // page la dépasserait, ou la traverserait sans la voir.
    for (const mou of [12, 284, 600]) {
      expect(decider(etat({ mou, candidatAuDela: true })).type).toBe("pas");
    }
  });

  it("ne rejoint jamais le bord au-delà d'un écran de mou", () => {
    // Le garde-fou de la virtualisation : une grille de bibliothèque retire
    // ses rangées du document au-delà de son overscan, et « aucun candidat »
    // y devient vrai à tort. Mais il reste alors des milliers de pixels — le
    // bout d'une vraie page, lui, tient en trois cents.
    const decision = decider(etat({ mou: 1740, seuil: VUE }));
    expect(decision.type).toBe("pas");
    expect(decision).toEqual({ type: "pas", pas: 144, accoste: false });
  });

  it("accepte pile un écran de mou, et refuse un pixel de plus", () => {
    expect(decider(etat({ mou: VUE })).type).toBe("bord");
    expect(decider(etat({ mou: VUE + 1 })).type).toBe("pas");
  });

  it("plafonne le pas depuis une affiche", () => {
    const decision = decider(etat({ mou: 2000, hauteurDepart: 300, candidatAuDela: true }));
    expect(decision).toEqual({ type: "pas", pas: 288, accoste: false });
  });

  it("ne connaît pas les directions : le mou est déjà celui du bon côté", () => {
    // L'appelant mesure `pageYOffset` vers le haut et le reste vers le bas ;
    // le module ne voit qu'un nombre positif, donc les deux sens partagent la
    // même règle et il n'y a pas de symétrie à tester séparément.
    const haut = decider(etat({ mou: 284 }));
    const bas = decider(etat({ mou: 284 }));
    expect(haut).toEqual(bas);
  });
});
