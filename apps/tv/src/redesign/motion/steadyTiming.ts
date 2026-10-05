import {
  defineAnimation,
  type AnimationCallback,
  type AnimationObject,
  type EasingFunction,
  type EasingFunctionFactory,
} from "react-native-reanimated";

/**
 * Un `withTiming` qui suit les IMAGES rendues (profil de rendu
 * `steadyMotion`, Android TV) : chaque image n'avance la course que du temps
 * écoulé depuis la précédente, borné à deux images (`MAX_STEP_MS`).
 *
 * Pourquoi : sur la Shield, monter ce qui paraît (la vignette du défilement et
 * son décompte, un panneau) retient le fil d'interface 100 à 400 ms. Une
 * animation à l'horloge murale part avant ce blocage et le compte : un fondu
 * d'entrée de 140 ms était fini avant sa première image — la pilule
 * apparaissait d'un coup, et sa sortie se coupait de même. Ici, la course
 * reprend où elle en était : on voit le fondu en entier. Sans blocage, chaque
 * image avance d'une image, et la courbe, la durée et les valeurs sont celles
 * de `withTiming`.
 *
 * Sur Apple TV, rien ne change (`withTiming`) : l'animation y suit l'horloge.
 */

/** Ce qu'une image en retard avance au plus : deux images à 60 Hz. */
export const MAX_STEP_MS = 34;

interface SteadyTimingAnimation extends AnimationObject<number> {
  current: number;
  toValue: number;
  startValue: number;
  /** Le temps de course accumulé, image par image. */
  elapsed: number;
  lastTimestamp: number;
  easing: EasingFunction;
}

export function withSteadyTiming(
  toValue: number,
  config: { duration: number; easing: EasingFunction | EasingFunctionFactory },
  callback?: AnimationCallback,
): number {
  "worklet";
  return defineAnimation<SteadyTimingAnimation>(toValue, () => {
    "worklet";
    function onFrame(animation: SteadyTimingAnimation, now: number): boolean {
      const step = Math.min(Math.max(0, now - animation.lastTimestamp), MAX_STEP_MS);
      animation.lastTimestamp = now;
      animation.elapsed += step;
      if (animation.elapsed >= config.duration) {
        animation.current = animation.toValue;
        return true;
      }
      const progress = animation.easing(animation.elapsed / config.duration);
      animation.current = animation.startValue + (animation.toValue - animation.startValue) * progress;
      return false;
    }

    function onStart(animation: SteadyTimingAnimation, value: number, now: number): void {
      animation.startValue = value;
      animation.current = value;
      animation.elapsed = 0;
      animation.lastTimestamp = now;
      // Une courbe de Bézier de Reanimated se fabrique (`factory`), comme dans `withTiming`.
      animation.easing = typeof config.easing === "object" ? config.easing.factory() : config.easing;
    }

    return {
      onFrame,
      onStart,
      toValue,
      current: toValue,
      startValue: 0,
      elapsed: 0,
      lastTimestamp: 0,
      easing: (t: number) => t,
      callback,
    };
  }) as unknown as number;
}
