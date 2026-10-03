import { useEffect, useRef } from "react";

/**
 * Les autres doublures du banc de traces du focus.
 *
 * - `@react-navigation/native` : `useFocusEffect` suit l'écran « devant » que le
 *   banc commande (`globalThis.__screen`) — l'effet part à l'arrivée devant, son
 *   nettoyage au départ ; `useIsFocused` lit le même état ;
 * - `react-native-reanimated` : `useReducedMotion` (faux) ;
 * - `useRailState` (le rail, T4) : `isNavKey`, la convention des clés `nav:` —
 *   le reste du rail n'est pas sous l'épreuve.
 */

type Screen = { focused: boolean; listeners: Set<(focused: boolean) => void> };
const bench = globalThis as unknown as { __screen: Screen };
bench.__screen ??= { focused: true, listeners: new Set() };

export function useFocusEffect(effect: () => undefined | void | (() => void)): void {
  const latest = useRef(effect);
  latest.current = effect;
  useEffect(() => {
    let cleanup: (() => void) | undefined | void;
    const apply = (focused: boolean) => {
      if (focused) cleanup = latest.current();
      else {
        cleanup?.();
        cleanup = undefined;
      }
    };
    if (bench.__screen.focused) apply(true);
    bench.__screen.listeners.add(apply);
    return () => {
      bench.__screen.listeners.delete(apply);
      cleanup?.();
    };
  }, []);
}

export function useIsFocused(): boolean {
  return bench.__screen.focused;
}

export function useReducedMotion(): boolean {
  return false;
}

export const NAV_PREFIX = "nav:";
export const navKeyOf = (entryKey: string) => `${NAV_PREFIX}${entryKey}`;
export const isNavKey = (focusKey: string | null | undefined): boolean => !!focusKey?.startsWith(NAV_PREFIX);
