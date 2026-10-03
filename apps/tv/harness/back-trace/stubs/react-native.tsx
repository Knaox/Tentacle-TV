import { Fragment, createElement, useLayoutEffect, type ReactNode } from "react";

/**
 * Une doublure de react-native pour le banc de traces : juste ce que la portée
 * du Retour importe, et l'enregistrement de ce qu'elle rend de natif.
 *
 * Une vue native rendue inscrit ses props dans `globalThis.__native[nom]`
 * (la dernière rendue) ; démontée, elle s'en retire. BackHandler note chaque
 * appel dans `globalThis.__calls` : la portée ne doit jamais s'y abonner.
 */

declare const __BENCH_OS__: "ios" | "android";

type Props = Record<string, unknown> & { children?: ReactNode };

const bench = globalThis as unknown as { __native: Record<string, Props>; __calls: string[] };
bench.__native ??= {};
bench.__calls ??= [];

export const Platform = {
  OS: __BENCH_OS__,
  select: <T,>(options: Record<string, T>): T | undefined => options[__BENCH_OS__] ?? options.default,
};

export const StyleSheet = {
  create: <T,>(styles: T): T => styles,
  absoluteFill: {},
  absoluteFillObject: {},
  flatten: <T,>(style: T): T => style,
};

function hostComponent(name: string) {
  return function Host(props: Props) {
    bench.__native[name] = props;
    useLayoutEffect(() => () => {
      if (bench.__native[name] === props) delete bench.__native[name];
    });
    return createElement(Fragment, null, props.children);
  };
}

export const View = hostComponent("View");

export function requireNativeComponent(name: string) {
  return hostComponent(name);
}

export const findNodeHandle = (): null => null;

export const BackHandler = {
  addEventListener(event: string) {
    bench.__calls.push(`BackHandler.addEventListener:${event}`);
    return { remove: () => bench.__calls.push(`BackHandler.remove:${event}`) };
  },
  exitApp() {
    bench.__calls.push("BackHandler.exitApp");
  },
};

/** L'entrée unique de la télécommande (`platform/tvos/input`) s'abonne au natif à la demande. */
export const TVEventHandler = {
  addListener() {
    bench.__calls.push("TVEventHandler.addListener");
    return { remove: () => bench.__calls.push("TVEventHandler.remove") };
  },
};

export const TVEventControl = {
  enableTVPanGesture: () => bench.__calls.push("TVEventControl.enableTVPanGesture"),
  disableTVPanGesture: () => bench.__calls.push("TVEventControl.disableTVPanGesture"),
};
