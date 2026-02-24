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
} from "@tentacle/api-client";
import { App } from "./App";
import "./index.css";

const jellyfinUrl = import.meta.env.VITE_JELLYFIN_URL || "http://localhost:8096";
const backendUrl = import.meta.env.VITE_BACKEND_URL || "";
setSeerrBackendUrl(backendUrl);
setRequestsBackendUrl(backendUrl);
setPreferencesBackendUrl(backendUrl);
setTicketsBackendUrl(backendUrl);
setNotificationsBackendUrl(backendUrl);

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
