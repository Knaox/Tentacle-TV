import { useSyncExternalStore } from "react";

/**
 * La joignabilité du serveur Tentacle, lisible HORS de l'arbre qui la sonde.
 *
 * Une seule sonde l'écrit : `useServerReachable`, montée par l'application.
 * Le lecteur la LIT : le voile « hors ligne » se tait pendant une lecture, et
 * c'est au lecteur de dire ce qui manque, sans couper ce qui joue encore.
 *
 * `requestServerProbe` relance la sonde (un « Réessayer » ailleurs que sur le
 * voile) ; sa promesse dit quand elle a répondu.
 */
export interface ServerReachability {
  /** Faux une fois la panne CONFIRMÉE (série d'échecs, cf. useServerReachable). */
  reachable: boolean;
  /** Depuis quand (horodatage) — de quoi dire « depuis 2 min ». */
  since: number;
}

let current: ServerReachability = { reachable: true, since: Date.now() };
const listeners = new Set<() => void>();
let probe: (() => Promise<unknown>) | null = null;

/** Réservé à `useServerReachable`. */
export function publishServerReachability(reachable: boolean): void {
  if (current.reachable === reachable) return;
  current = { reachable, since: Date.now() };
  listeners.forEach((listener) => listener());
}

/** Réservé à `useServerReachable` : la sonde que `requestServerProbe` relance. */
export function registerServerProbe(next: (() => Promise<unknown>) | null): void {
  probe = next;
}

export function requestServerProbe(): Promise<unknown> {
  return probe ? probe() : Promise.resolve();
}

export function readServerReachability(): ServerReachability {
  return current;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function useServerReachability(): ServerReachability {
  return useSyncExternalStore(subscribe, readServerReachability);
}
