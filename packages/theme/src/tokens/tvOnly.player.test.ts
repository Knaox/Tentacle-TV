/**
 * L'habillage du lecteur, mêmes mesures des deux côtés.
 *
 * `player-tv.css` porte la géométrie, `player-osd-tv.css` le dessin (chargé
 * après, il écrase — c'est voulu), `player-panels-tv.css` les panneaux
 * flottants et `player-skip-tv.css` les surcouches. Apple TV et Android TV
 * lisent `TV_OSD`, `TV_PLAYER_PANEL`, `TV_PLAYER_SKIP`,
 * `TV_PLAYER_NEXT_CARD`. Ce test recroise chaque valeur contre la feuille qui
 * fait foi.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  blockFor,
  blockWithProp,
  propIn,
  readSheet,
} from "./__testUtils__/cssBlocks";
import {
  TV_OSD,
  TV_PLAYER_NEXT_CARD,
  TV_PLAYER_PANEL,
  TV_PLAYER_SKIP,
} from "./tvOnly";

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES = resolve(HERE, "../../../../apps/tv-webos/client/src/styles");

const geometrie = readSheet(resolve(STYLES, "player-tv.css"));
const dessin = readSheet(resolve(STYLES, "player-osd-tv.css"));
const panneaux = readSheet(resolve(STYLES, "player-panels-tv.css"));
const surcouches = readSheet(resolve(STYLES, "player-skip-tv.css"));

describe("l'OSD suit TV_OSD", () => {
  it("l'habillage porte le retrait d'overscan", () => {
    expect(propIn(blockFor(geometrie, ".osd-tv"), "padding")).toBe(
      "var(--tv-overscan-y) var(--tv-overscan-x)",
    );
  });

  it("bouton secondaire", () => {
    const bloc = blockFor(geometrie, ".osd-tv-bouton");
    expect(propIn(bloc, "width")).toBe(`${TV_OSD.boutonSecondaire}px`);
    expect(propIn(bloc, "height")).toBe(`${TV_OSD.boutonSecondaire}px`);
  });

  it("bouton principal", () => {
    const bloc = blockFor(geometrie, ".osd-tv-bouton-principal");
    expect(propIn(bloc, "width")).toBe(`${TV_OSD.boutonPrincipal}px`);
    expect(propIn(bloc, "height")).toBe(`${TV_OSD.boutonPrincipal}px`);
  });

  it("focus d'un bouton : fond et échelle", () => {
    const bloc = blockFor(dessin, ".osd-tv-bouton:focus");
    expect(propIn(bloc, "background")).toBe(TV_OSD.boutonFocusFond);
    expect(propIn(bloc, "transform")).toBe(
      `scale(${TV_OSD.boutonFocusEchelle})`,
    );
  });

  it("transition d'un bouton : l'échelle seule, à la durée du jeton", () => {
    expect(propIn(blockFor(dessin, ".osd-tv-bouton"), "transition")).toBe(
      `transform ${TV_OSD.boutonTransitionMs}ms ease-out`,
    );
  });

  it("titre et sous-titre", () => {
    expect(propIn(blockFor(dessin, ".osd-tv-titre"), "font-size")).toBe(
      `${TV_OSD.titreTaille}px`,
    );
    const sousTitre = blockFor(dessin, ".osd-tv-sous-titre");
    expect(propIn(sousTitre, "font-size")).toBe(`${TV_OSD.sousTitreTaille}px`);
    expect(propIn(sousTitre, "color")).toBe(TV_OSD.sousTitreTeinte);
  });

  const degrade = (
    bloc: string,
    voile: { opacites: readonly number[]; positionsPct: readonly number[] },
  ) => {
    const image = propIn(bloc, "background-image");
    expect(image).not.toBeNull();
    voile.opacites.forEach((opacite, i) => {
      expect(image).toContain(
        `rgba(0, 0, 0, ${opacite}) ${voile.positionsPct[i]}%`,
      );
    });
  };

  it("voile de protection du haut", () => {
    const bloc = blockWithProp(dessin, ".osd-tv-haut::before", "background-image");
    expect(propIn(bloc, "bottom")).toBe(`-${TV_OSD.voileHaut.debordPx}px`);
    degrade(bloc, TV_OSD.voileHaut);
  });

  it("voile de protection du bas", () => {
    const bloc = blockWithProp(dessin, ".osd-tv-bas::before", "background-image");
    expect(propIn(bloc, "top")).toBe(`-${TV_OSD.voileBas.debordPx}px`);
    degrade(bloc, TV_OSD.voileBas);
  });

  it("barre de progression : piste, tampon, pastille, fantôme", () => {
    const piste = blockFor(dessin, ".barre-tv-piste");
    expect(propIn(piste, "height")).toBe(`${TV_OSD.barre.hauteur}px`);
    expect(propIn(piste, "background")).toBe(TV_OSD.barre.fond);
    expect(propIn(blockFor(dessin, ".barre-tv-tampon"), "background")).toBe(
      TV_OSD.barre.tampon,
    );
    expect(propIn(blockFor(dessin, ".barre-tv-pastille"), "width")).toBe(
      `${TV_OSD.barre.pastille}px`,
    );
    expect(propIn(blockFor(dessin, ".barre-tv-fantome"), "width")).toBe(
      `${TV_OSD.barre.fantome}px`,
    );
  });
});

describe("les panneaux suivent TV_PLAYER_PANEL", () => {
  it("géométrie du panneau flottant", () => {
    const bloc = blockFor(panneaux, ".panneau-tv");
    expect(propIn(bloc, "width")).toBe(`${TV_PLAYER_PANEL.largeur}px`);
    expect(propIn(bloc, "bottom")).toBe(`${TV_PLAYER_PANEL.bas}px`);
  });

  it("voile d'assombrissement, monté seulement panneau ouvert", () => {
    const bloc = blockFor(
      panneaux,
      '.osd-tv[data-panneau="episodes"]::after',
    );
    expect(propIn(bloc, "background")).toBe(TV_PLAYER_PANEL.voile);
    expect(propIn(bloc, "animation")).toContain(
      `${TV_PLAYER_PANEL.voileFonduMs}ms`,
    );
  });

  it("hauteur maximale du contenu", () => {
    const bloc = blockWithProp(
      panneaux,
      ".panneau-tv > [data-panneau-detache]",
      "max-height",
    );
    expect(propIn(bloc, "max-height")).toBe(
      `calc(100vh - ${TV_PLAYER_PANEL.hauteurMaxRetrait}px)`,
    );
  });

  it("cibles et vignettes", () => {
    const bouton = blockFor(panneaux, ".panneau-tv button");
    expect(propIn(bouton, "min-height")).toBe(
      `${TV_PLAYER_PANEL.boutonHauteurMin}px`,
    );
    expect(propIn(bouton, "font-size")).toBe(`${TV_PLAYER_PANEL.boutonTexte}px`);
    const vignette = blockFor(panneaux, ".panneau-tv .aspect-video");
    expect(propIn(vignette, "width")).toBe(
      `${TV_PLAYER_PANEL.vignetteEpisode.largeur}px`,
    );
    expect(propIn(vignette, "height")).toBe(
      `${TV_PLAYER_PANEL.vignetteEpisode.hauteur}px`,
    );
  });
});

describe("les surcouches suivent TV_PLAYER_SKIP et TV_PLAYER_NEXT_CARD", () => {
  it("bouton passer : ancrage et habillage", () => {
    const bloc = blockFor(surcouches, ".saut-tv");
    expect(propIn(bloc, "bottom")).toBe(`${TV_PLAYER_SKIP.bas}px`);
    expect(propIn(bloc, "right")).toBe("var(--tv-overscan-x)");
    expect(propIn(bloc, "padding")).toBe(
      `${TV_PLAYER_SKIP.paddingV}px ${TV_PLAYER_SKIP.paddingH}px`,
    );
    expect(propIn(bloc, "border-radius")).toBe(`${TV_PLAYER_SKIP.rayon}px`);
    expect(propIn(bloc, "font-size")).toBe(`${TV_PLAYER_SKIP.texte}px`);
  });

  it("bouton passer : il s'écarte quand l'habillage est visible", () => {
    const bloc = blockFor(surcouches, 'html[data-tv-lecteur="osd"] .saut-tv');
    expect(propIn(bloc, "transform")).toBe(
      `translateY(-${TV_PLAYER_SKIP.montee}px)`,
    );
  });

  it("carte épisode suivant : largeur et coin d'overscan", () => {
    const bloc = blockFor(surcouches, ".carte-suivant-tv");
    expect(propIn(bloc, "width")).toBe(`${TV_PLAYER_NEXT_CARD.largeur}px`);
    expect(propIn(bloc, "bottom")).toBe("var(--tv-overscan-y)");
    expect(propIn(bloc, "right")).toBe("var(--tv-overscan-x)");
  });
});
