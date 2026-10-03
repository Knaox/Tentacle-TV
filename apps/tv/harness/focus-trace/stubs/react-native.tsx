import { Fragment, createElement, useLayoutEffect, type ReactNode } from "react";

/**
 * Une doublure de react-native pour le banc de traces du focus : juste ce que
 * les applicateurs du focus importent, et le relevé de ce qu'ils font de natif.
 *
 * - `TVFocusGuideView` rendu inscrit ses props dans `globalThis.__guides[nom]`
 *   (le nom vient de son `style.benchName`) ;
 * - `TVEventHandler.addListener` garde l'écouteur : le banc émet les
 *   événements natifs lui-même (`globalThis.__emit`) ;
 * - `findNodeHandle` rend le numéro que le banc a donné au nœud.
 */

type Props = Record<string, unknown> & { children?: ReactNode; style?: { benchName?: string } };

const bench = globalThis as unknown as {
  __guides: Record<string, Props>;
  __tvListeners: Set<(event: unknown) => void>;
  __emit: (event: unknown) => void;
  __appState: { current: string; listeners: Set<(state: string) => void> };
};
bench.__guides ??= {};
bench.__tvListeners ??= new Set();
bench.__emit = (event) => {
  for (const listener of [...bench.__tvListeners]) listener(event);
};
bench.__appState ??= { current: "active", listeners: new Set() };

export const Platform = {
  OS: "ios",
  isTV: true,
  select: <T,>(options: Record<string, T>): T | undefined => options.ios ?? options.default,
};

export const StyleSheet = {
  create: <T,>(styles: T): T => styles,
  absoluteFill: {},
  absoluteFillObject: {},
  flatten: <T,>(style: T): T => style,
};

function hostComponent(name: string) {
  return function Host(props: Props) {
    const key = props.style?.benchName ?? name;
    bench.__guides[key] = props;
    useLayoutEffect(() => () => {
      if (bench.__guides[key] === props) delete bench.__guides[key];
    });
    return createElement(Fragment, null, props.children);
  };
}

export const View = hostComponent("View");
export const TVFocusGuideView = hostComponent("TVFocusGuideView");

export function requireNativeComponent(name: string) {
  return hostComponent(name);
}

export const UIManager = { getViewManagerConfig: () => null };

export function findNodeHandle(node: unknown): number | null {
  return (node as { __handle?: number } | null)?.__handle ?? null;
}

export const TVEventHandler = {
  addListener(listener: (event: unknown) => void) {
    bench.__tvListeners.add(listener);
    return { remove: () => bench.__tvListeners.delete(listener) };
  },
};

export const TVEventControl = {
  enableTVPanGesture: () => {},
  disableTVPanGesture: () => {},
};

export const AppState = {
  get currentState() {
    return bench.__appState.current;
  },
  addEventListener(_type: string, listener: (state: string) => void) {
    bench.__appState.listeners.add(listener);
    return { remove: () => bench.__appState.listeners.delete(listener) };
  },
};

export const AccessibilityInfo = {
  isReduceMotionEnabled: () => Promise.resolve(false),
  addEventListener: () => ({ remove: () => {} }),
};
