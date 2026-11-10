/**
 * Le labo des fiches, SEUL : les vrais écrans de l'axe rendus sans l'application ni serveur,
 * pour les capturer au Chrome sans tête (`capture.mjs`). La page charge la vraie feuille
 * (`index.css`) et les fournisseurs que `App.tsx` pose autour des routes.
 *
 * `?theme=light|dark` choisit le thème, `?route=/library/films%3Fgenres%3D…` l'écran (et ses
 * filtres, qui vivent dans l'adresse), `?lang=en` la langue.
 */

import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JellyfinClientContext, TentacleConfigContext, setConfigBackendUrl, setPreferencesBackendUrl } from "@tentacle-tv/api-client";
import { initI18n } from "@tentacle-tv/shared";
import { PluginProvider } from "@tentacle-tv/plugins-api";

import "../../src/index.css";
import { SeasonRequestProvider } from "../../src/components/seasons/SeasonRequestProvider";
import { ToastProvider } from "../../src/contexts/ToastContext";
import { WatchTogetherProvider } from "../../src/watchTogether/WatchTogetherProvider";
import { FichesLab } from "../../src/dev/fichesLab/FichesLab";
import { installLabBackend } from "../../src/dev/fichesLab/labBackend";
import { LabClient, MemoryStorage } from "../../src/dev/fichesLab/labClient";
import { ThemeProvider } from "../../src/theme";
import { setMode } from "../../src/theme/colorScheme";

const params = new URLSearchParams(window.location.search);
const theme = params.get("theme");
if (theme === "light" || theme === "dark") setMode(theme);
initI18n({ lng: params.get("lang") ?? "fr" });

// Un compte factice : `useUserId` lit `tentacle_user` — le banc a son propre stockage (son origine).
localStorage.setItem("tentacle_user", JSON.stringify({ Id: "lab-user", Name: "Knaoxtest", Policy: { IsAdministrator: false } }));
// Le backend factice AVANT tout rendu, sur la même origine.
installLabBackend();
setConfigBackendUrl("");
setPreferencesBackendUrl("");

const client = new LabClient();
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const config = { storage: new MemoryStorage(), uuid: { randomUUID: () => "lab-device" } };

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TentacleConfigContext.Provider value={config}>
          <JellyfinClientContext.Provider value={client}>
            <PluginProvider backendUrl="">
              <MemoryRouter initialEntries={[params.get("route") ?? "/"]}>
                <ToastProvider>
                  <WatchTogetherProvider>
                  <SeasonRequestProvider>
                    <Suspense fallback={null}>
                      <Routes>
                        <Route path="/*" element={<FichesLab backend />} />
                      </Routes>
                    </Suspense>
                  </SeasonRequestProvider>
                  </WatchTogetherProvider>
                </ToastProvider>
              </MemoryRouter>
            </PluginProvider>
          </JellyfinClientContext.Provider>
        </TentacleConfigContext.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
