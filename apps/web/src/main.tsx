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
} from "@tentacle/api-client";
import { App } from "./App";
import { getServerUrls } from "./hooks/useServerConfig";
import "./index.css";

const { jellyfinUrl: savedJellyfin, backendUrl: savedBackend } = getServerUrls();
// getServerUrls() already handles Tauri vs web env var fallback
const jellyfinUrl = savedJellyfin || import.meta.env.VITE_JELLYFIN_URL || "http://localhost:8096";
// Desktop (Tauri): if no backend URL configured, fall back to the Jellyfin URL
// (backend typically runs behind the same reverse proxy)
const backendUrl = savedBackend || import.meta.env.VITE_BACKEND_URL || jellyfinUrl;
const isTauriApp = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const deviceName = isTauriApp ? "Desktop" : "Web";
setSeerrBackendUrl(backendUrl);
setRequestsBackendUrl(backendUrl);
setPreferencesBackendUrl(backendUrl);
setTicketsBackendUrl(backendUrl);
setNotificationsBackendUrl(backendUrl);
setConfigBackendUrl(backendUrl);

const storage = new WebStorageAdapter();
const uuid = new WebUuidGenerator();
const jellyfinClient = new JellyfinClient(jellyfinUrl, storage, uuid, deviceName);

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
      staleTime: 5 * 60 * 1000,   // 5 minutes — data rarely changes
      gcTime: 30 * 60 * 1000,     // 30 minutes in garbage collection
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
