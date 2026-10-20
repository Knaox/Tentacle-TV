import { describe, expect, it } from "vitest";
import { coverZoom, introCameraPlan } from "./introCamera";
import { introGeometry } from "./introGeometry";
import { introHoldLoops } from "./introHold";
import { INTRO_LIT_MARGIN, introLitWindow } from "./introLit";
import { introTracks } from "./introTimeline";

// Un logo de test : la forme des constantes générées, réduite à l'essentiel.
const ART = {
  SCREEN: { x: 58, y: 104, width: 124, height: 92, rx: 16, frameWidth: 5 },
  PLAY_PATH: "M 114 134 L 142 150 L 114 166 Z",
  FRONT_ARM_PATHS: ["M 81 92 L 60 150 L 93 190 Z", "M 159 92 L 180 150 L 147 190 Z"],
  BACK_ARM_PATHS: ["M 84 150 L 71 200 L 102 228 Z", "M 156 150 L 169 200 L 138 228 Z"],
  EYE_WHITES: [{ cx: 99, cy: 82, r: 15.5 }, { cx: 141, cy: 82, r: 15.5 }],
};

/** Les fenêtres de l'essai : iPhone et iPad dans les deux sens, un téléphone très allongé, une TV. */
const VIEWS = [
  { width: 393, height: 852 },
  { width: 852, height: 393 },
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
  { width: 360, height: 800 },
  { width: 1920, height: 1080 },
];

/** Tout ce qui DESSINE le logo dans la géométrie (la fenêtre allumée mise à part). */
const drawing = (aspect: number | null) => {
  const { lit: _lit, ...rest } = introGeometry(ART, aspect);
  return rest;
};

describe("le poulpe garde ses proportions sur tout écran", () => {
  it("le dessin ne dépend jamais du format de l'appareil : seule la fenêtre allumée change", () => {
    const tv = drawing(null);
    for (const view of VIEWS) expect(drawing(view.width / view.height)).toEqual(tv);
  });

  it("aucun facteur d'échelle non uniforme sur le logo : seuls les yeux clignent (scaleY), rien d'autre", () => {
    for (const view of VIEWS) {
      const geometry = introGeometry(ART, view.width / view.height);
      for (const [part, track] of Object.entries(introTracks(geometry))) {
        const squashes = track.order.includes("scaleY") || track.animations.some((a) => a.frames.some((f) => f.t && "scaleY" in f.t));
        expect(squashes, part).toBe(part.startsWith("eye"));
      }
      const loops = introHoldLoops(geometry);
      expect([loops.play, loops.ring, ...loops.sparkles].some((loop) => loop.order.includes("scaleY"))).toBe(false);
    }
  });

  it("la caméra ne porte qu'UN zoom (points par unité), le même sur les deux axes", () => {
    for (const view of VIEWS) {
      const plan = introCameraPlan(view.width, view.height, introGeometry(ART, view.width / view.height));
      for (const camera of [plan.from, plan.to]) expect(Object.keys(camera).sort()).toEqual(["offsetX", "offsetY", "zoom"]);
    }
  });
});

describe("la fenêtre allumée aux proportions de l'appareil", () => {
  it("prend le rapport de la fenêtre, centrée dans la vitre, une marge de vitre autour", () => {
    for (const view of VIEWS) {
      const aspect = view.width / view.height;
      const { inner, lit } = introGeometry(ART, aspect);
      expect(lit.width / lit.height).toBeCloseTo(aspect, 6);
      expect(lit.x + lit.width / 2).toBeCloseTo(inner.x + inner.width / 2, 6);
      expect(lit.y + lit.height / 2).toBeCloseTo(inner.y + inner.height / 2, 6);
      expect(lit.x - inner.x).toBeGreaterThanOrEqual(INTRO_LIT_MARGIN - 1e-9);
      expect(lit.y - inner.y).toBeGreaterThanOrEqual(INTRO_LIT_MARGIN - 1e-9);
      // Elle touche la marge sur un axe au moins : la plus grande possible.
      expect(Math.min(lit.x - inner.x, lit.y - inner.y)).toBeCloseTo(INTRO_LIT_MARGIN, 6);
    }
  });

  it("sans format (la TV), toute la vitre — comme avant", () => {
    const { inner, lit } = introGeometry(ART);
    expect(lit).toEqual(inner);
    expect(introLitWindow(inner, Number.NaN)).toBe(inner);
    expect(introLitWindow(inner, 0)).toBe(inner);
  });

  it("à l'arrivée, la fenêtre allumée recouvre l'écran de l'appareil, coins compris, sans le dépasser de beaucoup", () => {
    for (const view of VIEWS) {
      const geometry = introGeometry(ART, view.width / view.height);
      const zoom = introCameraPlan(view.width, view.height, geometry).to.zoom;
      expect(zoom).toBe(coverZoom(view.width, view.height, geometry.lit));
      expect(geometry.lit.width * zoom).toBeGreaterThanOrEqual(view.width);
      expect(geometry.lit.height * zoom).toBeGreaterThanOrEqual(view.height);
      // Même rapport : la page n'a que de fines bandes autour (l'arrondi, la marge de 3 %).
      expect((geometry.lit.width * zoom) / view.width).toBeLessThan(1.15);
    }
  });
});
