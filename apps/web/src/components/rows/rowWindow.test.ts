import { describe, expect, it } from "vitest";
import { rowTrackWidth, rowWindow, type RowWindowInput } from "./rowWindow";

/**
 * Fenêtrage d'une rangée.
 *
 * L'invariant que ces tests figent tient tout le chantier : la piste doit faire
 * EXACTEMENT la même largeur avec ou sans fenêtrage. Si elle n'y tient pas, ce
 * n'est pas une carte mal placée que l'on voit, c'est la barre de défilement qui
 * change de course et le `scrollLeft` qui saute d'une fenêtre à l'autre — un
 * défaut qui ne se remarque qu'en défilant, donc au pire moment.
 *
 * Mesures réelles d'une rangée d'affiches en 1440 × 900 : gouttière de 56 px,
 * `gap-3` = 12 px, six cartes de 211,33 px remplissant exactement la zone.
 */
const BASE: RowWindowInput = {
  scrollLeft: 0,
  clientWidth: 1440,
  paddingLeft: 56,
  cardWidth: 211.33,
  gap: 12,
  count: 20,
  overscan: 3,
};

const at = (over: Partial<RowWindowInput> = {}): RowWindowInput => ({ ...BASE, ...over });

/**
 * Largeur réellement occupée par les enfants du scroller : les deux cales, les
 * cartes rendues, et une gouttière entre chaque paire d'enfants adjacents —
 * exactement ce que fait un conteneur `flex` avec `gap`.
 */
function largeurRendue(input: RowWindowInput): number {
  const r = rowWindow(input);
  const cartes = Math.max(0, r.end - r.start + 1);
  const enfants = cartes + (r.padStart > 0 ? 1 : 0) + (r.padEnd > 0 ? 1 : 0);
  return (
    r.padStart + r.padEnd + cartes * input.cardWidth + Math.max(0, enfants - 1) * input.gap
  );
}

describe("la piste garde sa largeur, quelle que soit la fenêtre", () => {
  it("au repos, au milieu, au bout, et rangée vidée", () => {
    // 20 × (211,33 + 12) − 12.
    expect(rowTrackWidth(BASE.count, BASE.cardWidth, BASE.gap)).toBeCloseTo(4454.6, 2);

    for (const input of [
      at(),
      at({ scrollLeft: 900 }),
      at({ scrollLeft: 2400 }),
      at({ scrollLeft: 4454.6 - 1440 }), // dernière carte contre le bord droit
      at({ vacant: true }),
      at({ vacant: true, scrollLeft: 900 }),
      at({ scrollLeft: 900, pinned: 0 }),
      at({ overscan: 0 }),
      at({ count: 7 }), // toutes les cartes tiennent : aucune cale
    ]) {
      expect(largeurRendue(input)).toBeCloseTo(
        rowTrackWidth(input.count, input.cardWidth, input.gap),
        6,
      );
    }
  });

  it("place la première carte rendue exactement là où elle serait sans fenêtrage", () => {
    const step = BASE.cardWidth + BASE.gap;
    for (const scrollLeft of [0, 500, 1200, 3000]) {
      const r = rowWindow(at({ scrollLeft }));
      // Décalage de la carte `start` = cale + la gouttière qui la suit.
      const decalage = r.padStart > 0 ? r.padStart + BASE.gap : 0;
      expect(decalage).toBeCloseTo(r.start * step, 6);
    }
  });
});

describe("la fenêtre couvre ce qui est visible", () => {
  it("englobe les cartes à l'écran, plus l'overscan", () => {
    // Zone de contenu de 1384 px → six cartes visibles (0 à 5).
    const r = rowWindow(at());
    expect(r.start).toBe(0);
    expect(r.end).toBeGreaterThanOrEqual(5 + 3);
    expect(r.padStart).toBe(0);
  });

  it("ne rend rien hors de la plage, mais garde les deux bords atteignables", () => {
    const r = rowWindow(at({ scrollLeft: 2000 }));
    expect(r.start).toBeGreaterThan(0);
    expect(r.end).toBeLessThan(BASE.count - 1);
    expect(r.padStart).toBeGreaterThan(0);
    expect(r.padEnd).toBeGreaterThan(0);
  });

  it("ne déborde jamais des index existants", () => {
    for (const scrollLeft of [-500, 0, 4000, 99_999]) {
      const r = rowWindow(at({ scrollLeft }));
      expect(r.start).toBeGreaterThanOrEqual(0);
      expect(r.end).toBeLessThanOrEqual(BASE.count - 1);
      expect(r.start).toBeLessThanOrEqual(r.end);
    }
  });

  it("rend tout quand la rangée est plus courte que l'écran", () => {
    const r = rowWindow(at({ count: 4 }));
    expect(r).toEqual({ start: 0, end: 3, padStart: 0, padEnd: 0 });
  });

  it("ne rend rien du tout sans carte", () => {
    const r = rowWindow(at({ count: 0 }));
    expect(r.end).toBeLessThan(r.start);
    expect(r.padStart).toBe(0);
  });
});

describe("épingle de survol", () => {
  it("étend la plage jusqu'à la carte survolée, sans la trouer", () => {
    const nu = rowWindow(at({ scrollLeft: 2000 }));
    const epingle = rowWindow(at({ scrollLeft: 2000, pinned: nu.start - 2 }));
    expect(epingle.start).toBe(nu.start - 2);
    expect(epingle.end).toBe(nu.end);
    // La cale se resserre d'autant : la géométrie reste juste.
    expect(largeurRendue(at({ scrollLeft: 2000, pinned: nu.start - 2 }))).toBeCloseTo(
      rowTrackWidth(BASE.count, BASE.cardWidth, BASE.gap),
      6,
    );
  });

  it("ne change RIEN quand la carte survolée est déjà dans la fenêtre", () => {
    const nu = rowWindow(at({ scrollLeft: 900 }));
    expect(rowWindow(at({ scrollLeft: 900, pinned: nu.start + 1 }))).toEqual(nu);
  });

  it("borne son allonge — une épingle lointaine ne remonte pas toute la rangée", () => {
    const nu = rowWindow(at({ scrollLeft: 3000 }));
    const epingle = rowWindow(at({ scrollLeft: 3000, pinned: 0 }));
    expect(nu.start - epingle.start).toBeLessThanOrEqual(4);
    expect(epingle.start).toBeGreaterThan(0);
  });

  it("ignore un index hors de la liste", () => {
    const nu = rowWindow(at({ scrollLeft: 900 }));
    expect(rowWindow(at({ scrollLeft: 900, pinned: 99 }))).toEqual(nu);
    expect(rowWindow(at({ scrollLeft: 900, pinned: -1 }))).toEqual(nu);
  });
});

describe("rangée vidée", () => {
  it("laisse une seule cale de la largeur totale", () => {
    const r = rowWindow(at({ vacant: true }));
    expect(r.end).toBeLessThan(r.start);
    expect(r.padEnd).toBe(0);
    expect(r.padStart).toBeCloseTo(rowTrackWidth(BASE.count, BASE.cardWidth, BASE.gap), 6);
  });
});
