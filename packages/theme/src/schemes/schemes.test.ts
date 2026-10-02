/**
 * Garde-fous des palettes : leurs valeurs par défaut, leur source unique (les
 * jetons de marque de `@tentacle-tv/shared/theme`), la parité des clés entre
 * les deux schémas et la résolution du mode.
 */

import { describe, expect, it } from "vitest";
import { BRAND } from "@tentacle-tv/shared/theme";

import { buildDarkPalette } from "./dark";
import { buildLightPalette } from "./light";
import { resolveScheme, sanitizeThemeMode } from "./index";

describe("palettes — valeurs par défaut", () => {
  it("sombre reprend la marque partagée", () => {
    expect(buildDarkPalette().brand.violet).toBe("#8B5CF6");
    expect(buildDarkPalette().surface.s0).toBe("#000000");
  });

  it("clair dérive son accent de BRAND.dark", () => {
    expect(buildLightPalette().brand.violet).toBe("#7C3AED");
    expect(buildLightPalette().surface.s0).toBe("#F4F4F7");
  });

  it("le rose d'accent suit la parité web dans les deux schémas", () => {
    expect(buildDarkPalette().brand.accent).toBe("#EC4899");
    expect(buildDarkPalette().brand.accentLight).toBe("#F472B6");
    // Clair : la nuance foncée devient l'accent, la vive sert de clair.
    expect(buildLightPalette().brand.accent).toBe("#DB2777");
    expect(buildLightPalette().brand.accentLight).toBe("#EC4899");
  });

  it("onMedia est constant entre les deux schémas", () => {
    expect(buildLightPalette().onMedia).toEqual(buildDarkPalette().onMedia);
  });
});

describe("une seule source de marque", () => {
  it("les deux schémas lisent les jetons partagés, jamais une copie", () => {
    // Une copie figée (`DEFAULT_COLOR_TOKENS`, un littéral) aux mêmes valeurs
    // passerait une simple comparaison : on change le jeton partagé le temps
    // du test, les palettes doivent suivre.
    const saved = { ...BRAND };
    try {
      Object.assign(BRAND, { violet: "#FF0000", dark: "#CC0000", accent: "#00FF88", accentDark: "#00CC66" });
      expect(buildDarkPalette().brand.violet).toBe("#FF0000");
      expect(buildDarkPalette().brand.accent).toBe("#00FF88");
      expect(buildLightPalette().brand.violet).toBe("#CC0000");
      expect(buildLightPalette().brand.accent).toBe("#00CC66");
    } finally {
      Object.assign(BRAND, saved);
    }
  });
});

describe("parité des clés entre schémas", () => {
  const walk = (value: unknown, prefix = ""): string[] => {
    if (typeof value !== "object" || value === null) return [prefix];
    return Object.entries(value).flatMap(([k, v]) =>
      walk(v, prefix ? `${prefix}.${k}` : k),
    );
  };

  /**
   * Seules divergences ADMISES entre les deux schémas, chacune documentée
   * dans `types.ts`. Toute autre asymétrie doit faire échouer le test.
   */
  const OPTIONNELS_ADMIS = [
    // Liseré du CTA principal : nécessaire en clair (bouton blanc sur fond
    // clair), absent en sombre où la pilule blanche se suffit à elle-même.
    "cta.primaryBorder",
  ];

  it("les deux palettes exposent les mêmes chemins, aux optionnels documentés près", () => {
    // Un token ajouté à un schéma sans contrepartie dans l'autre casse ici,
    // même quand TypeScript laisse passer via une propriété optionnelle.
    const light = walk(buildLightPalette());
    const dark = walk(buildDarkPalette());

    const lightOnly = light.filter((p) => !dark.includes(p));
    const darkOnly = dark.filter((p) => !light.includes(p));

    expect(lightOnly.sort()).toEqual([...OPTIONNELS_ADMIS].sort());
    expect(darkOnly).toEqual([]);
  });
});

describe("résolution du mode", () => {
  it("sanitize retombe sur SOMBRE pour toute valeur inconnue", () => {
    expect(sanitizeThemeMode("light")).toBe("light");
    expect(sanitizeThemeMode("dark")).toBe("dark");
    // « auto » reste un choix valide — c'est le DÉFAUT qui a changé, pas les
    // possibilités : sans choix explicite, l'app est celle pour laquelle elle
    // a été dessinée, la sombre.
    expect(sanitizeThemeMode("auto")).toBe("auto");
    expect(sanitizeThemeMode(null)).toBe("dark");
    expect(sanitizeThemeMode(undefined)).toBe("dark");
    expect(sanitizeThemeMode("nimportequoi")).toBe("dark");
  });

  it("auto suit le système, light/dark forcent", () => {
    expect(resolveScheme("auto", true)).toBe("dark");
    expect(resolveScheme("auto", false)).toBe("light");
    expect(resolveScheme("light", true)).toBe("light");
    expect(resolveScheme("dark", false)).toBe("dark");
  });
});
