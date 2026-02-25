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
import "./index.css";

// Unified architecture: everything goes through the same origin.
// Dev: Vite proxies /api/* to backend (localhost:3001)
// Prod: Fastify serves both frontend and API on the same port
const backendUrl = import.meta.env.VITE_BACKEND_URL || "";
const isTauriApp = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const deviceName = isTauriApp ? "Desktop" : "Web";

// All backend services share the same server URL
setSeerrBackendUrl(backendUrl);
setRequestsBackendUrl(backendUrl);
setPreferencesBackendUrl(backendUrl);
setTicketsBackendUrl(backendUrl);
setNotificationsBackendUrl(backendUrl);
setConfigBackendUrl(backendUrl);

const storage = new WebStorageAdapter();
const uuid = new WebUuidGenerator();

// JellyfinClient now routes through the Tentacle proxy at /api/jellyfin/*
const jellyfinClient = new JellyfinClient(
  `${backendUrl}/api/jellyfin`,
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
