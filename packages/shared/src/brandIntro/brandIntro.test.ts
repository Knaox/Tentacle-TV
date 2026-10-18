import { describe, expect, it } from "vitest";
import {
  INTRO_HOLD_AT,
  INTRO_SCORE,
  INTRO_TIMING,
  TA_DUM_GAP_S,
  cameraAt,
  cameraAtTime,
  computedOffsets,
  coverZoom,
  cubicBezier,
  frontArmsAway,
  introCameraPlan,
  introGeometry,
  introHoldLoops,
  introTracks,
  loopPoseAt,
  pathBounds,
  poseAt,
  revealAt,
  seededRandom,
} from "./index";

// Un logo de test : la forme des constantes générées, réduite à l'essentiel.
const ART = {
  SCREEN: { x: 58, y: 104, width: 124, height: 92, rx: 16, frameWidth: 5 },
  PLAY_PATH: "M 114 134 L 142 150 L 114 166 Z",
  FRONT_ARM_PATHS: ["M 81 92 L 60 150 L 93 190 Z", "M 159 92 L 180 150 L 147 190 Z"],
  BACK_ARM_PATHS: ["M 84 150 L 71 200 L 102 228 Z", "M 156 150 L 169 200 L 138 228 Z"],
  EYE_WHITES: [{ cx: 99, cy: 82, r: 15.5 }, { cx: 141, cy: 82, r: 15.5 }],
};
const geometry = introGeometry(ART);

describe("courbes", () => {
  it("cubicBezier tient ses bouts et la diagonale", () => {
    const linear = cubicBezier(0, 0, 1, 1);
    expect(linear(0.37)).toBeCloseTo(0.37, 5);
    const out = cubicBezier(0.22, 1, 0.36, 1);
    expect(out(0)).toBe(0);
    expect(out(1)).toBe(1);
    expect(out(0.5)).toBeGreaterThan(0.9);
  });
});

describe("géométrie", () => {
  it("l'écran, son intérieur, le bouton lecture", () => {
    expect(geometry.target).toEqual({ x: 120, y: 150 });
    expect(geometry.inner).toEqual({ x: 60.5, y: 106.5, width: 119, height: 87, rx: 13.5 });
    expect(geometry.play.x).toBeCloseTo(123.33, 2);
    expect(geometry.reach).toBeGreaterThan(Math.hypot(182 - 123.33, 104 - 150));
  });

  it("l'encombrement d'un tracé", () => {
    expect(pathBounds("M 1 2 L 5 -3 L 4 9 Z")).toEqual({ x: 1, y: -3, width: 4, height: 12 });
  });
});

describe("caméra", () => {
  it("à l'arrivée, l'intérieur du cadre recouvre la fenêtre, coins compris", () => {
    const zoom = coverZoom(1920, 1080, geometry.inner);
    const halfW = 960 / zoom;
    const halfH = 540 / zoom;
    expect(halfW).toBeLessThanOrEqual(geometry.inner.width / 2);
    expect(halfH).toBeLessThanOrEqual(geometry.inner.height / 2);
  });

  it("part du logo entier et arrive à l'échelle, sans jamais s'écarter avant de revenir", () => {
    const plan = introCameraPlan(1920, 1080, geometry);
    expect(plan.from.zoom).toBeCloseTo(420 / 240, 5);
    expect(cameraAtTime(0, plan)).toEqual(plan.from);
    const end = cameraAtTime(INTRO_TIMING.end, plan);
    expect(end.zoom).toBeCloseTo(plan.to.zoom, 6);
    expect(end.offsetY).toBeCloseTo(0, 6);
    let previous = plan.from.offsetY;
    for (let step = 1; step <= 100; step += 1) {
      const { offsetY } = cameraAt(step / 100, plan.from, plan.to);
      expect(offsetY).toBeLessThanOrEqual(previous + 1e-9);
      expect(offsetY).toBeGreaterThanOrEqual(0);
      previous = offsetY;
    }
  });
});

describe("chorégraphie", () => {
  const tracks = introTracks(geometry);

  it("les positions des images clés se répartissent comme en CSS", () => {
    expect(computedOffsets([{}, {}, { offset: 0.9 }, {}])).toEqual([0, 0.45, 0.9, 1]);
  });

  it("une entrée tient son départ avant son tour, son arrivée après", () => {
    expect(poseAt(tracks.hat, 0).opacity).toBe(0);
    expect(poseAt(tracks.hat, 0).transform.y).toBe(-38);
    const settled = poseAt(tracks.hat, INTRO_TIMING.hat.at + INTRO_TIMING.hat.dur);
    expect(settled).toEqual({ opacity: 1, transform: { x: 0, y: 0, rotate: 0, scale: 1, scaleY: 1 } });
  });

  it("le geste qui suit l'emporte, l'opacité de l'entrée demeure", () => {
    const released = poseAt(tracks.frontArm0, INTRO_TIMING.end);
    expect(released.opacity).toBe(1);
    expect(released.transform.rotate).toBeCloseTo(26, 6);
    expect(released.transform.x).toBeCloseTo(-8, 6);
  });

  it("le bouton s'enfonce, puis s'efface en grandissant à l'allumage", () => {
    expect(poseAt(tracks.play, INTRO_TIMING.press.at + 200).transform.scale).toBeCloseTo(0.78, 6);
    const gone = poseAt(tracks.play, INTRO_TIMING.burst.at + INTRO_TIMING.burst.dur);
    expect(gone.opacity).toBe(0);
  });

  it("l'éclair et l'onde ne valent que pendant leur tour", () => {
    expect(poseAt(tracks.flash, 0).opacity).toBe(0);
    // La courbe porte sur le temps : le sommet (offset .22 de l'avancement) tombe tôt.
    const peak = Math.max(...Array.from({ length: 56 }, (_, step) => poseAt(tracks.flash, INTRO_TIMING.flash.at + step * 10).opacity));
    expect(peak).toBeGreaterThan(0.95);
    expect(poseAt(tracks.ring, INTRO_TIMING.end).opacity).toBe(0);
  });

  it("toute piste se pose avant l'arrivée", () => {
    for (const track of Object.values(tracks)) {
      for (const animation of track.animations) expect(animation.at + animation.dur).toBeLessThanOrEqual(INTRO_TIMING.end);
    }
  });

  it("la vitre s'ouvre à l'allumage, les bras avant s'effacent pendant la plongée", () => {
    expect(revealAt(INTRO_TIMING.tvOn - 1)).toBe(0);
    expect(revealAt(INTRO_TIMING.reveal.at + INTRO_TIMING.reveal.dur)).toBe(1);
    expect(frontArmsAway(0)).toEqual({ scale: 1, opacity: 1 });
    expect(frontArmsAway(1).opacity).toBe(0);
  });
});

describe("attente", () => {
  it("s'arrête juste avant l'appui, après que tout s'est posé hors des bras", () => {
    expect(INTRO_HOLD_AT).toBe(INTRO_TIMING.press.at - 80);
    expect(INTRO_TIMING.hat.at + INTRO_TIMING.hat.dur).toBeLessThan(INTRO_HOLD_AT);
  });

  it("les étincelles sont éteintes avant leur tour et reviennent à chaque mesure", () => {
    const loops = introHoldLoops(geometry);
    const sparkle = loops.sparkles[0];
    if (!sparkle) throw new Error("étincelle");
    expect(loopPoseAt(sparkle, 0).opacity).toBe(0);
    const lit = loopPoseAt(sparkle, sparkle.delay + 0.16 * sparkle.period).opacity;
    expect(lit).toBeGreaterThan(0.5);
    expect(loopPoseAt(sparkle, sparkle.delay + sparkle.period + 0.16 * sparkle.period).opacity).toBeCloseTo(lit, 6);
  });
});

describe("partition", () => {
  it("l'écart du ta-dum est celui de l'appui à l'allumage", () => {
    expect(TA_DUM_GAP_S).toBeCloseTo(0.28, 6);
    expect(INTRO_SCORE.dum.decay).toBeGreaterThan(INTRO_SCORE.ta.decay);
  });

  it("le tirage est fixe : le fichier dérivé se régénère à l'identique", () => {
    const a = seededRandom(8);
    const b = seededRandom(8);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
