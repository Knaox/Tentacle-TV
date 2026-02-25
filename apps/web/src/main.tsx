import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import {
  JellyfinClient,
  JellyfinClientContext,
  WebStorageAdapter,
  WebUuidGenerator,
  TentacleConfigContext,
  setSeerrBackendUrl,
  setRequestsBackendUrl,
  setPreferencesBackendUrl,
  setTicketsBackendUrl,
  setNotificationsBackendUrl,
  setConfigBackendUrl,
  setPairingBackendUrl,
} from "@tentacle/api-client";
import { App } from "./App";
import "./index.css";

// Detect Tauri (desktop app) vs web deployment
export const isTauriApp = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const deviceName = isTauriApp ? "Desktop" : "Web";

// Web: same-origin (or VITE_BACKEND_URL for dev).
// Desktop: saved Tentacle server URL from localStorage.
const backendUrl = isTauriApp
  ? (localStorage.getItem("tentacle_server_url") || "")
  : (import.meta.env.VITE_BACKEND_URL || "");

/** Reconfigure all backend service URLs for a given base URL */
export function configureBackendUrls(url: string) {
  setSeerrBackendUrl(url);
  setRequestsBackendUrl(url);
  setPreferencesBackendUrl(url);
  setTicketsBackendUrl(url);
  setNotificationsBackendUrl(url);
  setConfigBackendUrl(url);
  setPairingBackendUrl(url);
}

configureBackendUrls(backendUrl);

const storage = new WebStorageAdapter();
const uuid = new WebUuidGenerator();

// JellyfinClient routes through the Tentacle proxy at /api/jellyfin/*
const jellyfinClient = new JellyfinClient(
  backendUrl ? `${backendUrl}/api/jellyfin` : "/api/jellyfin",
  storage,
  uuid,
  deviceName
);

// Restore token from storage
const savedToken = storage.getItem("tentacle_token");
if (savedToken) {
  jellyfinClient.setAccessToken(savedToken);
}

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
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </JellyfinClientContext.Provider>
      </TentacleConfigContext.Provider>
    </QueryClientProvider>
  </StrictMode>
);
