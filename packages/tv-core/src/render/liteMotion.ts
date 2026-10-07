/**
 * Le mouvement BREF du profil Lite (`motionStyle: "brief"`) : ce que devient
 * chaque préréglage de la refonte (`apps/tv/src/redesign/motion/motion.ts`)
 * sur un appareil peu puissant. Mesuré sur la Shield : le mouvement de
 * Reanimated faisait rater 26 % des images au focus, 39 % à la fiche ; coupé,
 * 3 % et 11 %. Le Lite ne le coupe pas — il le rend court :
 *
 * - aucun ressort : un fondu à sortie douce, qui finit à l'heure ;
 * - des durées bornées (`BRIEF_MAX_MS`) : quelques images au lieu de vingt ;
 * - ce qui ne fait qu'ACCOMPAGNER une autre animation se pose d'un coup
 *   (0 ms) : l'image qui recule à sa place, les voisines qui reculent, le
 *   halo d'un héros qui tourne — une seule animation lourde à la fois ;
 * - toujours `transform` et `opacity`, sur le fil d'interface (l'app).
 *
 * Module pur : des nombres, aucune courbe Reanimated.
 */

export interface BriefLeg {
  /** L'aller (vers 1), en ms ; 0 : posé d'un coup. */
  enterMs: number;
  /** Le retour (vers 0), en ms ; 0 : posé d'un coup. */
  exitMs: number;
}

/** La plus longue animation du Lite. */
export const BRIEF_MAX_MS = 150;

const leg = (enterMs: number, exitMs: number): BriefLeg => ({ enterMs, exitMs });

/** Les préréglages de l'app, en bref. Un préréglage absent prend `briefFallback`. */
export const BRIEF_MOTION: Readonly<Record<string, BriefLeg>> = {
  /** Le liseré du focus : net, sans ressort. */
  focus: leg(90, 70),
  /** Les voisines ne reculent plus en mouvement : posées. */
  recede: leg(0, 0),
  reveal: leg(100, 70),
  veil: leg(120, 100),
  panel: leg(140, 100),
  unfold: leg(140, 100),
  /** L'appui : un cran, sans rebond au relâché. */
  press: leg(60, 80),
  /** La teinte du fond : UN fondu court quand l'œuvre change. */
  ambient: leg(150, 150),
  /** L'image du héros qui tourne : la seule chose qui fond. */
  hero: leg(150, 150),
  /** Le halo du héros suit l'image sans fondu à lui. */
  heroHalo: leg(0, 0),
  page: leg(120, 70),
  /** Une grande image se pose à sa place, sans reculer lentement. */
  settle: leg(0, 0),
  chrome: leg(140, 140),
  handoff: leg(140, 140),
  handoffTop: leg(140, 140),
  advance: leg(150, 120),
  /** Une image chargée paraît (un fondu par image d'une grille : non). */
  imageIn: leg(0, 0),
};

/** Une durée écrite à la main (un interrupteur, un curseur), en bref. */
export function briefDuration(ms: number): number {
  return Math.min(Math.max(0, ms), BRIEF_MAX_MS);
}

/** Le préréglage `preset`, en bref, dans le sens de `target` (0 : le retour). */
export function briefLegMs(preset: string, target: number): number {
  const brief = BRIEF_MOTION[preset] ?? leg(BRIEF_MAX_MS, 100);
  return target === 0 ? brief.exitMs : brief.enterMs;
}
