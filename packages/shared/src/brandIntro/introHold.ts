/**
 * L'ATTENTE de l'ouverture — le poulpe s'arrête juste avant d'appuyer sur
 * lecture, et le bouton SCINTILLE : il bat, quatre étincelles s'allument tour
 * à tour, une onde en part, le poulpe cligne des yeux (site : `introHold.js`).
 *
 * Sur le site, on y attend le geste qui permet le son ; sur un téléviseur,
 * l'écran suivant : tant qu'il n'est pas prêt, l'ouverture attend ici, puis
 * l'appui (« ta »), l'allumage (« dum ») et la plongée partent ensemble.
 */
import type { IntroGeometry, IntroPoint } from "./introGeometry";
import type { IntroFrame, IntroLoop } from "./introPose";
import { INTRO_TIMING } from "./introTimeline";

/** L'instant où l'on s'arrête : 80 ms avant l'appui, de quoi caler le « ta » dessus. */
export const INTRO_HOLD_AT = INTRO_TIMING.press.at - 80;

/** Une seule mesure pour tout le scintillement. */
const BEAT = 1800;

/** Une étoile à quatre branches de rayon 1. */
export const SPARKLE_PATH = "M0 -1C.12 -.12 .12 -.12 1 0C.12 .12 .12 .12 0 1C-.12 .12 -.12 .12 -1 0C-.12 -.12 -.12 -.12 0 -1Z";

/** Où s'allument les étincelles autour du bouton lecture : décalage depuis son centre, rayon, rose ou blanche. */
export const SPARKLES: readonly { dx: number; dy: number; radius: number; pink: boolean }[] = [
  { dx: -22, dy: -21, radius: 7.5, pink: false },
  { dx: 21, dy: -23, radius: 6, pink: true },
  { dx: 19, dy: 23, radius: 5.5, pink: false },
  { dx: -21, dy: 21, radius: 4.5, pink: true },
];

/** Une étincelle : elle naît, tourne d'un huitième de tour, s'éteint. */
const TWINKLE: readonly IntroFrame[] = [
  { opacity: 0, t: { scale: 0.2, rotate: 0 } },
  { opacity: 1, t: { scale: 1, rotate: 45 }, offset: 0.16 },
  { opacity: 0, t: { scale: 0.2, rotate: 90 }, offset: 0.38 },
  { opacity: 0, t: { scale: 0.2, rotate: 90 } },
];

export interface IntroHoldLoops {
  /** Le bouton lecture bat. */
  play: IntroLoop;
  /** Une onde part du bouton. */
  ring: IntroLoop;
  /** Les quatre étincelles, chacune autour de son propre centre (repère de l'étoile, rayon 1). */
  sparkles: readonly IntroLoop[];
  /** Les deux yeux clignent. */
  eyes: readonly IntroLoop[];
}

/** Le centre d'une étincelle, en unités du logo. */
export const sparkleCenter = (play: IntroPoint, index: number): IntroPoint => {
  const sparkle = SPARKLES[index] ?? { dx: 0, dy: 0 };
  return { x: play.x + sparkle.dx, y: play.y + sparkle.dy };
};

export function introHoldLoops(geometry: IntroGeometry): IntroHoldLoops {
  const { play } = geometry;
  return {
    play: {
      pivot: play,
      order: ["scale"],
      period: BEAT,
      delay: 0,
      easing: "easeInOut",
      baseOpacity: 1,
      frames: [{ t: {} }, { t: { scale: 1.08 }, offset: 0.22 }, { t: {}, offset: 0.5 }, { t: {} }],
    },
    ring: {
      pivot: play,
      order: ["scale"],
      period: BEAT,
      delay: 180,
      easing: "out",
      baseOpacity: 0,
      frames: [{ opacity: 0.9, t: { scale: 0.75 } }, { opacity: 0, t: { scale: 2.1 }, offset: 0.55 }, { opacity: 0, t: { scale: 2.1 } }],
    },
    sparkles: SPARKLES.map((_, index) => ({
      pivot: { x: 0, y: 0 },
      order: ["rotate", "scale"],
      period: BEAT,
      delay: 420 + index * 450,
      easing: "easeOut",
      baseOpacity: 0,
      frames: TWINKLE,
    })),
    eyes: geometry.eyes.map((eye) => ({
      pivot: eye,
      order: ["scaleY"],
      period: 3800,
      delay: 1200,
      easing: "linear",
      baseOpacity: 1,
      frames: [{ t: {} }, { t: {}, offset: 0.9 }, { t: { scaleY: 0.08 }, offset: 0.94 }, { t: {}, offset: 0.98 }, { t: {} }],
    })),
  };
}
