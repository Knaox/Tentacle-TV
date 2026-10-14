import type { Router } from "expo-router";
import { Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseTrailerRoute, trailerRouteHref } from "../trailers/trailerRoute";

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
  | { type: "PERF_TIMINGS"; timings: PerfTimings }
  /** La page dit si son défilement a replié le chrome (cf. pluginScrollChromeScript). */
  | { type: "SCROLL_CHROME"; collapsed: boolean }
  /** Une surface modale de la page s'ouvre ou se ferme (cf. pluginHostBridgeScript). */
  | { type: "OVERLAY"; open: boolean }
  /** Un lien à ouvrir hors de l'application. */
  | { type: "OPEN_EXTERNAL"; url: string }
  /** L'écran des bandes-annonces sur le catalogue d'un titre TMDB (`openTrailerFor`, API publique). */
  | { type: "OPEN_TRAILER_CATALOG"; tmdbId?: unknown; mediaType?: unknown; season?: unknown; start?: unknown }
  /** Le son des aperçus coupé dans l'extension : sans effet ici (aucun aperçu au survol sur le mobile). */
  | { type: "TRAILER_PREVIEW_MUTED"; muted?: unknown };

/** Seuls les liens web sortent : ni `javascript:`, ni schéma d'application. */
function openExternalUrl(url: unknown): void {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return;
  Linking.openURL(url).catch(() => { /* aucun navigateur : rien à faire */ });
}

const asParam = (value: unknown): string | undefined =>
  typeof value === "number" || typeof value === "string" ? String(value) : undefined;

/**
 * `openTrailerFor` d'une extension → l'écran des bandes-annonces sur le
 * catalogue du titre ; un message invalide est ignoré (la page n'est pas une
 * source de confiance : seule une demande TMDB lisible ouvre l'écran).
 */
export function trailerCatalogHref(msg: { tmdbId?: unknown; mediaType?: unknown; season?: unknown; start?: unknown }): string | null {
  const route = parseTrailerRoute({
    tmdbId: asParam(msg.tmdbId), mediaType: asParam(msg.mediaType), season: asParam(msg.season), start: asParam(msg.start),
  });
  return route?.target.kind === "tmdb" ? trailerRouteHref(route) : null;
}

/**
 * Crée un handler pour les messages postMessage envoyés depuis la WebView plugin.
 * Gère la navigation native, les erreurs, et les toasts.
 */
export function createBridgeHandler(
  router: Router,
  onReady?: () => void,
  onError?: (msg: string) => void,
  onScrollChrome?: (collapsed: boolean) => void,
  onOverlay?: (open: boolean) => void,
) {
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
        case "SCROLL_CHROME":
          onScrollChrome?.(msg.collapsed === true);
          break;
        case "OVERLAY":
          onOverlay?.(msg.open === true);
          break;
        case "OPEN_EXTERNAL":
          openExternalUrl(msg.url);
          break;
        case "OPEN_TRAILER_CATALOG": {
          const href = trailerCatalogHref(msg);
          if (href) router.push(href as never);
          break;
        }
        case "TRAILER_PREVIEW_MUTED":
          break;
      }
    } catch {
      /* message non-JSON ignoré */
    }
  };
}
