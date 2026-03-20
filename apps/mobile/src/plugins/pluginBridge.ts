import type { Router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  | { type: "NAVIGATE_MEDIA"; tmdbId: number; mediaType: string }
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
        case "NAVIGATE_MEDIA": {
          const navMsg = msg as { type: "NAVIGATE_MEDIA"; tmdbId: number; mediaType: string };
          console.log("[PluginBridge] NAVIGATE_MEDIA:", navMsg.tmdbId, navMsg.mediaType);
          (async () => {
            try {
              const serverUrl = await AsyncStorage.getItem("tentacle_server_url");
              const token = await AsyncStorage.getItem("tentacle_token");
              const userJson = await AsyncStorage.getItem("tentacle_user");
              const userId = userJson ? JSON.parse(userJson).Id : null;
              console.log("[PluginBridge] serverUrl:", serverUrl, "userId:", userId);
              if (!serverUrl || !token || !userId) return;
              const itemTypes = navMsg.mediaType === "movie" ? "Movie" : "Series";
              const url = `${serverUrl}/api/jellyfin/Users/${userId}/Items?AnyProviderIdEquals=tmdb.${navMsg.tmdbId}&IncludeItemTypes=${itemTypes}&Recursive=true&Limit=1`;
              const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
              console.log("[PluginBridge] Jellyfin response:", res.status);
              if (res.ok) {
                const data = await res.json();
                const jellyfinId = data.Items?.[0]?.Id;
                console.log("[PluginBridge] Jellyfin ID:", jellyfinId);
                if (jellyfinId) router.push(`/media/${jellyfinId}` as never);
              }
            } catch (err) {
              console.error("[PluginBridge] NAVIGATE_MEDIA error:", err);
            }
          })();
          break;
        }
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
