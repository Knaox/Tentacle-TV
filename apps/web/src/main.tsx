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
const jellyfinUrl = savedJellyfin || import.meta.env.VITE_JELLYFIN_URL || "http://localhost:8096";
const backendUrl = savedBackend || import.meta.env.VITE_BACKEND_URL || "";
setSeerrBackendUrl(backendUrl);
setRequestsBackendUrl(backendUrl);
setPreferencesBackendUrl(backendUrl);
setTicketsBackendUrl(backendUrl);
setNotificationsBackendUrl(backendUrl);
setConfigBackendUrl(backendUrl);

const storage = new WebStorageAdapter();
const uuid = new WebUuidGenerator();
const jellyfinClient = new JellyfinClient(jellyfinUrl, storage, uuid, "Web");

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
      staleTime: 60 * 1000,
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
