import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { runOnJS, useReducedMotion, useSharedValue, withDelay, type SharedValue } from "react-native-reanimated";
import { MOTION_ENABLED, motionTo, type Motion } from "./motion";

/**
 * Une valeur de 0 à 1 qui suit `on` selon `motion` (`motion.ts`) : c'est
 * elle qui porte un agrandissement, un fondu, un recul — dans un
 * `useAnimatedStyle`, sur le fil d'interface.
 *
 * Lancée dans la MÊME tâche JS que le rendu qui change `on`
 * (`useLayoutEffect`) : sans attendre les effets passifs, l'animation part à
 * l'image suivante. Interrompue, elle repart d'où elle en est ; un ressort
 * relancé vers la même cible continue, avec sa vitesse. Animations réduites,
 * ou hors Apple TV : instantanée.
 */
export function useMotion(on: boolean, motion: Motion): SharedValue<number> {
  const reduced = useReducedMotion();
  const progress = useSharedValue(on ? 1 : 0);
  // La cible posée en dernier : une nouvelle identité de `motion` (un nombre
  // recalculé) ne relance rien.
  const target = useRef(on ? 1 : 0);
  useLayoutEffect(() => {
    const next = on ? 1 : 0;
    if (next === target.current) return;
    target.current = next;
    progress.value = motionTo(next, motion, reduced);
  }, [on, motion, reduced, progress]);
  return progress;
}

export interface Presence {
  /** À monter : pendant `shown`, et le temps de la sortie. */
  mounted: boolean;
  /** 0 → 1 à l'entrée, 1 → 0 à la sortie. */
  progress: SharedValue<number>;
}

/**
 * Ce qui paraît et DISPARAÎT en mouvement — une surimpression, une ligne sous
 * une carte : montée dès que `shown`, elle entre (0 → 1) ; `shown` retombé,
 * elle sort (1 → 0) puis se démonte, à la fin de sa sortie seulement. Rendue
 * pendant sa sortie, elle y revient d'où elle en est, sans se démonter.
 *
 * Une valeur partagée plutôt qu'une animation de mise en page (`entering`,
 * `exiting`) : montées avec un écran, ou dans une `Modal`, celles-ci
 * restaient parfois figées à mi-course (`useAppear`). Au repos, rien : ni
 * vue, ni animation.
 */
export function usePresence(shown: boolean, motion: Motion): Presence {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(shown);
  const progress = useSharedValue(0);
  // Une sortie terminée ne démonte que si rien ne l'a annulée depuis.
  const generation = useRef(0);
  if (shown && !mounted) setMounted(true);

  const unmount = useCallback((gen: number) => {
    if (gen === generation.current) setMounted(false);
  }, []);

  useLayoutEffect(() => {
    if (!mounted) return;
    const gen = ++generation.current;
    if (shown) {
      progress.value = motionTo(1, motion, reduced);
      return;
    }
    progress.value = motionTo(0, motion, reduced, (finished) => {
      "worklet";
      if (finished) runOnJS(unmount)(gen);
    });
    // `motion` : lu au moment du geste, il ne relance rien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, mounted, reduced, progress, unmount]);

  return { mounted: mounted || shown, progress };
}

export interface Exit extends Presence {
  /** La sortie se joue : ce qui part ne se focalise plus, ne s'appuie plus. */
  leaving: boolean;
}

/**
 * La SORTIE seule, pour ce qui a déjà sa propre entrée — un panneau du
 * lecteur arrive en glissant (`useOverlayArrival`) : monté tant que `shown`,
 * il le reste le temps de sa sortie (`progress`, 1 → 0), puis se démonte.
 * Plein (1) tant qu'il est affiché : l'entrée reste celle du contenu.
 * Rouvert pendant sa sortie, il y revient d'où il en est, sans se démonter.
 *
 * Ce qui part GARDE son focus pendant sa sortie : il s'efface d'un bloc, sa
 * ligne focalisée comme le reste. `onExited` part à la fin, juste avant le
 * démontage — le moment de rendre le focus à ce qui le reprend, quand plus
 * rien ne se voit de ce qui s'en va. Pendant la sortie (`leaving`),
 * l'appelant n'y laisse aucun geste agir.
 */
export function useExit(shown: boolean, motion: Motion, onExited?: () => void): Exit {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(shown);
  const progress = useSharedValue(1);
  const generation = useRef(0);
  // Une sortie commencée : rouvert, il revient d'où il en est ; monté à neuf, plein d'emblée.
  const leavingFrom = useRef(false);
  const exited = useRef(onExited);
  exited.current = onExited;
  if (shown && !mounted) setMounted(true);

  const unmount = useCallback((gen: number) => {
    if (gen !== generation.current) return;
    leavingFrom.current = false;
    exited.current?.();
    setMounted(false);
  }, []);

  useLayoutEffect(() => {
    if (!mounted) return;
    const gen = ++generation.current;
    if (shown) {
      progress.value = leavingFrom.current ? motionTo(1, motion, reduced) : 1;
      leavingFrom.current = false;
      return;
    }
    leavingFrom.current = true;
    progress.value = motionTo(0, motion, reduced, (finished) => {
      "worklet";
      if (finished) runOnJS(unmount)(gen);
    });
    // `motion` : lu au moment du geste, il ne relance rien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, mounted, reduced, progress, unmount]);

  return { mounted: mounted || shown, leaving: mounted && !shown, progress };
}

/**
 * 0 → 1 UNE fois, à l'arrivée (le montage) : le contenu d'un écran poussé,
 * une image qui se pose. `delayMs` : ce qu'il attend — l'image précède
 * le texte. Animations réduites, ou hors Apple TV : déjà à 1.
 */
export function useEntrance(motion: Motion, delayMs = 0): SharedValue<number> {
  const reduced = useReducedMotion();
  const instant = reduced || !MOTION_ENABLED;
  const progress = useSharedValue(instant ? 1 : 0);
  useLayoutEffect(() => {
    if (instant) return;
    progress.value = delayMs > 0 ? withDelay(delayMs, motionTo(1, motion)) : motionTo(1, motion);
    // Une seule arrivée : au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return progress;
}
