import { Easing, withSpring, withTiming, type AnimationCallback } from "react-native-reanimated";
import { TV_MOTION, type TvSpring } from "@tentacle-tv/theme";
import { BRIEF_MAX_MS, briefLegMs } from "@tentacle-tv/tv-core";
import { RENDER } from "../render/renderProfile";
import { withSteadyTiming } from "./steadyTiming";
// effectOff : interrupteur de MESURE (lot Lite), app de mesure seulement.
import { effectOff } from "../render/measuredEffects";

/**
 * Le mouvement de la refonte, joué sur le fil d'interface : un préréglage dit
 * comment une valeur va de 0 à 1 (ce qui arrive) et revient (ce qui s'en va),
 * avec les jetons de `TV_MOTION` — les mêmes sur Apple TV et Android TV.
 *
 * L'aiguillage vit dans le profil de rendu (`RENDER.motion`) : un profil sans
 * mouvement rend chaque préréglage instantané. Réduire les animations (réglage
 * d'accessibilité) fait de même.
 */

/** Vrai quand le profil de rendu de l'appareil joue le mouvement. */
export const MOTION_ENABLED: boolean = RENDER.motion && !effectOff("motion");
/** Les fondus suivent les images rendues (`steadyTiming`, Android TV). */
const STEADY: boolean = RENDER.steadyMotion;
/** Le mouvement BREF du profil Lite (tv-core `liteMotion`) : aucun ressort,
 *  150 ms au plus, ce qui accompagne seulement posé d'un coup. */
const BRIEF: boolean = RENDER.motionStyle === "brief";

const bezier = ([x1, y1, x2, y2]: readonly [number, number, number, number]) => Easing.bezier(x1, y1, x2, y2);

/** Les courbes de `TV_MOTION`, en fonctions d'accélération Reanimated. */
export const EASE = {
  out: bezier(TV_MOTION.curve.out),
  inOut: bezier(TV_MOTION.curve.inOut),
  in: bezier(TV_MOTION.curve.in),
} as const;

/** Un ressort d'Apple (réponse, amortissement) en ressort physique de masse
 *  1 : raideur (2π / réponse)², amortissement 4π · fraction / réponse. Les
 *  seuils de repos sont ceux d'une valeur de 0 à 1 (deux millièmes : un
 *  cinquième de point sur une affiche agrandie), pas ceux, en points, du
 *  défaut de Reanimated. */
export function springOf({ response, dampingFraction }: TvSpring) {
  const omega = (2 * Math.PI) / response;
  return {
    mass: 1,
    stiffness: omega * omega,
    damping: 2 * dampingFraction * omega,
    restDisplacementThreshold: 0.002,
    restSpeedThreshold: 0.02,
  };
}

type Leg = { kind: "spring"; config: ReturnType<typeof springOf> } | { kind: "timing"; duration: number; easing: (typeof EASE)[keyof typeof EASE] };

const spring = (tokens: TvSpring): Leg => ({ kind: "spring", config: springOf(tokens) });
const timing = (duration: number, easing: (typeof EASE)[keyof typeof EASE]): Leg => ({ kind: "timing", duration, easing });

/** Les préréglages : l'aller (vers 1) et le retour (vers 0). */
const PRESETS = {
  /** Le focus : un ressort vif à l'arrivée, un retour bref et doux. */
  focus: { enter: spring(TV_MOTION.spring.focus), exit: timing(TV_MOTION.focus.outMs, EASE.out) },
  /** Les voisines d'une carte focalisée qui reculent, puis reviennent. */
  recede: { enter: timing(TV_MOTION.focus.recedeMs, EASE.inOut), exit: timing(TV_MOTION.focus.recedeMs, EASE.inOut) },
  /** Ce qui paraît au focus ou à l'ouverture (légende, indication, habillage). */
  reveal: { enter: timing(TV_MOTION.reveal.inMs, EASE.out), exit: timing(TV_MOTION.reveal.outMs, EASE.in) },
  /** Le voile d'une surimpression. */
  veil: { enter: timing(TV_MOTION.overlay.veilInMs, EASE.out), exit: timing(TV_MOTION.overlay.veilOutMs, EASE.in) },
  /** Un panneau qui surgit, puis se retire. */
  panel: { enter: spring(TV_MOTION.spring.panel), exit: timing(TV_MOTION.overlay.panelOutMs, EASE.in) },
  /** La navigation qui se déplie, puis se replie. */
  unfold: { enter: spring(TV_MOTION.spring.unfold), exit: timing(TV_MOTION.focus.outMs + 40, EASE.out) },
  /** OK enfoncé (vers 1), relâché (vers 0, avec un soupçon de rebond). */
  press: { enter: timing(TV_MOTION.press.inMs, EASE.out), exit: spring(TV_MOTION.spring.press) },
  /** Le fond vivant qui change de lumière. */
  ambient: { enter: timing(TV_MOTION.crossfade.ambientMs, EASE.inOut), exit: timing(TV_MOTION.crossfade.ambientMs, EASE.inOut) },
  /** L'image du héros qui tourne. */
  hero: { enter: timing(TV_MOTION.crossfade.heroMs, EASE.inOut), exit: timing(TV_MOTION.crossfade.heroMs, EASE.inOut) },
  /** Le halo du héros qui tourne : avec l'image (posé d'un coup en Lite). */
  heroHalo: { enter: timing(TV_MOTION.crossfade.heroMs, EASE.inOut), exit: timing(TV_MOTION.crossfade.heroMs, EASE.inOut) },
  /** Le contenu d'un écran poussé qui arrive (l'en-tête d'une fiche). */
  page: { enter: timing(TV_MOTION.page.enterMs, EASE.out), exit: timing(TV_MOTION.reveal.outMs, EASE.in) },
  /** Une grande image qui se pose : elle recule lentement à sa place. */
  settle: { enter: timing(TV_MOTION.image.settleMs, EASE.out), exit: timing(TV_MOTION.image.settleMs, EASE.out) },
  /** L'habillage du lecteur : il paraît vite, s'efface posément (à l'inactivité). */
  chrome: { enter: timing(TV_MOTION.player.chromeInMs, EASE.out), exit: timing(TV_MOTION.player.chromeOutMs, EASE.inOut) },
  /** Le relais entre un panneau du lecteur et l'habillage, sur la même durée :
   *  ce qui arrive (dessous) se pose vite, ce qui part (dessus) s'attarde
   *  puis file. Leur somme ne retombe jamais sous le plein — ni image où la
   *  vidéo est à nu, ni deux voiles à demi qui laissent passer la lumière
   *  (avec deux courbes égales, le bas de l'image s'éclaircissait de moitié
   *  au milieu du fondu, mesuré). */
  handoff: { enter: timing(TV_MOTION.player.handoffMs, EASE.out), exit: timing(TV_MOTION.player.handoffMs, EASE.in) },
  /** Le même relais pour le HAUT de l'habillage (son voile, le titre) : le
   *  voile d'un panneau y est léger, le sien dense — posé vite dessous, il
   *  assombrissait le haut au-delà de l'arrivée (−30 % sous les épisodes,
   *  mesuré). Symétrique, il n'a fini qu'une fois le panneau parti. */
  handoffTop: { enter: timing(TV_MOTION.player.handoffMs, EASE.inOut), exit: timing(TV_MOTION.player.handoffMs, EASE.inOut) },
  /** Le profil choisi qui s'avance ; s'il est refusé, tout revient à sa place. */
  advance: { enter: timing(TV_MOTION.profile.advanceMs, EASE.out), exit: timing(TV_MOTION.focus.recedeMs, EASE.inOut) },
  /** Une image chargée qui entre en fondu. */
  imageIn: { enter: timing(TV_MOTION.image.fadeInMs, EASE.out), exit: timing(TV_MOTION.reveal.outMs, EASE.in) },
} as const;

export type MotionPreset = keyof typeof PRESETS;

/** Les mêmes préréglages en bref (Lite), en nombres : un worklet les lit
 *  sans appeler tv-core depuis le fil d'interface. */
const BRIEF_LEGS = Object.fromEntries(
  (Object.keys(PRESETS) as MotionPreset[]).map((name) => [name, { enter: briefLegMs(name, 1), exit: briefLegMs(name, 0) }]),
) as Record<MotionPreset, { enter: number; exit: number }>;

/** Un préréglage, ou une durée : une courbe de sortie douce dans les deux sens
 *  (le comportement d'avant les préréglages, pour un interrupteur, un curseur). */
export type Motion = MotionPreset | number;

/**
 * L'animation qui mène une valeur à `target` selon `motion` — 1 : l'aller, 0 :
 * le retour (toute autre cible prend l'aller). À affecter à `.value`, depuis
 * le fil JS ou un worklet. `instant` (animations réduites, hors Apple TV) :
 * la valeur elle-même, sans animation — le rappel part quand même.
 */
export function motionTo(target: number, motion: Motion, instant = false, done?: AnimationCallback) {
  "worklet";
  if (instant || !MOTION_ENABLED) {
    if (done) done(true);
    return target;
  }
  const timed = (duration: number, easing: (typeof EASE)[keyof typeof EASE]) =>
    STEADY ? withSteadyTiming(target, { duration, easing }, done) : withTiming(target, { duration, easing }, done);
  if (BRIEF) {
    const brief = typeof motion === "number" ? null : BRIEF_LEGS[motion];
    const ms = brief ? (target === 0 ? brief.exit : brief.enter) : Math.min(Math.max(0, motion as number), BRIEF_MAX_MS);
    if (ms <= 0) {
      if (done) done(true);
      return target;
    }
    return timed(ms, target === 0 ? EASE.in : EASE.out);
  }
  if (typeof motion === "number") return timed(motion, EASE.out);
  const leg = target === 0 ? PRESETS[motion].exit : PRESETS[motion].enter;
  // Un ressort borne déjà le pas de son intégration (Reanimated : 64 ms).
  return leg.kind === "spring" ? withSpring(target, leg.config, done) : timed(leg.duration, leg.easing);
}
