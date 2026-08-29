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

interface FakeObserver {
  targets: Set<Element>;
  deliver(entries: { target: Element; isIntersecting: boolean }[]): void;
  options: IntersectionObserverInit | undefined;
}

const created: FakeObserver[] = [];

beforeEach(() => {
  created.length = 0;
  class FakeIO {
    targets = new Set<Element>();
    constructor(
      private readonly cb: IntersectionObserverCallback,
      public options?: IntersectionObserverInit,
    ) {
      created.push({
        targets: this.targets,
        options,
        deliver: (entries) => this.cb(entries as unknown as IntersectionObserverEntry[], this as never),
      });
    }
    observe(el: Element) { this.targets.add(el); }
    unobserve(el: Element) { this.targets.delete(el); }
    disconnect() { this.targets.clear(); }
  }
  vi.stubGlobal("IntersectionObserver", FakeIO);
});

afterEach(() => { vi.unstubAllGlobals(); });

/** Import différé : le module lit `IntersectionObserver` à l'appel, pas à l'import. */
async function create(rootMargin?: string) {
  const { createRevealObserver } = await import("./revealObserver");
  return createRevealObserver(rootMargin);
}

const elem = () => ({}) as unknown as Element;

describe("observateur partagé", () => {
  it("n'en crée qu'un pour toutes les cellules", async () => {
    const obs = await create("300px");
    const cells = [elem(), elem(), elem()];
    for (const el of cells) obs.observe(el, () => {});

    expect(created).toHaveLength(1);
    expect(created[0].targets.size).toBe(3);
    expect(created[0].options?.rootMargin).toBe("300px");
  });

  it("aiguille chaque livraison vers la bonne cellule", async () => {
    const obs = await create();
    const a = elem();
    const b = elem();
    const vu: string[] = [];
    obs.observe(a, (near) => vu.push(`a:${near}`));
    obs.observe(b, (near) => vu.push(`b:${near}`));

    created[0].deliver([
      { target: a, isIntersecting: true },
      { target: b, isIntersecting: false },
    ]);

    expect(vu).toEqual(["a:true", "b:false"]);
  });

  it("ne touche qu'à la cellule désabonnée", async () => {
    const obs = await create();
    const a = elem();
    const b = elem();
    const vu: string[] = [];
    const unsubscribeA = obs.observe(a, () => vu.push("a"));
    obs.observe(b, () => vu.push("b"));

    unsubscribeA();

    expect(created[0].targets.has(a)).toBe(false);
    // b reste surveillée ET continue de recevoir ses livraisons : c'est le point.
    expect(created[0].targets.has(b)).toBe(true);
    created[0].deliver([{ target: a, isIntersecting: true }, { target: b, isIntersecting: true }]);
    expect(vu).toEqual(["b"]);
  });

  it("ignore une livraison pour une cible inconnue, sans lever", async () => {
    const obs = await create();
    obs.observe(elem(), () => {});
    expect(() => created[0].deliver([{ target: elem(), isIntersecting: true }])).not.toThrow();
  });

  it("déclare tout proche quand l'API n'existe pas", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const obs = await create();
    const vu: boolean[] = [];
    const unsubscribe = obs.observe(elem(), (near) => vu.push(near));
    // Mieux vaut tout monter que laisser une grille de cases vides.
    expect(vu).toEqual([true]);
    expect(() => unsubscribe()).not.toThrow();
  });
});
