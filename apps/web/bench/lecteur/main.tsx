/**
 * Le labo du lecteur, SEUL : la page `/dev/lecteur` rendue sans l'application ni serveur, pour
 * la capturer au Chrome sans tête (`capture.mjs`). Elle charge la vraie feuille (`index.css`) et
 * les vrais composants. `?theme=light|dark` choisit le thème, `?vue=…` l'écran.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  JellyfinClient, JellyfinClientContext, TentacleConfigContext, WebStorageAdapter, WebUuidGenerator,
} from "@tentacle-tv/api-client";
import { initI18n } from "@tentacle-tv/shared";

import "../../src/index.css";
import { ToastProvider } from "../../src/contexts/ToastContext";
import { LecteurLab } from "../../src/dev/lecteurLab/LecteurLab";
import { ThemeProvider } from "../../src/theme";
import { setMode } from "../../src/theme/colorScheme";
import { installCefOverlay } from "./cefOverlay";
import { installFakeServer } from "./fakeServer";
import backdrop from "./img/b-cam3.webp";
import backdropNext from "./img/b-cam2.webp";
import thumb1 from "./img/b-cam1.webp";
import thumbSintel from "./img/b-sintel.webp";
import poster from "./img/p-sintel.webp";
import posterSpring from "./img/p-spring.webp";
import posterCosmos from "./img/p-cosmos.webp";

const params = new URLSearchParams(window.location.search);
const theme = params.get("theme");
if (theme === "light" || theme === "dark") setMode(theme);
initI18n({ lng: params.get("lang") ?? "fr" });

(window as unknown as Record<string, unknown>).__LECTEUR_LAB_IMAGES__ = {
  backdrop, backdropNext, thumb: thumb1, poster, posters: [poster, posterSpring, posterCosmos],
};
installFakeServer({ thumbs: [thumb1, backdropNext, backdrop, thumbSintel] });
// `?cef=<état>` : la surcouche de mise à jour de la coquille CEF, par-dessus la vue demandée.
const cef = params.get("cef");
if (cef) installCefOverlay(cef);

const storage = new WebStorageAdapter();
const uuid = new WebUuidGenerator();
const client = new JellyfinClient("/api/jellyfin", storage, uuid, "Banc", "Tentacle TV - Banc", "0.0.0");
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <JellyfinClientContext.Provider value={client}>
        <TentacleConfigContext.Provider value={{ storage, uuid }}>
          <ThemeProvider>
            <MemoryRouter>
              <ToastProvider>
                <LecteurLab />
              </ToastProvider>
            </MemoryRouter>
          </ThemeProvider>
        </TentacleConfigContext.Provider>
      </JellyfinClientContext.Provider>
    </QueryClientProvider>
  </StrictMode>,
);
