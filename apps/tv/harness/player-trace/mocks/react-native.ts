// Simulacre de react-native pour le banc de traces du lecteur — seulement ce
// que les crochets du lecteur lisent. Le bus reproduit TVEventHandler de
// react-native-tvos : un ensemble d'écouteurs dans l'ordre d'inscription, et
// `useTVEventHandler` qui se RÉINSCRIT à chaque nouvelle identité du
// gestionnaire (useEffect [handleEvent]) — l'ordre de distribution suit donc
// les rendus, comme sur l'appareil.
import { useEffect } from "react";

type Listener = (evt: unknown) => void;

export const __rig = {
  platform: (process.env.TRACE_PLATFORM?.startsWith("android") ? "android" : "ios") as "ios" | "android",
  /** Android TV refondu (`TRACE_PLATFORM=androidtv`) : l'entrée unique d'Android, la refonte aiguillée. */
  androidtv: process.env.TRACE_PLATFORM === "androidtv",
  listeners: new Set<Listener>(),
  panHolders: 0,
  backHandlers: [] as Array<() => boolean>,
  onPan: null as null | ((on: boolean) => void),
  dispatch(evt: unknown): void {
    for (const listener of [...this.listeners]) listener(evt);
  },
  /** Le Retour d'Android : BackHandler, le dernier inscrit d'abord. */
  androidBack(): boolean {
    for (let i = this.backHandlers.length - 1; i >= 0; i--) {
      if (this.backHandlers[i]()) return true;
    }
    return false;
  },
};

export const Platform = {
  get OS() { return __rig.platform; },
  isTV: true,
  select<T>(options: Record<string, T>): T | undefined { return options[__rig.platform] ?? options.default; },
};

export function useTVEventHandler(handleEvent: Listener): void {
  useEffect(() => {
    const listener: Listener = (evt) => handleEvent(evt);
    __rig.listeners.add(listener);
    return () => { __rig.listeners.delete(listener); };
  }, [handleEvent]);
}

export const TVEventHandler = {
  addListener(callback: Listener) {
    const listener: Listener = (evt) => callback(evt);
    __rig.listeners.add(listener);
    return { remove: () => { __rig.listeners.delete(listener); } };
  },
};

export const TVEventControl = {
  enableTVPanGesture(): void { __rig.panHolders = 1; __rig.onPan?.(true); },
  disableTVPanGesture(): void { __rig.panHolders = 0; __rig.onPan?.(false); },
};

export const BackHandler = {
  addEventListener(_name: string, handler: () => boolean) {
    __rig.backHandlers.push(handler);
    return { remove: () => { __rig.backHandlers = __rig.backHandlers.filter((h) => h !== handler); } };
  },
};

export function findNodeHandle(node: unknown): number | null {
  return node ? 1 : null;
}

export const DeviceEventEmitter = { emit: (_name: string, evt: unknown) => __rig.dispatch(evt) };
export const AccessibilityInfo = { announceForAccessibility: () => {} };
export const StyleSheet = { create: <T>(styles: T) => styles, absoluteFill: {} };
export const UIManager = {};
// Le module des capacités (`lib/playbackTier.android.ts`) : le banc force le Lite par `__rig.liteOverride`.
export const NativeModules: Record<string, unknown> = {
  get TentacleMediaCapabilities() { return { liteOverride: (__rig as { liteOverride?: string }).liteOverride }; },
};
