import { Fragment, createElement, forwardRef, useRef, type ReactNode } from "react";
import { note } from "./record";

/**
 * Une doublure de react-native-reanimated : les valeurs partagées sont de
 * simples boîtes, une animation rend sa cible tout de suite (et prévient de
 * sa fin), un style animé est calculé au rendu et noté sous son étiquette
 * (`nativeID` de la vue animée) quand il porte une translation.
 */

type Props = Record<string, unknown> & { children?: ReactNode };

function finish<T>(target: T, callback?: (finished: boolean) => void): T {
  if (callback) queueMicrotask(() => callback(true));
  return target;
}

export const withTiming = <T,>(target: T, _config?: unknown, callback?: (finished: boolean) => void): T => finish(target, callback);
export const withSpring = <T,>(target: T, _config?: unknown, callback?: (finished: boolean) => void): T => finish(target, callback);
export const withDelay = <T,>(_ms: number, value: T): T => value;
// Une animation écrite à la main (`defineAnimation` : `withSteadyTiming`, Android TV) rend aussi sa cible tout de suite.
export const defineAnimation = <T,>(target: T, factory: () => { callback?: (finished: boolean) => void }): T =>
  finish(target, factory().callback);
export const withSequence = <T,>(...values: T[]): T => values[values.length - 1];
export const withRepeat = <T,>(value: T): T => value;
export const cancelAnimation = () => {};
export const runOnJS = <F extends (...args: never[]) => unknown>(fn: F): F => fn;
export const runOnUI = <F extends (...args: never[]) => unknown>(fn: F): F => fn;
export const useReducedMotion = () => false;
export const interpolate = (value: number, input: number[], output: number[]) => {
  if (value <= input[0]) return output[0];
  for (let i = 1; i < input.length; i++) {
    if (value <= input[i]) return output[i - 1] + ((value - input[i - 1]) / (input[i] - input[i - 1])) * (output[i] - output[i - 1]);
  }
  return output[output.length - 1];
};
export const Extrapolation = { CLAMP: "clamp", EXTEND: "extend", IDENTITY: "identity" };
export const Easing = {
  out: (f: unknown) => f,
  in: (f: unknown) => f,
  inOut: (f: unknown) => f,
  cubic: (t: number) => t,
  quad: (t: number) => t,
  linear: (t: number) => t,
  bezier: () => (t: number) => t,
};

export function useSharedValue<T>(initial: T): { value: T } {
  const box = useRef<{ value: T } | null>(null);
  box.current ??= { value: initial };
  return box.current;
}

export function useDerivedValue<T>(fn: () => T): { value: T } {
  return { value: fn() };
}

export function useAnimatedStyle(fn: () => Record<string, unknown>): Record<string, unknown> {
  return fn();
}

export function useAnimatedReaction() {}

const fade = { duration: () => fade, delay: () => fade, easing: () => fade };
export const FadeIn = fade;
export const FadeOut = fade;

const AnimatedView = forwardRef<unknown, Props>(function AnimatedView(props, _ref) {
  const styles = ([] as unknown[]).concat(props.style ?? []).flat(4) as Array<Record<string, unknown> | false | null>;
  for (const style of styles) {
    const transform = style && (style.transform as Array<Record<string, number>> | undefined);
    const shift = transform?.find((t) => "translateX" in t);
    if (shift) note({ translateX: shift.translateX });
  }
  return createElement(Fragment, null, props.children as ReactNode);
});

const Animated = { View: AnimatedView, Text: AnimatedView, Image: AnimatedView, ScrollView: AnimatedView, createAnimatedComponent: () => AnimatedView };
export default Animated;
