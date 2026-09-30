import { Platform } from "react-native";
import { Easing, withSpring, withTiming, type AnimationCallback } from "react-native-reanimated";
import { TV_MOTION, type TvSpring } from "@tentacle-tv/theme";

/**
 * Le mouvement de la refonte — Apple TV SEULEMENT, joué sur le fil
 * d'interface : un préréglage dit comment une valeur va de 0 à 1 (ce qui
 * arrive) et revient (ce qui s'en va), avec les jetons de `TV_MOTION`.
 *
 * L'aiguillage vit ICI, une fois : hors Apple TV (Android TV, qui ne monte pas
 * encore ces vues), chaque préréglage devient instantané — aucune animation
 * de la refonte n'y part. Réduire les animations (réglage d'accessibilité) fait
 * de même.
 */

/** Apple TV : le seul appareil qui reçoit le mouvement de la refonte. */
export const MOTION_ENABLED: boolean = Platform.OS === "ios" && Platform.isTV;

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
} as const;

export type MotionPreset = keyof typeof PRESETS;
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
  if (typeof motion === "number") return withTiming(target, { duration: motion, easing: EASE.out }, done);
  const leg = target === 0 ? PRESETS[motion].exit : PRESETS[motion].enter;
  return leg.kind === "spring"
    ? withSpring(target, leg.config, done)
    : withTiming(target, { duration: leg.duration, easing: leg.easing }, done);
}
