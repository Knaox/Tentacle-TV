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
  fetchInterfaceLanguage,
  hydrateQueryClient,
  attachQueryPersister,
  HOME_PERSIST_WHITELIST,
  setPreferencesBackendUrl,
  setTicketsBackendUrl,
  setNotificationsBackendUrl,
  setConfigBackendUrl,
  setPairingBackendUrl,
  setStreamingConfigBackendUrl,
  setShareLinkBackendUrl,
  setWsBackendUrl,
  setWatchTogetherBackendUrl,
} from "@tentacle-tv/api-client";
import { initI18n, detectLanguage, i18n } from "@tentacle-tv/shared";
import { App } from "@/App";
import { ThemeProvider } from "@/theme";
import { installSessionGuard } from "@/auth/sessionGuard";
import { installerPolyfills } from "./amorce/polyfills";
import { lireCapacitesTeleviseur } from "./amorce/webosGlobals";
import { installerMoteurFocus, amorcerFocus } from "./focus/moteur";
// La feuille du client web d'abord — mêmes jetons, mêmes composants, mêmes
// classes — puis ce que le téléviseur change par-dessus. Importées ici plutôt
// que chaînées par `@import` : la racine de Vite est `client/`, et un `@import`
// qui remonte au-dessus n'est pas résolu.
import "@/index.css";
import "./styles/tv.css";

/**
 * Point d'entrée du client téléviseur.
 *
 * Reprend le bootstrap du client web, moins ce qui n'a pas de sens sur une
 * dalle : les modules exposés aux plugins, le fournisseur de plugins, le cadre
 * de fenêtre du bureau, le panneau de diagnostic du lecteur, la sonde réseau
 * et l'export de stockage vers Electron.
 *
 * L'arbre de composants, lui, est exactement celui du web — c'est tout
 * l'intérêt : `App` et ses écrans ne savent pas qu'ils tournent sur un
 * téléviseur, et n'ont aucune raison de l'apprendre.
 */

// Avant tout le reste : React observe des tailles dès son premier rendu, et le
// client d'API construit un contrôleur d'annulation dès sa première requête.
installerPolyfills();

// Lu tôt, pour que le profil d'appareil soit prêt à la première négociation de
// lecture — et pour retirer `?tvinfo=` de l'URL avant que le routeur la voie.
lireCapacitesTeleviseur();

const langueSauvee = localStorage.getItem("tentacle_language") ?? detectLanguage();
initI18n({ lng: langueSauvee });

// Le client est servi par le serveur Tentacle lui-même : même origine, donc
// adresse vide et appels relatifs. Le proxy Jellyfin et les cookies de session
// sont same-site, exactement comme sur le web.
const backendUrl = "";
setPreferencesBackendUrl(backendUrl);
setTicketsBackendUrl(backendUrl);
setNotificationsBackendUrl(backendUrl);
setConfigBackendUrl(backendUrl);
setPairingBackendUrl(backendUrl);
setStreamingConfigBackendUrl(backendUrl);
setShareLinkBackendUrl(backendUrl);
setWsBackendUrl(backendUrl);
setWatchTogetherBackendUrl(backendUrl);

// Langue faisant foi côté serveur. Une langue changée hors ligne et pas encore
// poussée ne doit pas être écrasée par une valeur périmée.
const aUnUtilisateur = !!localStorage.getItem("tentacle_user");
const changementEnAttente = localStorage.getItem("tentacle_language_pending");
if (aUnUtilisateur && !changementEnAttente) {
  const jeton = localStorage.getItem("tentacle_token");
  fetchInterfaceLanguage(jeton || "__cookie__")
    .then((langue) => {
      if (langue && langue !== i18n.language) {
        i18n.changeLanguage(langue);
        localStorage.setItem("tentacle_language", langue);
      }
    })
    .catch(() => {});
}

const storage = new WebStorageAdapter();
const uuid = new WebUuidGenerator();

const jellyfinClient = new JellyfinClient(
  "/api/jellyfin",
  storage,
  uuid,
  "LG TV",
  "Tentacle TV - webOS",
  __APP_VERSION_WEB__,
);

// Même origine que le backend : le cookie httpOnly part tout seul, et le jeton
// n'a jamais à transiter par le stockage local.
jellyfinClient.useCredentials = true;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    },
    mutations: { retry: false },
  },
});

installSessionGuard({ client: jellyfinClient, storage, queryClient });

const stockagePersistant = {
  getItem: (cle: string) => localStorage.getItem(cle),
  setItem: (cle: string, valeur: string) => localStorage.setItem(cle, valeur),
  removeItem: (cle: string) => localStorage.removeItem(cle),
};

const proprietaireCache = ((): string | null => {
  try {
    const brut = localStorage.getItem("tentacle_user");
    if (!brut) return null;
    const identifiant = (JSON.parse(brut) as { Id?: unknown }).Id;
    return typeof identifiant === "string" ? identifiant : null;
  } catch {
    return null;
  }
})();

void hydrateQueryClient(queryClient, stockagePersistant, {
  whitelist: HOME_PERSIST_WHITELIST,
  owner: proprietaireCache,
});
attachQueryPersister(queryClient, stockagePersistant, {
  whitelist: HOME_PERSIST_WHITELIST,
  owner: proprietaireCache,
});

// Navigation à la télécommande. Installée avant le rendu : le moteur écoute
// le document en capture, il n'a besoin d'aucun composant pour exister. Le
// focus initial, lui, attend que le premier écran soit monté.
installerMoteurFocus();
amorcerFocus();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider backendUrl={backendUrl}>
        <TentacleConfigContext.Provider value={{ storage, uuid }}>
          <JellyfinClientContext.Provider value={jellyfinClient}>
            {/* Le serveur sert cette variante sous `/tv` ; le `basename` doit
                rester aligné sur la `base` de la configuration de build. */}
            <BrowserRouter basename="/tv">
              <App />
            </BrowserRouter>
          </JellyfinClientContext.Provider>
        </TentacleConfigContext.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
