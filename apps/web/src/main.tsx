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
  setSharedWatchlistsBackendUrl,
} from "@tentacle-tv/api-client";
import { initI18n, detectLanguage, i18n } from "@tentacle-tv/shared";
import { fetchInterfaceLanguage } from "@tentacle-tv/api-client";
import * as PluginsAPI from "@tentacle-tv/plugins-api";
import { PluginProvider, registerPlugin, unregisterPlugin } from "@tentacle-tv/plugins-api";
import { App } from "./App";
import "./index.css";

// Expose shared modules for dynamically loaded plugins (IIFE bundles)
(window as unknown as Record<string, unknown>).TentacleShared = {
  React, ReactJSXRuntime, ReactRouterDOM, TanStackQuery, ReactI18next, PluginsAPI, i18n,
};

// Initialize i18n before rendering (local cache first for instant display)
const savedLang = localStorage.getItem("tentacle_language") ?? detectLanguage();
initI18n({ lng: savedLang });

// If authenticated (user info persisted), fetch the authoritative language from backend
const _hasUser = !!localStorage.getItem("tentacle_user");
if (_hasUser) {
  // For web: credentials cookie is sent automatically; token param is only for mobile/desktop
  const _token = localStorage.getItem("tentacle_token");
  fetchInterfaceLanguage(_token || "__cookie__").then((lang) => {
    if (lang && lang !== i18n.language) {
      i18n.changeLanguage(lang);
      localStorage.setItem("tentacle_language", lang);
    }
  }).catch(() => {});
}

// Detect Tauri (desktop app) vs web deployment
// Check multiple signals: __TAURI_INTERNALS__ (v2 IPC bridge, always injected),
// __TAURI__ (withGlobalTauri or @tauri-apps/api), and User-Agent fallback.
export const isTauriApp = typeof window !== "undefined" && (
  "__TAURI_INTERNALS__" in window ||
  "__TAURI__" in window ||
  navigator.userAgent.includes("Tauri")
);
const deviceName = isTauriApp ? "Desktop" : "Web";

// Web: same-origin (or VITE_BACKEND_URL for dev).
// Desktop: saved Tentacle server URL from localStorage.
export const backendUrl = isTauriApp
  ? (localStorage.getItem("tentacle_server_url") || "")
  : (import.meta.env.VITE_BACKEND_URL || "");

/** Reconfigure all backend service URLs for a given base URL */
export function configureBackendUrls(url: string) {
  setPreferencesBackendUrl(url);
  setTicketsBackendUrl(url);
  setNotificationsBackendUrl(url);
  setConfigBackendUrl(url);
  setPairingBackendUrl(url);
  setStreamingConfigBackendUrl(url);
  setSharedWatchlistsBackendUrl(url);
}

configureBackendUrls(backendUrl);

// Plugin registration (legacy — plugins now run in sandboxed iframes on web)
// Mobile/desktop still use inline registration.
// Keeping window.__tentacle for backwards compat during transition.
(window as unknown as Record<string, unknown>).__tentacle = { registerPlugin, unregisterPlugin, backendUrl };

const storage = new WebStorageAdapter();
const uuid = new WebUuidGenerator();

// JellyfinClient routes through the Tentacle proxy at /api/jellyfin/*
const clientName = isTauriApp ? "Tentacle TV - Desktop" : "Tentacle TV - Web";
const clientVersion = isTauriApp ? __APP_VERSION_DESKTOP__ : __APP_VERSION_WEB__;

const jellyfinClient = new JellyfinClient(
  backendUrl ? `${backendUrl}/api/jellyfin` : "/api/jellyfin",
  storage,
  uuid,
  deviceName,
  clientName,
  clientVersion,
);

// Web: use httpOnly cookies for auth (XSS-proof token storage)
if (!isTauriApp) {
  jellyfinClient.useCredentials = true;
}

// Restore token from storage (mobile/desktop only — web uses httpOnly cookies)
const savedToken = storage.getItem("tentacle_token");
if (savedToken) {
  jellyfinClient.setAccessToken(savedToken);
}

// On 401 (stale/revoked token) clear auth state → triggers redirect to /login.
// The localStorage.removeItem intercept in App.tsx notifies useIsAuthenticated.
jellyfinClient.setOnAuthExpired(() => {
  jellyfinClient.setAccessToken(null);
  storage.removeItem("tentacle_token");
  storage.removeItem("tentacle_user");
});

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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TentacleConfigContext.Provider value={{ storage, uuid }}>
        <JellyfinClientContext.Provider value={jellyfinClient}>
          <PluginProvider backendUrl={backendUrl}>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </PluginProvider>
        </JellyfinClientContext.Provider>
      </TentacleConfigContext.Provider>
    </QueryClientProvider>
  </StrictMode>
);
