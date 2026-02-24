import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { JellyfinClient, JellyfinClientContext } from "@tentacle/api-client";
import { App } from "./App";
import "./index.css";

const jellyfinUrl = import.meta.env.VITE_JELLYFIN_URL || "http://localhost:8096";

const jellyfinClient = new JellyfinClient(jellyfinUrl);

// Restore token from storage
const savedToken = localStorage.getItem("tentacle_token");
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
      <JellyfinClientContext.Provider value={jellyfinClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </JellyfinClientContext.Provider>
    </QueryClientProvider>
  </StrictMode>
);
