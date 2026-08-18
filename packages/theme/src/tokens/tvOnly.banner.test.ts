/**
 * La carte bannière et la bannière de fiche, mêmes mesures des deux côtés.
 *
 * Les feuilles webOS (`banner-tv.css`, `library-tv.css`, `detail-tv.css`)
 * écrivent leurs valeurs en dur ; Apple TV et Android TV lisent
 * `TV_BANNER_CARD`/`TV_DETAIL_BANNER`. Ce test recroise les deux : si une
 * feuille bouge sans le jeton — ou l'inverse — les téléviseurs cessent de se
 * ressembler et c'est ici que ça se dit.
 *
 * Le rayon, le liseré et l'opacité du halo viennent du thème du client web
 * (`surfaces.css`, thème sombre — la première occurrence), la gouttière de
 * `tokens.css` : la carte du salon emprunte ces jetons-là, on les recroise
 * aussi.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { TV_RADIUS } from "../native/tvTokens";
import {
  blockFor,
  blockWithProp,
  cssVarValue,
  propIn,
  readSheet,
} from "./__testUtils__/cssBlocks";
import { TV_BANNER_CARD, TV_DETAIL_BANNER } from "./tvOnly";

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES = resolve(HERE, "../../../../apps/tv-webos/client/src/styles");
const WEB_THEME = resolve(HERE, "../../../../apps/web/src/theme");

const banner = readSheet(resolve(STYLES, "banner-tv.css"));
const library = readSheet(resolve(STYLES, "library-tv.css"));
const detail = readSheet(resolve(STYLES, "detail-tv.css"));
const surfaces = readSheet(resolve(WEB_THEME, "surfaces.css"));
const webTokens = readSheet(resolve(WEB_THEME, "tokens.css"));

describe("la carte bannière suit TV_BANNER_CARD", () => {
  it("accueil : hauteur de la carte", () => {
    expect(propIn(blockFor(banner, "[data-hero-frame]"), "height")).toBe(
      `${TV_BANNER_CARD.hauteurAccueilVh}vh`,
    );
  });

  it("accueil : fondu d'apparition de l'image", () => {
    const bloc = blockWithProp(banner, "[data-hero-frame] img", "animation");
    expect(propIn(bloc, "animation")).toContain(`${TV_BANNER_CARD.fonduMs}ms`);
  });

  it("accueil : largeur du bloc texte", () => {
    expect(
      propIn(blockFor(banner, "[data-hero-frame] .max-w-xl"), "max-width"),
    ).toBe(`${TV_BANNER_CARD.texteLargeurMax / 16}rem`);
  });

  it("bibliothèque : hauteur de la carte (via le sélecteur du halo)", () => {
    const halo = blockFor(
      library,
      `.hero-glow[class*="${TV_BANNER_CARD.hauteurBibliothequeVh}vh"]`,
    );
    expect(propIn(halo, "z-index")).toBe("0");
  });

  it("bibliothèque : la carte prend la gouttière de rangée", () => {
    const carte = blockWithProp(library, ".-bottom-\\[200px\\]", "left");
    expect(propIn(carte, "left")).toBe("var(--row-gutter-desktop)");
    expect(propIn(carte, "right")).toBe("var(--row-gutter-desktop)");
  });

  it("bibliothèque : fondu identique à l'accueil", () => {
    const image = blockWithProp(library, ".-bottom-\\[200px\\] > img", "animation");
    expect(propIn(image, "animation")).toContain(`${TV_BANNER_CARD.fonduMs}ms`);
  });

  it("bibliothèque : écart entre la carte et les filtres", () => {
    expect(
      propIn(blockFor(library, ".relative.z-10.-mt-10"), "margin-top"),
    ).toBe(`${TV_BANNER_CARD.ecartFiltres}px`);
  });

  it("gouttière : la valeur du thème web", () => {
    expect(cssVarValue(webTokens, "--row-gutter-desktop")).toBe(
      `${TV_BANNER_CARD.gouttiere}px`,
    );
  });

  it("rayon : celui du thème, radius.lg", () => {
    expect(cssVarValue(surfaces, "--hero-frame-radius")).toBe(
      `${TV_RADIUS.lg}px`,
    );
  });

  it("liseré : 1 px de marque à l'opacité du jeton", () => {
    expect(cssVarValue(surfaces, "--hero-frame-ring")).toBe(
      `inset 0 0 0 1px rgba(var(--brand-rgb), ${TV_BANNER_CARD.lisereOpacite})`,
    );
  });

  it("halo : l'opacité du thème sombre", () => {
    expect(cssVarValue(surfaces, "--hero-ambilight-opacity")).toBe(
      `${TV_BANNER_CARD.haloOpacite}`,
    );
  });
});

describe("la bannière de fiche suit TV_DETAIL_BANNER", () => {
  it("hauteur forcée par la feuille de fiche", () => {
    const bloc = blockFor(detail, '.min-h-screen [class*="calc(58vh"]');
    expect(propIn(bloc, "height")).toBe(
      `calc(${TV_DETAIL_BANNER.hauteurVh}vh + ${TV_DETAIL_BANNER.supplementPx}px)`,
    );
  });

  it("plein cadre : elle annule le retrait d'overscan", () => {
    const bloc = blockFor(detail, '.min-h-screen [class*="calc(58vh"]');
    expect(propIn(bloc, "top")).toBe("calc(-1 * var(--tv-overscan-y))");
    expect(propIn(bloc, "left")).toBe("calc(-1 * var(--tv-overscan-x))");
  });
});
