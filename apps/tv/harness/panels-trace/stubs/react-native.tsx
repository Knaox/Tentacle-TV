import { Fragment, createElement, forwardRef, useImperativeHandle, useLayoutEffect, type ReactNode } from "react";
import { hosts, note } from "./record";

/**
 * Une doublure de react-native pour le banc des panneaux : juste ce que les
 * modules éprouvés importent. Une vue native rendue inscrit ses dernières
 * props sous son nom (`hosts`) — celui que lui donne son `nativeID`, sinon
 * son type ; un `Text` note ce qu'il écrit. `TVEventHandler` garde ses
 * écouteurs : le banc leur envoie des événements de la télécommande.
 */

declare const __BENCH_OS__: "ios" | "android";

type Props = Record<string, unknown> & { children?: ReactNode; nativeID?: string };

export const Platform = {
  OS: __BENCH_OS__,
  isTV: true,
  isTVOS: __BENCH_OS__ === "ios",
  Version: "26.2",
  select: <T,>(options: Record<string, T>): T | undefined => options[__BENCH_OS__] ?? options.default,
};

export const StyleSheet = {
  create: <T,>(styles: T): T => styles,
  absoluteFill: { position: "absolute" },
  absoluteFillObject: { position: "absolute" },
  hairlineWidth: 1,
  flatten: <T,>(style: T): T => style,
};

function host(type: string) {
  return forwardRef<unknown, Props>(function Host(props, ref) {
    const name = props.nativeID ?? type;
    hosts.set(name, props);
    useImperativeHandle(ref, () => ({ setNativeProps: (next: object) => note({ setNativeProps: name, props: next }) }));
    useLayoutEffect(() => () => {
      if (hosts.get(name) === props) hosts.delete(name);
    });
    return createElement(Fragment, null, props.children as ReactNode);
  });
}

export const View = host("View");
export const ScrollView = host("ScrollView");
export const Image = host("Image");
export const ActivityIndicator = host("ActivityIndicator");
export const TVFocusGuideView = forwardRef<unknown, Props>(function Guide(props, ref) {
  const style = props.style as { guide?: string } | undefined;
  const name = `guide:${style?.guide ?? "?"}`;
  hosts.set(name, props);
  useImperativeHandle(ref, () => ({}));
  useLayoutEffect(() => () => {
    if (hosts.get(name) === props) hosts.delete(name);
  });
  return createElement(Fragment, null, props.children as ReactNode);
});

export function Text(props: Props) {
  const flat = ([] as unknown[]).concat(props.children ?? []).filter((c) => typeof c === "string" || typeof c === "number");
  note({ text: flat.join("") });
  return null;
}

export const Pressable = forwardRef<unknown, Props>(function Pressable(props, ref) {
  const name = `pressable:${String(props.accessibilityLabel ?? "?")}`;
  hosts.set(name, props);
  useImperativeHandle(ref, () => ({ setNativeProps: (next: object) => note({ setNativeProps: name, props: next }) }));
  useLayoutEffect(() => () => {
    if (hosts.get(name) === props) hosts.delete(name);
  });
  const children = typeof props.children === "function" ? (props.children as (s: object) => ReactNode)({ pressed: false, focused: false }) : props.children;
  return createElement(Fragment, null, children as ReactNode);
});

export function Modal(props: Props) {
  hosts.set("Modal", props);
  useLayoutEffect(() => () => {
    if (hosts.get("Modal") === props) hosts.delete("Modal");
  });
  return props.visible ? createElement(Fragment, null, props.children as ReactNode) : null;
}

export const findNodeHandle = (): null => null;

export const AccessibilityInfo = {
  addEventListener: () => ({ remove() {} }),
  isReduceMotionEnabled: () => Promise.resolve(false),
};

type Listener = (event: Record<string, unknown>) => void;
const tvListeners = new Set<Listener>();
(globalThis as unknown as { __emitTv: (event: Record<string, unknown>) => void }).__emitTv = (event) => {
  for (const listener of [...tvListeners]) listener(event);
};

export const TVEventHandler = {
  addListener(listener: Listener) {
    tvListeners.add(listener);
    return { remove: () => tvListeners.delete(listener) };
  },
};

export const TVEventControl = {
  enableTVPanGesture() {},
  disableTVPanGesture() {},
  enableTVMenuKey() {},
  disableTVMenuKey() {},
};

export const BackHandler = {
  addEventListener: () => ({ remove() {} }),
  exitApp() {},
};

export function requireNativeComponent(name: string) {
  return host(name);
}

export const Dimensions = { get: () => ({ width: 1920, height: 1080, scale: 2, fontScale: 1 }) };
export const useWindowDimensions = () => ({ width: 1920, height: 1080, scale: 2, fontScale: 1 });
export const NativeModules = {};
export const UIManager = { getViewManagerConfig: () => null, hasViewManagerConfig: () => false };
export const I18nManager = { isRTL: false };
export const DeviceEventEmitter = { addListener: () => ({ remove() {} }) };
export const AppState = { currentState: "active", addEventListener: () => ({ remove() {} }) };
