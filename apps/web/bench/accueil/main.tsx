/**
 * Le banc de l'accueil : la VRAIE coquille (`AppLayout`, barre du haut comprise), la vraie
 * page d'accueil et le labo `/dev/accueil`, servis sans l'application ni serveur — un serveur
 * factice (`labServer.ts`) répond à `fetch`, les images viennent de la copie du prototype.
 *
 * Paramètres de l'adresse :
 *   `?route=/` (défaut) · `/dev/accueil?vue=cartes` · `/media/sintel` (page témoin du retour) ;
 *   `?theme=light|dark` · `?libs=3|20` (bibliothèques de la barre) · `?etat=ok|empty|error|slow`.
 */

import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, useNavigate, type NavigateFunction } from "react-router-dom";
import { JellyfinClient, JellyfinClientContext, TentacleConfigContext, WebStorageAdapter, WebUuidGenerator } from "@tentacle-tv/api-client";
import { initI18n } from "@tentacle-tv/shared";
import { PluginProvider } from "@tentacle-tv/plugins-api";
import { GlassFilters } from "@tentacle-tv/ui";

import "../../src/index.css";
import { installLabServer, LAB_USER, type LabServerOptions } from "./labServer";
import { AppLayout } from "../../src/components/AppLayout";
import { MutationFailureBinding } from "../../src/components/notices/MutationFailureBinding";
import { PageTransition } from "../../src/components/PageTransition";
import { AnimatedRoutes } from "../../src/components/routeTransition/AnimatedRoutes";
import { OmniboxHost } from "../../src/components/search/OmniboxHost";
import { SeasonRequestProvider } from "../../src/components/seasons/SeasonRequestProvider";
import { BackButton } from "../../src/components/ui/BackButton";
import { ToastProvider } from "../../src/contexts/ToastContext";
import { AccueilLab } from "../../src/dev/accueilLab/AccueilLab";
import { labImageKey } from "../../src/dev/accueilLab/labItems";
import { Home } from "../../src/pages/Home";
import { ThemeProvider } from "../../src/theme";
import { setMode } from "../../src/theme/colorScheme";
import { WatchTogetherProvider } from "../../src/watchTogether/WatchTogetherProvider";

const params = new URLSearchParams(window.location.search);
const theme = params.get("theme");
if (theme === "light" || theme === "dark") setMode(theme);

const state = params.get("etat");
const options: LabServerOptions = {
  libraries: Number(params.get("libs") ?? 3),
  state: state === "empty" || state === "error" || state === "slow" ? state : "ok",
};
installLabServer(options);

localStorage.setItem("tentacle_user", JSON.stringify(LAB_USER));
localStorage.setItem("tentacle_token", "lab-token");
initI18n({ lng: params.get("lang") ?? "fr" });

const storage = new WebStorageAdapter();
const uuid = new WebUuidGenerator();
const client = new JellyfinClient("/api/jellyfin", storage, uuid, "Banc", "Tentacle TV - Banc", "0.0.0");
client.setAccessToken("lab-token");
// Les images ne passent pas par `fetch` : chaque titre du labo pointe sa copie du prototype.
client.getImageUrl = (itemId, imageType = "Primary") => {
  const key = labImageKey(itemId, imageType);
  return key ? `./img/${key}.webp` : `./img/absent-${itemId}-${imageType}.webp`;
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 5 * 60_000 }, mutations: { retry: false } },
});

declare global {
  interface Window {
    /** Navigation pilotée par `capture.mjs` et par les mesures. */
    __labNavigate?: NavigateFunction;
  }
}
function NavigateProbe() {
  const navigate = useNavigate();
  useEffect(() => {
    window.__labNavigate = navigate;
  }, [navigate]);
  return null;
}

/** La page témoin du retour : hors coquille, comme la fiche (`routeKeys`). */
function WitnessDetail() {
  return (
    <PageTransition className="min-h-screen bg-surface-0 p-10">
      <BackButton fallback="/" label="Retour" />
      <h1 data-witness-detail className="mt-6 text-display-2 text-content-primary">Fiche témoin</h1>
    </PageTransition>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TentacleConfigContext.Provider value={{ storage, uuid }}>
          <JellyfinClientContext.Provider value={client}>
            <PluginProvider backendUrl="">
              <MemoryRouter initialEntries={[params.get("route") ?? "/"]}>
                <NavigateProbe />
                <ToastProvider>
                  <WatchTogetherProvider>
                    <SeasonRequestProvider>
                      <GlassFilters />
                      <MutationFailureBinding />
                      <AnimatedRoutes>
                        <Route path="/media/:itemId" element={<WitnessDetail />} />
                        <Route element={<AppLayout />}>
                          <Route index element={<Home />} />
                          <Route path="dev/accueil" element={<AccueilLab />} />
                          <Route path="*" element={<AccueilLab />} />
                        </Route>
                      </AnimatedRoutes>
                      <OmniboxHost enabled />
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
