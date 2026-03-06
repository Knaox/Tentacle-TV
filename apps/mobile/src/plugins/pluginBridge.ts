import type { Router } from "expo-router";

type PerfTimings = {
  sharedDeps: number;
  i18nInit: number;
  bundleInject: number;
  render: number;
  total: number;
};

type WebToNativeMessage =
  | { type: "READY" }
  | { type: "ERROR"; message: string }
  | { type: "NAVIGATE"; route: string }
  | { type: "TOAST"; message: string; variant: "success" | "error" | "info" }
  | { type: "PERF_TIMINGS"; timings: PerfTimings };

/**
 * Crée un handler pour les messages postMessage envoyés depuis la WebView plugin.
 * Gère la navigation native, les erreurs, et les toasts.
 */
export function createBridgeHandler(router: Router, onReady?: () => void, onError?: (msg: string) => void) {
  return (event: { nativeEvent: { data: string } }) => {
    try {
      const msg: WebToNativeMessage = JSON.parse(event.nativeEvent.data);
      switch (msg.type) {
        case "READY":
          onReady?.();
          break;
        case "NAVIGATE":
          router.push(msg.route as never);
          break;
        case "ERROR":
          console.error("[PluginBridge] ERROR:", msg.message);
          onError?.(msg.message);
          break;
        case "PERF_TIMINGS":
          if (__DEV__) {
            const t = msg.timings;
            console.log(
              `[PluginPerf] total=${t.total}ms | shared-deps=${t.sharedDeps}ms | i18n=${t.i18nInit}ms | bundle=${t.bundleInject}ms | render=${t.render}ms`,
            );
          }
          break;
        case "TOAST":
          // TODO: intégrer avec un système de toast natif
          break;
      }
    } catch {
      /* message non-JSON ignoré */
    }
  };
}
