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

const geometry = readSheet(resolve(STYLES, "player-tv.css"));
const paint = readSheet(resolve(STYLES, "player-osd-tv.css"));
const panels = readSheet(resolve(STYLES, "player-panels-tv.css"));
const overlays = readSheet(resolve(STYLES, "player-skip-tv.css"));

describe("l'OSD suit TV_OSD", () => {
  it("l'habillage porte le retrait d'overscan", () => {
    expect(propIn(blockFor(geometry, ".osd-tv"), "padding")).toBe(
      "var(--tv-overscan-y) var(--tv-overscan-x)",
    );
  });

  it("bouton secondaire", () => {
    const block = blockFor(geometry, ".osd-tv-bouton");
    expect(propIn(block, "width")).toBe(`${TV_OSD.secondaryButton}px`);
    expect(propIn(block, "height")).toBe(`${TV_OSD.secondaryButton}px`);
  });

  it("bouton principal", () => {
    const block = blockFor(geometry, ".osd-tv-bouton-principal");
    expect(propIn(block, "width")).toBe(`${TV_OSD.primaryButton}px`);
    expect(propIn(block, "height")).toBe(`${TV_OSD.primaryButton}px`);
  });

  it("focus d'un bouton : fond et échelle", () => {
    const block = blockFor(paint, ".osd-tv-bouton:focus");
    expect(propIn(block, "background")).toBe(TV_OSD.buttonFocusBg);
    expect(propIn(block, "transform")).toBe(
      `scale(${TV_OSD.buttonFocusScale})`,
    );
  });

  it("transition d'un bouton : l'échelle seule, à la durée du jeton", () => {
    expect(propIn(blockFor(paint, ".osd-tv-bouton"), "transition")).toBe(
      `transform ${TV_OSD.buttonTransitionMs}ms ease-out`,
    );
  });

  it("titre et sous-titre", () => {
    expect(propIn(blockFor(paint, ".osd-tv-titre"), "font-size")).toBe(
      `${TV_OSD.titleSize}px`,
    );
    const subtitle = blockFor(paint, ".osd-tv-sous-titre");
    expect(propIn(subtitle, "font-size")).toBe(`${TV_OSD.subtitleSize}px`);
    expect(propIn(subtitle, "color")).toBe(TV_OSD.subtitleTint);
  });

  const gradient = (
    block: string,
    scrim: { opacities: readonly number[]; positionsPct: readonly number[] },
  ) => {
    const image = propIn(block, "background-image");
    expect(image).not.toBeNull();
    scrim.opacities.forEach((opacity, i) => {
      expect(image).toContain(
        `rgba(0, 0, 0, ${opacity}) ${scrim.positionsPct[i]}%`,
      );
    });
  };

  it("voile de protection du haut", () => {
    const block = blockWithProp(paint, ".osd-tv-haut::before", "background-image");
    expect(propIn(block, "bottom")).toBe(`-${TV_OSD.topScrim.bleedPx}px`);
    gradient(block, TV_OSD.topScrim);
  });

  it("voile de protection du bas", () => {
    const block = blockWithProp(paint, ".osd-tv-bas::before", "background-image");
    expect(propIn(block, "top")).toBe(`-${TV_OSD.bottomScrim.bleedPx}px`);
    gradient(block, TV_OSD.bottomScrim);
  });

  it("barre de progression : piste, tampon, pastille, fantôme", () => {
    const track = blockFor(paint, ".barre-tv-piste");
    expect(propIn(track, "height")).toBe(`${TV_OSD.bar.height}px`);
    expect(propIn(track, "background")).toBe(TV_OSD.bar.bg);
    expect(propIn(blockFor(paint, ".barre-tv-tampon"), "background")).toBe(
      TV_OSD.bar.buffer,
    );
    expect(propIn(blockFor(paint, ".barre-tv-pastille"), "width")).toBe(
      `${TV_OSD.bar.knob}px`,
    );
    expect(propIn(blockFor(paint, ".barre-tv-fantome"), "width")).toBe(
      `${TV_OSD.bar.ghost}px`,
    );
  });
});

describe("les panneaux suivent TV_PLAYER_PANEL", () => {
  it("géométrie du panneau flottant", () => {
    const block = blockFor(panels, ".panneau-tv");
    expect(propIn(block, "width")).toBe(`${TV_PLAYER_PANEL.width}px`);
    expect(propIn(block, "bottom")).toBe(`${TV_PLAYER_PANEL.bottom}px`);
  });

  it("voile d'assombrissement, monté seulement panneau ouvert", () => {
    const block = blockFor(
      panels,
      '.osd-tv[data-panneau="episodes"]::after',
    );
    expect(propIn(block, "background")).toBe(TV_PLAYER_PANEL.scrim);
    expect(propIn(block, "animation")).toContain(
      `${TV_PLAYER_PANEL.scrimFadeMs}ms`,
    );
  });

  it("hauteur maximale du contenu", () => {
    const block = blockWithProp(
      panels,
      ".panneau-tv > [data-panneau-detache]",
      "max-height",
    );
    expect(propIn(block, "max-height")).toBe(
      `calc(100vh - ${TV_PLAYER_PANEL.maxHeightInset}px)`,
    );
  });

  it("cibles et vignettes", () => {
    const button = blockFor(panels, ".panneau-tv button");
    expect(propIn(button, "min-height")).toBe(
      `${TV_PLAYER_PANEL.buttonMinHeight}px`,
    );
    expect(propIn(button, "font-size")).toBe(`${TV_PLAYER_PANEL.buttonText}px`);
    const thumb = blockFor(panels, ".panneau-tv .aspect-video");
    expect(propIn(thumb, "width")).toBe(
      `${TV_PLAYER_PANEL.episodeThumb.width}px`,
    );
    expect(propIn(thumb, "height")).toBe(
      `${TV_PLAYER_PANEL.episodeThumb.height}px`,
    );
  });
});

describe("les surcouches suivent TV_PLAYER_SKIP et TV_PLAYER_NEXT_CARD", () => {
  it("bouton passer : ancrage et habillage", () => {
    const block = blockFor(overlays, ".saut-tv");
    expect(propIn(block, "bottom")).toBe(`${TV_PLAYER_SKIP.bottom}px`);
    expect(propIn(block, "right")).toBe("var(--tv-overscan-x)");
    expect(propIn(block, "padding")).toBe(
      `${TV_PLAYER_SKIP.paddingV}px ${TV_PLAYER_SKIP.paddingH}px`,
    );
    expect(propIn(block, "border-radius")).toBe(`${TV_PLAYER_SKIP.radius}px`);
    expect(propIn(block, "font-size")).toBe(`${TV_PLAYER_SKIP.text}px`);
  });

  it("bouton passer : il s'écarte quand l'habillage est visible", () => {
    const block = blockFor(overlays, 'html[data-tv-lecteur="osd"] .saut-tv');
    expect(propIn(block, "transform")).toBe(
      `translateY(-${TV_PLAYER_SKIP.lift}px)`,
    );
  });

  it("carte épisode suivant : largeur et coin d'overscan", () => {
    const block = blockFor(overlays, ".carte-suivant-tv");
    expect(propIn(block, "width")).toBe(`${TV_PLAYER_NEXT_CARD.width}px`);
    expect(propIn(block, "bottom")).toBe("var(--tv-overscan-y)");
    expect(propIn(block, "right")).toBe("var(--tv-overscan-x)");
  });
});
