/**
 * La chorégraphie du logo : qui bouge, quand, comment (ms depuis le début) —
 * celle du site (`introTimeline.js`), en données.
 *
 *   0 ……… la lueur s'allume, le poulpe apparaît, ses bras enlacent l'écran,
 *         le chapeau tombe, le bouton lecture pulse, il cligne des yeux
 *   1240 … il appuie sur lecture — « ta » (`introScore`)
 *   1520 … l'écran s'allume — « dum » : un cercle s'ouvre sur l'écran suivant
 *         lui-même, les bras relâchent l'écran ; l'écart est celui d'un ta-dum
 *   1710 … la caméra plonge dans l'écran (`introCamera`)
 *   3010 … l'écran suivant est à l'échelle 1 : le décor disparaît, rien ne bouge
 *
 * Remplissages : `both` pour une ENTRÉE (l'état de départ vaut pendant
 * l'attente, sinon la pièce paraîtrait avant son tour) ; `forwards` pour un
 * geste qui suit une entrée.
 */
import { clamp, introEasing, progressOf, smoothstep } from "./easing";
import type { IntroGeometry, IntroPoint } from "./introGeometry";
import type { IntroAnimation, IntroTrack } from "./introPose";

export const INTRO_TIMING = {
  glow: { at: 0, dur: 900 },
  body: { at: 60, dur: 760 },
  backArms: { at: 200, dur: 760, stagger: 80 },
  frontArms: { at: 280, dur: 900, stagger: 80 },
  hat: { at: 470, dur: 640 },
  ring: { at: 820, dur: 560 },
  blink: { at: 980, dur: 220 },
  press: { at: 1240, dur: 130 },
  tvOn: 1520,
  burst: { at: 1520, dur: 420 },
  reveal: { at: 1520, dur: 500 },
  flash: { at: 1520, dur: 560 },
  release: { at: 1520, dur: 560 },
  zoom: { at: 1710, dur: 1300 },
  end: 3010,
} as const;

/** Les pièces animées de la scène. */
export type IntroPartId =
  | "glow"
  | "head"
  | "body"
  | "backArm0"
  | "backArm1"
  | "eye0"
  | "eye1"
  | "ring"
  | "play"
  | "flash"
  | "hat"
  | "frontArm0"
  | "frontArm1";

const staggered = ({ at, dur, stagger }: { at: number; dur: number; stagger: number }, index: number) => ({
  at: at + index * stagger,
  dur,
});

const entry = (span: { at: number; dur: number }, easing: IntroAnimation["easing"], frames: IntroAnimation["frames"]): IntroAnimation => ({
  ...span,
  easing,
  fill: "both",
  frames,
});

/** Les pistes de chaque pièce, pivots tirés de la géométrie du logo. */
export function introTracks(geometry: IntroGeometry): Record<IntroPartId, IntroTrack> {
  const T = INTRO_TIMING;
  const { play } = geometry;
  const pivotOf = (points: readonly IntroPoint[], index: number): IntroPoint => points[index] ?? geometry.target;
  // Le poulpe paraît d'un rebond, autour du milieu de l'écran.
  const rise = entry(T.body, "outBack", [{ opacity: 0, t: { y: 16, scale: 0.82 } }, { opacity: 1, t: {} }]);
  const bodyPivot = { x: 120, y: 132 };

  const backArm = (index: number): IntroTrack => ({
    pivot: pivotOf(geometry.backArmPivots, index),
    order: ["rotate", "scale"],
    baseOpacity: 1,
    // Les bras arrière se déroulent depuis derrière l'écran…
    animations: [entry(staggered(T.backArms, index), "outBack", [{ opacity: 0, t: { rotate: index ? -26 : 26, scale: 0.7 } }, { opacity: 1, t: {} }])],
  });

  const frontArm = (index: number): IntroTrack => {
    const side = index ? -1 : 1;
    return {
      pivot: pivotOf(geometry.frontArmPivots, index),
      order: ["rotate", "x"],
      baseOpacity: 1,
      animations: [
        // …les bras avant arrivent ouverts et se referment sur lui : l'étreinte du logo.
        entry(staggered(T.frontArms, index), "hug", [{ opacity: 0, t: { rotate: 44 * side } }, { opacity: 1, offset: 0.3 }, { opacity: 1, t: {} }]),
        // Ils relâchent l'écran pour le présenter.
        { ...T.release, easing: "out", fill: "forwards", frames: [{ t: {} }, { t: { rotate: 26 * side, x: -8 * side } }] },
      ],
    };
  };

  const eye = (index: number): IntroTrack => ({
    pivot: pivotOf(geometry.eyes, index),
    order: ["scaleY"],
    baseOpacity: 1,
    animations: [{ ...T.blink, easing: "easeInOut", fill: "none", frames: [{ t: {} }, { t: { scaleY: 0.08 }, offset: 0.45 }, { t: {} }] }],
  });

  return {
    glow: {
      pivot: { x: 120, y: 136 },
      order: ["scale"],
      baseOpacity: 1,
      animations: [entry(T.glow, "out", [{ opacity: 0, t: { scale: 0.55 } }, { opacity: 1, t: {} }])],
    },
    head: { pivot: bodyPivot, order: ["y", "scale"], baseOpacity: 1, animations: [rise] },
    body: { pivot: bodyPivot, order: ["y", "scale"], baseOpacity: 1, animations: [rise] },
    backArm0: backArm(0),
    backArm1: backArm(1),
    eye0: eye(0),
    eye1: eye(1),
    ring: {
      pivot: play,
      order: ["scale"],
      baseOpacity: 0,
      animations: [{ ...T.ring, easing: "out", fill: "none", frames: [{ opacity: 0.9, t: { scale: 0.7 } }, { opacity: 0, t: { scale: 2 } }] }],
    },
    play: {
      pivot: play,
      order: ["scale"],
      baseOpacity: 1,
      animations: [
        // Il appuie sur lecture ; le bouton s'efface en grandissant quand l'écran s'allume.
        { ...T.press, easing: "easeIn", fill: "forwards", frames: [{ t: {} }, { t: { scale: 0.78 } }] },
        { ...T.burst, easing: "out", fill: "forwards", frames: [{ opacity: 1, t: { scale: 0.78 } }, { opacity: 0, t: { scale: 2.4 } }] },
      ],
    },
    flash: {
      pivot: play,
      order: ["scale"],
      baseOpacity: 0,
      animations: [
        {
          ...T.flash,
          easing: "out",
          fill: "none",
          frames: [{ opacity: 0, t: { scale: 0.15 } }, { opacity: 1, t: { scale: 0.6 }, offset: 0.22 }, { opacity: 0, t: { scale: 1.25 } }],
        },
      ],
    },
    hat: {
      pivot: { x: 120, y: 44 },
      order: ["y", "rotate"],
      baseOpacity: 1,
      animations: [entry(T.hat, "outBounce", [{ opacity: 0, t: { y: -38, rotate: -14 } }, { opacity: 1, t: {} }])],
    },
    frontArm0: frontArm(0),
    frontArm1: frontArm(1),
  };
}

/** L'ouverture de la vitre (0 → 1 : le cercle atteint le coin le plus lointain de l'écran). */
export const revealAt = (t: number): number => introEasing("reveal")(progressOf(t, INTRO_TIMING.reveal));

/**
 * Les bras avant sont « devant » : pendant la plongée ils filent hors champ
 * plus vite que le reste (parallaxe autour du centre de l'écran), puis
 * s'effacent. `eased` : l'avancement de la plongée passé par sa courbe.
 */
export function frontArmsAway(eased: number): { scale: number; opacity: number } {
  return { scale: 1 + 2.4 * eased * eased, opacity: 1 - smoothstep(clamp((eased - 0.18) / 0.45)) };
}
