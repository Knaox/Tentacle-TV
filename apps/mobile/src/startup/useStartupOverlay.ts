import { useEffect, useSyncExternalStore } from "react";
import {
  reportStartupOverlay,
  startupOverlaysQuiet,
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

/** Vrai quand tous les recouvrements de démarrage ont tranché et se sont tus. */
export function useStartupOverlaysQuiet(): boolean {
  return useSyncExternalStore(subscribeStartupOverlays, startupOverlaysQuiet, startupOverlaysQuiet);
}
