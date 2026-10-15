import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  reportStartupOverlay,
  startupOverlaysQuiet,
  startupOverlaysQuietBefore,
  subscribeStartupOverlays,
  type StartupOverlayKey,
  type StartupOverlayState,
} from "./startupOverlays";

/** Déclare l'état d'un recouvrement de démarrage tant que son hôte est monté ; démonté, il se tait. */
export function useReportStartupOverlay(key: StartupOverlayKey, state: StartupOverlayState): void {
  useEffect(() => {
    reportStartupOverlay(key, state);
  }, [key, state]);
  useEffect(() => () => reportStartupOverlay(key, "quiet"), [key]);
}

/**
 * Vrai quand tous les recouvrements de démarrage ont tranché et se sont tus —
 * ou, avec `before` (un recouvrement tardif), tous ceux qui passent avant lui.
 */
export function useStartupOverlaysQuiet(before?: StartupOverlayKey): boolean {
  const read = useCallback(() => (before ? startupOverlaysQuietBefore(before) : startupOverlaysQuiet()), [before]);
  return useSyncExternalStore(subscribeStartupOverlays, read, read);
}
