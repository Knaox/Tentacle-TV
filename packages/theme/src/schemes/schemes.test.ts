/**
 * Garde-fou de l'INVARIANT le plus coûteux du design system.
 *
 * Les builders de palette DOIVENT lire les exports MUTABLES de
 * `@tentacle-tv/shared/theme`, réécrits en place par `applyThemeOverride()`.
 * Si quelqu'un les remplace un jour par `DEFAULT_COLOR_TOKENS` ou par une copie
 * figée, le thème de marque admin cesse silencieusement de se propager sur
 * mobile ET sur TV : ni erreur de type, ni échec de lint, ni crash — la
 * régression n'apparaît que chez un utilisateur ayant personnalisé sa marque.
 *
 * Ce test échoue immédiatement dans ce cas.
 */

import { afterEach, describe, expect, it } from "vitest";
import { BRAND, applyThemeOverride } from "@tentacle-tv/shared/theme";

import { buildDarkPalette } from "./dark";
import { buildLightPalette } from "./light";
import { resolveScheme, sanitizeThemeMode } from "./index";

afterEach(() => {
  applyThemeOverride(null);
});

describe("palettes — valeurs par défaut", () => {
  it("sombre reprend la marque partagée", () => {
    expect(buildDarkPalette().brand.violet).toBe("#8B5CF6");
    expect(buildDarkPalette().surface.s0).toBe("#000000");
  });

  it("clair dérive son accent de BRAND.dark", () => {
    expect(buildLightPalette().brand.violet).toBe("#7C3AED");
    expect(buildLightPalette().surface.s0).toBe("#F4F4F7");
  });

  it("onMedia est constant entre les deux schémas", () => {
    expect(buildLightPalette().onMedia).toEqual(buildDarkPalette().onMedia);
  });
});

describe("INVARIANT — l'override de marque admin se propage", () => {
  it("atteint le schéma sombre", () => {
    applyThemeOverride({
      color: { brand: { base: "#FF0000", light: "#FF6666", dark: "#CC0000" } },
    });
    expect(BRAND.violet).toBe("#FF0000");
    expect(buildDarkPalette().brand.violet).toBe("#FF0000");
  });

  it("atteint le schéma clair par dérivation — chemin qui casse en premier", () => {
    applyThemeOverride({
      color: { brand: { base: "#FF0000", light: "#FF6666", dark: "#CC0000" } },
    });
    const light = buildLightPalette();
    expect(light.brand.violet).toBe("#CC0000");
    // Alphas recalculés depuis la marque surchargée, pas des littéraux violets.
    expect(light.brand.glow).toBe("rgba(204, 0, 0, 0.25)");
    expect(light.brand.soft).toBe("rgba(204, 0, 0, 0.1)");
    expect(light.cta.brandBg).toBe("#CC0000");
    expect(light.border.focus).toBe("#CC0000");
  });

  it("une surcharge de surface s'applique au sombre sans casser le clair", () => {
    applyThemeOverride({ color: { surface: { s1: "#123456" } } });
    expect(buildDarkPalette().surface.s1).toBe("#123456");
    // `glass.panel` est un alias de SURFACE.s1 en sombre — il doit suivre.
    expect(buildDarkPalette().glass.panel).toBe("#123456");
    // Le clair garde ses constantes locales : une valeur sombre n'y fuit pas.
    expect(buildLightPalette().surface.s1).toBe("#FFFFFF");
  });

  it("le retrait de l'override restaure les défauts", () => {
    applyThemeOverride({ color: { brand: { base: "#FF0000" } } });
    applyThemeOverride(null);
    expect(buildDarkPalette().brand.violet).toBe("#8B5CF6");
    expect(buildLightPalette().brand.violet).toBe("#7C3AED");
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
