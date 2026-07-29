import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Observateur partagé des cellules révélées.
 *
 * Ce qui mérite d'être figé ici n'est pas « ça marche » — un
 * `IntersectionObserver` marche — mais les deux propriétés qui ont coûté un
 * débogage :
 *
 *  1. UN SEUL observateur, quel que soit le nombre de cellules. C'est toute la
 *     raison d'être du module : la version par cellule créait un observateur ET
 *     un écouteur `visibilitychange` chacune ;
 *  2. le désabonnement est INDIVIDUEL. Une mise hors service globale retirait
 *     toutes les cibles d'un coup, et selon l'ordre dans lequel React enchaîne
 *     nettoyages et mises en place, elle pouvait s'exécuter après que les
 *     cellules se soient réabonnées — l'observateur ne livrait alors plus rien et
 *     la fenêtre restait figée sur les premières cellules.
 */

interface FauxObserver {
  cibles: Set<Element>;
  livrer(entrees: { target: Element; isIntersecting: boolean }[]): void;
  options: IntersectionObserverInit | undefined;
}

const crees: FauxObserver[] = [];

beforeEach(() => {
  crees.length = 0;
  class FakeIO {
    cibles = new Set<Element>();
    constructor(
      private readonly cb: IntersectionObserverCallback,
      public options?: IntersectionObserverInit,
    ) {
      crees.push({
        cibles: this.cibles,
        options,
        livrer: (entrees) => this.cb(entrees as unknown as IntersectionObserverEntry[], this as never),
      });
    }
    observe(el: Element) { this.cibles.add(el); }
    unobserve(el: Element) { this.cibles.delete(el); }
    disconnect() { this.cibles.clear(); }
  }
  vi.stubGlobal("IntersectionObserver", FakeIO);
});

afterEach(() => { vi.unstubAllGlobals(); });

/** Import différé : le module lit `IntersectionObserver` à l'appel, pas à l'import. */
async function creer(rootMargin?: string) {
  const { creerRevealObserver } = await import("./revealObserver");
  return creerRevealObserver(rootMargin);
}

const elem = () => ({}) as unknown as Element;

describe("observateur partagé", () => {
  it("n'en crée qu'un pour toutes les cellules", async () => {
    const obs = await creer("300px");
    const cellules = [elem(), elem(), elem()];
    for (const el of cellules) obs.observe(el, () => {});

    expect(crees).toHaveLength(1);
    expect(crees[0].cibles.size).toBe(3);
    expect(crees[0].options?.rootMargin).toBe("300px");
  });

  it("aiguille chaque livraison vers la bonne cellule", async () => {
    const obs = await creer();
    const a = elem();
    const b = elem();
    const vu: string[] = [];
    obs.observe(a, (proche) => vu.push(`a:${proche}`));
    obs.observe(b, (proche) => vu.push(`b:${proche}`));

    crees[0].livrer([
      { target: a, isIntersecting: true },
      { target: b, isIntersecting: false },
    ]);

    expect(vu).toEqual(["a:true", "b:false"]);
  });

  it("ne touche qu'à la cellule désabonnée", async () => {
    const obs = await creer();
    const a = elem();
    const b = elem();
    const vu: string[] = [];
    const desabonnerA = obs.observe(a, () => vu.push("a"));
    obs.observe(b, () => vu.push("b"));

    desabonnerA();

    expect(crees[0].cibles.has(a)).toBe(false);
    // b reste surveillée ET continue de recevoir ses livraisons : c'est le point.
    expect(crees[0].cibles.has(b)).toBe(true);
    crees[0].livrer([{ target: a, isIntersecting: true }, { target: b, isIntersecting: true }]);
    expect(vu).toEqual(["b"]);
  });

  it("ignore une livraison pour une cible inconnue, sans lever", async () => {
    const obs = await creer();
    obs.observe(elem(), () => {});
    expect(() => crees[0].livrer([{ target: elem(), isIntersecting: true }])).not.toThrow();
  });

  it("déclare tout proche quand l'API n'existe pas", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const obs = await creer();
    const vu: boolean[] = [];
    const desabonner = obs.observe(elem(), (proche) => vu.push(proche));
    // Mieux vaut tout monter que laisser une grille de cases vides.
    expect(vu).toEqual([true]);
    expect(() => desabonner()).not.toThrow();
  });
});
