import { afterEach, describe, expect, it, vi } from "vitest";
import { avisPleinEcranDejaVu, marquerAvisPleinEcranVu } from "./waylandFullscreenNotice";

describe("waylandFullscreenNotice", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ne dit « déjà vu » qu'après marquage, et le retient", () => {
    const memoire = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (cle: string) => memoire.get(cle) ?? null,
      setItem: (cle: string, valeur: string) => {
        memoire.set(cle, valeur);
      },
    });
    expect(avisPleinEcranDejaVu()).toBe(false);
    marquerAvisPleinEcranVu();
    expect(avisPleinEcranDejaVu()).toBe(true);
  });

  it("se tait quand le stockage est indisponible — l'avis ne doit pas boucler", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("indisponible");
      },
      setItem: () => {
        throw new Error("indisponible");
      },
    });
    // Sans mémoire possible, « déjà vu » : se taire vaut mieux que répéter.
    expect(avisPleinEcranDejaVu()).toBe(true);
    expect(() => {
      marquerAvisPleinEcranVu();
    }).not.toThrow();
  });
});
