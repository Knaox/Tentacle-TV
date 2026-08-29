import { describe, expect, it } from "vitest";
import { correction, type Segment } from "./framing";

/**
 * Le cadrage décide de tout ce qu'on voit bouger. Ces cas sont ceux qu'on ne
 * reproduit pas à la main : un élément à cheval sur le bord, un élément plus
 * haut que la vue, une surcouche trop courte pour la marge qu'on demande.
 */

const MARGIN = 96;
const VIEW: Segment = { start: 0, end: 720 };

function segment(start: number, size: number): Segment {
  return { start, end: start + size };
}

describe("correction", () => {
  it("ne bouge pas ce qui est déjà cadré", () => {
    expect(correction(segment(200, 100), VIEW, MARGIN)).toBe(0);
  });

  it("ne bouge pas ce qui affleure exactement la marge", () => {
    expect(correction(segment(96, 100), VIEW, MARGIN)).toBe(0);
    expect(correction(segment(524, 100), VIEW, MARGIN)).toBe(0);
  });

  it("descend ce qui déborde en haut, jusqu'à la marge et pas au-delà", () => {
    // Le cas du symptôme : une ligne d'épisode qui affleure le haut de l'écran.
    // Chrome 53 la RECENTRAIT — un demi-écran pour un appui qui demandait 101 px.
    const line = segment(-5, 100);
    const delta = correction(line, VIEW, MARGIN);
    expect(delta).toBe(-101);
    expect(line.start - delta).toBe(MARGIN);
  });

  it("remonte ce qui déborde en bas, jusqu'à la marge et pas au-delà", () => {
    const line = segment(700, 100);
    const delta = correction(line, VIEW, MARGIN);
    expect(delta).toBe(176);
    expect(line.end - delta).toBe(VIEW.end - MARGIN);
  });

  it("aligne le début de ce qui est plus grand que la vue", () => {
    // Une bannière plein écran : la marge n'a plus de sens des deux côtés, et
    // corriger les deux bords tour à tour ferait osciller le focus.
    const banner = segment(-50, 950);
    expect(correction(banner, VIEW, MARGIN)).toBe(-50);
  });

  it("centre dans une vue trop courte pour la marge demandée", () => {
    // Un panneau de choix de trois lignes : deux fois 96 px valent plus que sa
    // hauteur. La marge se ramène à ce que la vue peut offrir.
    const short: Segment = { start: 0, end: 200 };
    const line = segment(10, 50);
    const delta = correction(line, short, MARGIN);
    expect(line.start - delta).toBe(75);
    expect(short.end - (line.end - delta)).toBe(75);
  });

  it("est stable : corriger deux fois ne bouge plus", () => {
    // La garantie qui compte à l'usage — sans elle, maintenir une flèche fait
    // vibrer la page.
    const cases: Segment[] = [segment(-5, 100), segment(700, 100), segment(10, 50)];
    for (const element of cases) {
      const delta = correction(element, VIEW, MARGIN);
      const after = { start: element.start - delta, end: element.end - delta };
      expect(correction(after, VIEW, MARGIN)).toBe(0);
    }
  });

  it("traite un axe horizontal comme un axe vertical", () => {
    // Le module ne connaît pas les axes : une piste qui défile latéralement
    // pose exactement la même question.
    const view: Segment = { start: 154, end: 1280 };
    const card = segment(1200, 200);
    const delta = correction(card, view, MARGIN);
    expect(card.end - delta).toBe(view.end - MARGIN);
  });
});

describe("correction avec le mou — les bords du document", () => {
  it("colle au début quand le reliquat tiendrait dans la marge", () => {
    // Le défaut d'usage : la bannière au-dessus du premier focusable restait
    // coupée de 40 px, quel que soit le nombre d'appuis vers le haut. Si
    // corriger laisse moins d'une marge à défiler, autant tout rendre.
    const line = segment(-5, 100);
    expect(correction(line, VIEW, MARGIN, { before: 150, after: 5000 })).toBe(-150);
  });

  it("ne colle pas quand il reste plus d'une marge à défiler", () => {
    const line = segment(-5, 100);
    expect(correction(line, VIEW, MARGIN, { before: 400, after: 5000 })).toBe(-101);
  });

  it("se borne au mou disponible", () => {
    // Écrire plus loin serait clampé par le navigateur — un état qu'on
    // n'aurait pas calculé, et le clamp vaut collage : mou consommé.
    const line = segment(-5, 100);
    expect(correction(line, VIEW, MARGIN, { before: 60, after: 5000 })).toBe(-60);
  });

  it("colle à la fin, symétriquement", () => {
    const line = segment(700, 100);
    expect(correction(line, VIEW, MARGIN, { before: 5000, after: 200 })).toBe(200);
    expect(correction(line, VIEW, MARGIN, { before: 5000, after: 400 })).toBe(176);
    expect(correction(line, VIEW, MARGIN, { before: 5000, after: 100 })).toBe(100);
  });

  it("ne s'arme jamais sans correction : un élément cadré ne colle pas", () => {
    // L'invariant du moteur : la page ne défile pas sans que le focus bouge.
    // L'accrochage n'est qu'un prolongement d'une correction déjà décidée.
    expect(correction(segment(200, 100), VIEW, MARGIN, { before: 50, after: 50 })).toBe(0);
  });

  it("est stable après un collage", () => {
    // Une fois au bord, le mou de ce côté est nul : corriger encore rend zéro.
    const line = segment(-5, 100);
    const delta = correction(line, VIEW, MARGIN, { before: 150, after: 5000 });
    const after = { start: line.start - delta, end: line.end - delta };
    expect(correction(after, VIEW, MARGIN, { before: 0, after: 5150 })).toBe(0);
  });

  it("laisse le comportement historique sans mou", () => {
    expect(correction(segment(-5, 100), VIEW, MARGIN)).toBe(-101);
    expect(correction(segment(700, 100), VIEW, MARGIN)).toBe(176);
  });
});
