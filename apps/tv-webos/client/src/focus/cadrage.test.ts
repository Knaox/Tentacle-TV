import { describe, expect, it } from "vitest";
import { correction, type Segment } from "./cadrage";

/**
 * Le cadrage décide de tout ce qu'on voit bouger. Ces cas sont ceux qu'on ne
 * reproduit pas à la main : un élément à cheval sur le bord, un élément plus
 * haut que la vue, une surcouche trop courte pour la marge qu'on demande.
 */

const MARGE = 96;
const VUE: Segment = { debut: 0, fin: 720 };

function segment(debut: number, taille: number): Segment {
  return { debut, fin: debut + taille };
}

describe("correction", () => {
  it("ne bouge pas ce qui est déjà cadré", () => {
    expect(correction(segment(200, 100), VUE, MARGE)).toBe(0);
  });

  it("ne bouge pas ce qui affleure exactement la marge", () => {
    expect(correction(segment(96, 100), VUE, MARGE)).toBe(0);
    expect(correction(segment(524, 100), VUE, MARGE)).toBe(0);
  });

  it("descend ce qui déborde en haut, jusqu'à la marge et pas au-delà", () => {
    // Le cas du symptôme : une ligne d'épisode qui affleure le haut de l'écran.
    // Chrome 53 la RECENTRAIT — un demi-écran pour un appui qui demandait 101 px.
    const ligne = segment(-5, 100);
    const delta = correction(ligne, VUE, MARGE);
    expect(delta).toBe(-101);
    expect(ligne.debut - delta).toBe(MARGE);
  });

  it("remonte ce qui déborde en bas, jusqu'à la marge et pas au-delà", () => {
    const ligne = segment(700, 100);
    const delta = correction(ligne, VUE, MARGE);
    expect(delta).toBe(176);
    expect(ligne.fin - delta).toBe(VUE.fin - MARGE);
  });

  it("aligne le début de ce qui est plus grand que la vue", () => {
    // Une bannière plein écran : la marge n'a plus de sens des deux côtés, et
    // corriger les deux bords tour à tour ferait osciller le focus.
    const banniere = segment(-50, 950);
    expect(correction(banniere, VUE, MARGE)).toBe(-50);
  });

  it("centre dans une vue trop courte pour la marge demandée", () => {
    // Un panneau de choix de trois lignes : deux fois 96 px valent plus que sa
    // hauteur. La marge se ramène à ce que la vue peut offrir.
    const courte: Segment = { debut: 0, fin: 200 };
    const ligne = segment(10, 50);
    const delta = correction(ligne, courte, MARGE);
    expect(ligne.debut - delta).toBe(75);
    expect(courte.fin - (ligne.fin - delta)).toBe(75);
  });

  it("est stable : corriger deux fois ne bouge plus", () => {
    // La garantie qui compte à l'usage — sans elle, maintenir une flèche fait
    // vibrer la page.
    const cas: Segment[] = [segment(-5, 100), segment(700, 100), segment(10, 50)];
    for (const element of cas) {
      const delta = correction(element, VUE, MARGE);
      const apres = { debut: element.debut - delta, fin: element.fin - delta };
      expect(correction(apres, VUE, MARGE)).toBe(0);
    }
  });

  it("traite un axe horizontal comme un axe vertical", () => {
    // Le module ne connaît pas les axes : une piste qui défile latéralement
    // pose exactement la même question.
    const vue: Segment = { debut: 154, fin: 1280 };
    const carte = segment(1200, 200);
    const delta = correction(carte, vue, MARGE);
    expect(carte.fin - delta).toBe(vue.fin - MARGE);
  });
});

describe("correction avec le mou — les bords du document", () => {
  it("colle au début quand le reliquat tiendrait dans la marge", () => {
    // Le défaut d'usage : la bannière au-dessus du premier focusable restait
    // coupée de 40 px, quel que soit le nombre d'appuis vers le haut. Si
    // corriger laisse moins d'une marge à défiler, autant tout rendre.
    const ligne = segment(-5, 100);
    expect(correction(ligne, VUE, MARGE, { avant: 150, apres: 5000 })).toBe(-150);
  });

  it("ne colle pas quand il reste plus d'une marge à défiler", () => {
    const ligne = segment(-5, 100);
    expect(correction(ligne, VUE, MARGE, { avant: 400, apres: 5000 })).toBe(-101);
  });

  it("se borne au mou disponible", () => {
    // Écrire plus loin serait clampé par le navigateur — un état qu'on
    // n'aurait pas calculé, et le clamp vaut collage : mou consommé.
    const ligne = segment(-5, 100);
    expect(correction(ligne, VUE, MARGE, { avant: 60, apres: 5000 })).toBe(-60);
  });

  it("colle à la fin, symétriquement", () => {
    const ligne = segment(700, 100);
    expect(correction(ligne, VUE, MARGE, { avant: 5000, apres: 200 })).toBe(200);
    expect(correction(ligne, VUE, MARGE, { avant: 5000, apres: 400 })).toBe(176);
    expect(correction(ligne, VUE, MARGE, { avant: 5000, apres: 100 })).toBe(100);
  });

  it("ne s'arme jamais sans correction : un élément cadré ne colle pas", () => {
    // L'invariant du moteur : la page ne défile pas sans que le focus bouge.
    // L'accrochage n'est qu'un prolongement d'une correction déjà décidée.
    expect(correction(segment(200, 100), VUE, MARGE, { avant: 50, apres: 50 })).toBe(0);
  });

  it("est stable après un collage", () => {
    // Une fois au bord, le mou de ce côté est nul : corriger encore rend zéro.
    const ligne = segment(-5, 100);
    const delta = correction(ligne, VUE, MARGE, { avant: 150, apres: 5000 });
    const apres = { debut: ligne.debut - delta, fin: ligne.fin - delta };
    expect(correction(apres, VUE, MARGE, { avant: 0, apres: 5150 })).toBe(0);
  });

  it("laisse le comportement historique sans mou", () => {
    expect(correction(segment(-5, 100), VUE, MARGE)).toBe(-101);
    expect(correction(segment(700, 100), VUE, MARGE)).toBe(176);
  });
});
