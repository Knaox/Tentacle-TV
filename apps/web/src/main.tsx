import { StrictMode } from "react";
import * as React from "react";
import * as ReactJSXRuntime from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import * as TanStackQuery from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as ReactRouterDOM from "react-router-dom";
import { BrowserRouter } from "react-router-dom";
import * as ReactI18next from "react-i18next";
import {
  JellyfinClient,
  JellyfinClientContext,
  WebStorageAdapter,
  WebUuidGenerator,
  TentacleConfigContext,

  setPreferencesBackendUrl,
  setTicketsBackendUrl,
  setNotificationsBackendUrl,
  setConfigBackendUrl,
  setPairingBackendUrl,
  setStreamingConfigBackendUrl,
  setShareLinkBackendUrl,
  setWsBackendUrl,
  setWatchTogetherBackendUrl,
  notifyUserChange,
  hydrateQueryClient,
  attachQueryPersister,
  HOME_PERSIST_WHITELIST,
  setRequestTimeoutMs,
} from "@tentacle-tv/api-client";
import { initI18n, detectLanguage, i18n } from "@tentacle-tv/shared";
import { fetchInterfaceLanguage } from "@tentacle-tv/api-client";
import * as PluginsAPI from "@tentacle-tv/plugins-api";
import { PluginProvider, registerPlugin, unregisterPlugin } from "@tentacle-tv/plugins-api";
import { App } from "./App";
import { ThemeProvider } from "./theme";
import { isDesktopApp, isTauriShell } from "./desktop/bridge";
import { getBackendBase } from "./lib/backendBase";
import { startLocalStorageExport } from "./migration/localStorageExport";
import { installAnimationAudit } from "./dev/animationAudit";
import { PlayerDebugPanel } from "./dev/PlayerDebugPanel";
import "./index.css";

// Expose shared modules for dynamically loaded plugins (IIFE bundles)
(window as unknown as Record<string, unknown>).TentacleShared = {
  React, ReactJSXRuntime, ReactRouterDOM, TanStackQuery, ReactI18next, PluginsAPI, i18n,
};

// Initialize i18n before rendering (local cache first for instant display)
const savedLang = localStorage.getItem("tentacle_language") ?? detectLanguage();
initI18n({ lng: savedLang });

// Application de bureau (Tauri sur macOS et Linux, Electron sur Windows) par
// opposition au déploiement web. La détection vit dans `desktop/detect.ts` et
// nulle part ailleurs — elle était dupliquée ici, ne connaissait que Tauri, et
// faisait passer l'app Electron pour un navigateur.
const isDesktop = isDesktopApp();
const deviceName = isDesktop ? "Desktop" : "Web";

// Web: same-origin (or VITE_BACKEND_URL for dev).
// Desktop: saved Tentacle server URL from localStorage.
// Single source of truth shared with the trailer/platform helpers (lib/backendBase).
export const backendUrl = getBackendBase();

/** Reconfigure all backend service URLs for a given base URL */
export function configureBackendUrls(url: string) {
  setPreferencesBackendUrl(url);
  setTicketsBackendUrl(url);
  setNotificationsBackendUrl(url);
  setConfigBackendUrl(url);
  setPairingBackendUrl(url);
  setStreamingConfigBackendUrl(url);
  setShareLinkBackendUrl(url);
  setWsBackendUrl(url);
  setWatchTogetherBackendUrl(url);
}

configureBackendUrls(backendUrl);

// If authenticated (user info persisted), fetch the authoritative language from backend.
//
// APRÈS `configureBackendUrls`, et c'est tout l'intérêt de l'endroit : le
// module des préférences garde son adresse de backend dans une variable posée
// là. Appelé avant, il partait en RELATIF — sur le web ça passait par hasard
// (même origine), mais dans l'application de bureau l'adresse relative désigne
// l'origine applicative, qui n'a pas d'API : un 404 à chaque démarrage, et la
// langue du serveur jamais lue.
const _hasUser = !!localStorage.getItem("tentacle_user");
// Langue changée HORS LIGNE et pas encore poussée : le pull backend (valeur
// périmée) ne doit PAS l'écraser — elle sera poussée au retour en ligne
// (flushPendingInterfaceLanguage, ConnectivityBinding).
const _pendingLang = localStorage.getItem("tentacle_language_pending");
if (_hasUser && !_pendingLang) {
  // For web: credentials cookie is sent automatically; token param is only for mobile/desktop
  const _token = localStorage.getItem("tentacle_token");
  fetchInterfaceLanguage(_token || "__cookie__").then((lang) => {
    if (lang && lang !== i18n.language) {
      i18n.changeLanguage(lang);
      localStorage.setItem("tentacle_language", lang);
    }
  }).catch(() => {});
}

// Desktop : le catalogue local existe — un fetch qui pend doit échouer vite
// (12 s) pour nourrir la bascule hors ligne. Web : 30 s historiques conservés.
if (isDesktop) setRequestTimeoutMs(12_000);

// Copie du stockage local dans la base SQLite de l'app, en vue de la migration
// vers Electron. `localStorage` appartient au moteur web et est rangé par
// origine ; sans cette copie, la première version Electron déconnecterait TOUS
// les utilisateurs. Silencieux, sans effet sur le web.
//
// Gardé sur `isTauriShell()` et NON sur `isDesktopApp()` : c'est le côté
// ÉCRITURE de la migration. Electron lit ce dépôt au premier démarrage, il ne
// le réécrit pas — le relancer depuis Electron écraserait la sauvegarde par le
// contenu d'une origine encore vide.
if (isTauriShell()) startLocalStorageExport();

// Plugin registration (legacy — plugins now run in sandboxed iframes on web)
// Mobile/desktop still use inline registration.
// Keeping window.__tentacle for backwards compat during transition.
(window as unknown as Record<string, unknown>).__tentacle = { registerPlugin, unregisterPlugin, backendUrl };

const storage = new WebStorageAdapter();
const uuid = new WebUuidGenerator();

// JellyfinClient routes through the Tentacle proxy at /api/jellyfin/*
const clientName = isDesktop ? "Tentacle TV - Desktop" : "Tentacle TV - Web";
const clientVersion = isDesktop ? __APP_VERSION_DESKTOP__ : __APP_VERSION_WEB__;

const jellyfinClient = new JellyfinClient(
  backendUrl ? `${backendUrl}/api/jellyfin` : "/api/jellyfin",
  storage,
  uuid,
  deviceName,
  clientName,
  clientVersion,
);

// Web: use httpOnly cookies for auth (XSS-proof token storage)
if (!isDesktop) {
  jellyfinClient.useCredentials = true;
}

// Restore token from storage (mobile/desktop only — web uses httpOnly cookies)
const savedToken = storage.getItem("tentacle_token");
if (savedToken) {
  jellyfinClient.setAccessToken(savedToken);
}

// On 401 — try refresh before logging out (avoids disconnect on Jellyfin restart).
// Web uses httpOnly cookies so the cookie is sent automatically.
// Deux tentatives espacées de 5 s : un 401 isolé pendant un redémarrage
// Jellyfin ne doit pas suffire à purger la session (symétrique du retry TV).
jellyfinClient.setOnAuthExpired(async () => {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 5000));
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
      if (res.ok) {
        jellyfinClient.resetAuthState();
        return;
      }
      if (res.status !== 401) return; // 503 / server error — keep session
    } catch { return; } // Network error — keep session
  }

  // 401 confirmed twice — token truly expired, logout
  jellyfinClient.setAccessToken(null);
  storage.removeItem("tentacle_token");
  storage.removeItem("tentacle_user");
  notifyUserChange();
});

// Proactive cookie refresh for long-running tabs (renew well before 90-day expiry)
setInterval(async () => {
  try {
    await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
  } catch { /* silent — next request will trigger reactive refresh */ }
}, 12 * 60 * 60 * 1000);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    },
    mutations: {
      retry: false,
    },
  },
});

// Cold start instantané : hydrate le cache depuis localStorage avant le premier
// render — la home affichera ses données précédentes pendant que les refetchs
// arrière-plan se déclenchent (le WebSocket pousse les vrais nouveaux ajouts).
const persistStorage = {
  getItem: (k: string) => localStorage.getItem(k),
  setItem: (k: string, v: string) => localStorage.setItem(k, v),
  removeItem: (k: string) => localStorage.removeItem(k),
};
// Le cache est étiqueté au nom du compte qui l'a produit, et n'est rendu qu'à
// lui. Sans cette étiquette, un admin sorti du mode impersonation retrouvait
// les reprises de lecture de l'autre : la sauvegarde sur `pagehide` réécrivait
// le cache en mémoire — celui de l'usurpé — juste après l'effacement, pendant
// la navigation de sortie.
const cacheOwner = ((): string | null => {
  try {
    const raw = localStorage.getItem("tentacle_user");
    if (!raw) return null;
    const id = (JSON.parse(raw) as { Id?: unknown }).Id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
})();

void hydrateQueryClient(queryClient, persistStorage, {
  whitelist: HOME_PERSIST_WHITELIST,
  owner: cacheOwner,
});
attachQueryPersister(queryClient, persistStorage, {
  whitelist: HOME_PERSIST_WHITELIST,
  owner: cacheOwner,
});

// `__animations()` en console — développement uniquement. Dit POURQUOI le
// compositeur tourne, là où le compteur d'images ne dit qu'à quelle cadence.
installAnimationAudit();

// Diagnostic du lecteur — DÉVELOPPEMENT UNIQUEMENT. Monté à la racine et non
// dans le lecteur : le panneau est en position fixe et lit l'état de mpv par
// le singleton de l'adaptateur, il n'a besoin d'aucun contexte.
// `__PLAYER_DEBUG__` est faux dans tout build livré — la branche et son import
// disparaissent alors du bundle.
const debugLecteur = (import.meta.env.DEV || __PLAYER_DEBUG__) ? <PlayerDebugPanel /> : null;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {debugLecteur}
    <QueryClientProvider client={queryClient}>
      <ThemeProvider backendUrl={backendUrl}>
        <TentacleConfigContext.Provider value={{ storage, uuid }}>
          <JellyfinClientContext.Provider value={jellyfinClient}>
            <PluginProvider backendUrl={backendUrl}>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </PluginProvider>
          </JellyfinClientContext.Provider>
        </TentacleConfigContext.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
);
