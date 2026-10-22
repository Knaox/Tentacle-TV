import { describe, expect, it } from "vitest";

import {
  getGlassAccessibility,
  installGlassAccessibility,
  planGlassAccessibility,
  readSystemAccessibility,
  subscribeGlassAccessibility,
} from "./accessibility";

const none = { reduceTransparency: false, increaseContrast: false, reduceMotion: false };

describe("accessibilité du verre", () => {
  it("sans réglage : verre liquide complet, aucun attribut", () => {
    const plan = planGlassAccessibility(none);
    expect(plan).toMatchObject({ material: "liquid", specularFollow: true, lens: true, morph: true });
    expect(Object.values(plan.attributes).every((v) => v === null)).toBe(true);
  });

  it("transparence réduite : givré, sans reflet qui suit", () => {
    expect(planGlassAccessibility({ ...none, reduceTransparency: true })).toMatchObject({
      material: "frosted",
      specularFollow: false,
      lens: true,
    });
  });

  it("contraste accru l'emporte sur la transparence réduite", () => {
    const plan = planGlassAccessibility({ ...none, reduceTransparency: true, increaseContrast: true });
    expect(plan.material).toBe("solid");
    expect(plan.attributes).toEqual({
      "data-lg-transparency": "reduce",
      "data-lg-contrast": "more",
      "data-lg-motion": null,
      "data-lg-material": "solid",
    });
  });

  it("mouvement réduit : ni lentille, ni fusion, ni reflet qui suit", () => {
    expect(planGlassAccessibility({ ...none, reduceMotion: true })).toMatchObject({
      material: "liquid",
      specularFollow: false,
      lens: false,
      morph: false,
    });
  });

  it("pose et retire les attributs quand le système change", () => {
    const state: Record<string, boolean> = {};
    const listeners: Array<() => void> = [];
    const matchMedia = (q: string) => ({
      get matches() {
        return state[q] ?? false;
      },
      addEventListener: (_: string, l: () => void) => listeners.push(l),
      removeEventListener: () => undefined,
    });
    const attrs = new Map<string, string>();
    const root = {
      setAttribute: (k: string, v: string) => attrs.set(k, v),
      removeAttribute: (k: string) => attrs.delete(k),
    } as unknown as HTMLElement;
    const seen: string[] = [];
    const unsubscribe = subscribeGlassAccessibility(() => seen.push(getGlassAccessibility().material));
    installGlassAccessibility(root, matchMedia as never);
    expect(attrs.size).toBe(0);
    state["(prefers-reduced-transparency: reduce)"] = true;
    listeners.forEach((l) => l());
    expect(attrs.get("data-lg-transparency")).toBe("reduce");
    expect(attrs.get("data-lg-material")).toBe("frosted");
    state["(prefers-reduced-transparency: reduce)"] = false;
    listeners.forEach((l) => l());
    expect(attrs.has("data-lg-transparency")).toBe(false);
    // Les abonnés (le ton tenu d'une surface) apprennent chaque changement.
    // Une fois par changement réel (trois requêtes écoutent, un seul avis).
    expect(seen).toEqual(["frosted", "liquid"]);
    unsubscribe();
    state["(prefers-contrast: more)"] = true;
    listeners.forEach((l) => l());
    expect(seen).toHaveLength(2);
    expect(readSystemAccessibility(undefined)).toEqual(none);
  });
});
