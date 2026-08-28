/**
 * L'invariant tenu ici : Inter arrive dans l'iframe d'un greffon par des
 * `@font-face` INLINE (fichiers gstatic, autorisés par `font-src`), jamais
 * par un `@import` de feuille externe — la CSP des greffons Electron
 * (`style-src 'unsafe-inline'`) le refuserait en silence, et le texte
 * retomberait sur la police système (DejaVu sous Linux).
 */

import { describe, expect, it } from "vitest";
import { buildPluginThemeStyle } from "./buildPluginTheme";

describe("buildPluginThemeStyle", () => {
  it("charge Inter par @font-face inline, fichiers gstatic", () => {
    const css = buildPluginThemeStyle();
    expect(css).toContain("@font-face");
    expect(css).toContain("font-family: 'Inter'");
    expect(css).toContain("https://fonts.gstatic.com/s/inter/");
    expect(css).toContain("font-display: swap");
  });

  it("ne passe JAMAIS par @import — la CSP des greffons le refuse", () => {
    // Le mot apparaît dans un commentaire (l'histoire du défaut) : c'est la
    // FORME ACTIVE @import url(...) qui doit avoir disparu.
    expect(buildPluginThemeStyle()).not.toContain("@import url(");
  });

  it("garde des replis lisibles hors ligne, Linux compris", () => {
    const css = buildPluginThemeStyle();
    expect(css).toContain("'Noto Sans'");
    expect(css).toContain("'DejaVu Sans'");
  });
});
