import { StrictMode, type ComponentType } from "react";
import * as React from "react";
import * as ReactJSXRuntime from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import * as TanStackQuery from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as ReactRouterDOM from "react-router-dom";
import { unstable_HistoryRouter as HistoryRouter } from "react-router-dom";
import * as ReactI18next from "react-i18next";
import {
  JellyfinClient,
  JellyfinClientContext,
  WebStorageAdapter,
  WebUuidGenerator,
  TentacleConfigContext,

  setPreferencesBackendUrl,
  setTicketsBackendUrl,
  setNotificationsBackendUrl,
  setConfigBackendUrl,
  setPairingBackendUrl,
  setStreamingConfigBackendUrl,
  setShareLinkBackendUrl,
  setWsBackendUrl,
  setWatchTogetherBackendUrl,
  setRequestTimeoutMs,
  configureSessionChannel,
  acceptRecoPageThemes,
  acceptRecoTrendingHead,
} from "@tentacle-tv/api-client";
import { initI18n, detectLanguage, i18n } from "@tentacle-tv/shared";
import { fetchInterfaceLanguage } from "@tentacle-tv/api-client";
import * as PluginsAPI from "@tentacle-tv/plugins-api";
import { PluginProvider, registerPlugin, unregisterPlugin } from "@tentacle-tv/plugins-api";
import { App } from "./App";
import { ThemeProvider } from "./theme";
import { installGlassAccessibility } from "./theme/glass/accessibility";
import { isDesktopApp } from "./desktop/bridge";
import { nativeSessionPost, supportsNativeSessionPost } from "./desktop/sessionPost";
import { nativeKillEncodings, nativePlaybackInfo, supportsNativePlayerRelay } from "./desktop/playerRelay";
import { getBackendBase } from "./lib/backendBase";
import { createAppHistory } from "./lib/detailChain";
import { retryUnlessRateLimited } from "./lib/retryPolicy";
import { installSessionGuard } from "./auth/sessionGuard";
import { installAnimationAudit } from "./dev/animationAudit";
import { installQueryPersistence } from "./lib/queryPersistence";
import { cleanupObsoleteStorage } from "./lib/storageCleanup";
import { scheduleDetailPagePreload } from "./lib/detailPagePreload";
import { bootRoutePreload } from "./lib/bootRoutePreload";
import { installStaleBuildReload } from "./lib/staleBuildReload";
import { installLayoutShiftProbe } from "./dev/layoutShiftProbe";
import { isWebDebugEnabled } from "./lib/webDebug";
import { HostTitleBar } from "./desktop/HostTitleBar";
import { AppErrorBoundary } from "./components/problems/AppErrorBoundary";
import { DatabaseMigrationGate } from "./databaseMigration/DatabaseMigrationGate";
import { AccountAccessGate } from "./accountAccess/AccountAccessGate";
import { ProfileArrival } from "./profiles/switch/ProfileArrival";
import { bootOctave } from "./music/octave/mode/OctaveEntry";
import "./index.css";

// Expose shared modules for dynamically loaded plugins (IIFE bundles)
(window as unknown as Record<string, unknown>).TentacleShared = {
  React, ReactJSXRuntime, ReactRouterDOM, TanStackQuery, ReactI18next, PluginsAPI, i18n,
};

// Le débogage du web (panneau DEBUG, journal réseau, `?reducedmotion=1`) :
// UN morceau chargé à la demande, derrière une seule porte — développement,
// build instrumenté, ou `TENTACLE_WEB_DEBUG` posé par l'administrateur du
// serveur (lib/webDebug.ts). Lancé ICI, tout en haut, pour que le journal
// enveloppe `fetch` au plus tôt ; le rendu l'attend. Porte fermée : rien n'est
// téléchargé, `window.fetch` n'est jamais touché.
let WebDebugPanel: ComponentType | null = null;
const webDebugReady: Promise<void> = isWebDebugEnabled()
  ? import("./dev/webDebugBoot")
      .then((module) => {
        module.bootWebDebug();
        WebDebugPanel = module.WebDebugPanel;
      })
      .catch(() => {})
  : Promise.resolve();

// Initialize i18n before rendering (local cache first for instant display)
const savedLang = localStorage.getItem("tentacle_language") ?? detectLanguage();
initI18n({ lng: savedLang });
// Les clés des réglages disparus partent AVANT tout rendu : un utilisateur qui
// avait choisi un mode retiré revient au défaut sans rien faire.
cleanupObsoleteStorage(localStorage);
// Réduire la transparence, Contraste accru, Réduire les animations : posés sur
// <html> AVANT le premier rendu — pas d'éclair de verre transparent.
installGlassAccessibility();
// Une page d'avant la mise à jour du client recharge au lieu de rester noire.
installStaleBuildReload();

// Application de bureau (Tauri sur macOS et Linux, Electron sur Windows) par
// opposition au déploiement web. La détection vit dans `desktop/detect.ts` et
// nulle part ailleurs — elle était dupliquée ici, ne connaissait que Tauri, et
// faisait passer l'app Electron pour un navigateur.
const isDesktop = isDesktopApp();
const deviceName = isDesktop ? "Desktop" : "Web";

// Web: same-origin (or VITE_BACKEND_URL for dev).
// Desktop: saved Tentacle server URL from localStorage.
// Single source of truth shared with the trailer/platform helpers (lib/backendBase).
export const backendUrl = getBackendBase();

/** Reconfigure all backend service URLs for a given base URL */
export function configureBackendUrls(url: string) {
  setPreferencesBackendUrl(url);
  setTicketsBackendUrl(url);
  setNotificationsBackendUrl(url);
  setConfigBackendUrl(url);
  setPairingBackendUrl(url);
  setStreamingConfigBackendUrl(url);
  setShareLinkBackendUrl(url);
  setWsBackendUrl(url);
  setWatchTogetherBackendUrl(url);
}

configureBackendUrls(backendUrl);

// If authenticated (user info persisted), fetch the authoritative language from backend.
//
// APRÈS `configureBackendUrls`, et c'est tout l'intérêt de l'endroit : le
// module des préférences garde son adresse de backend dans une variable posée
// là. Appelé avant, il partait en RELATIF — sur le web ça passait par hasard
// (même origine), mais dans l'application de bureau l'adresse relative désigne
// l'origine applicative, qui n'a pas d'API : un 404 à chaque démarrage, et la
// langue du serveur jamais lue.
const _hasUser = !!localStorage.getItem("tentacle_user");
// Langue changée HORS LIGNE et pas encore poussée : le pull backend (valeur
// périmée) ne doit PAS l'écraser — elle sera poussée au retour en ligne
// (flushPendingInterfaceLanguage, ConnectivityBinding).
const _pendingLang = localStorage.getItem("tentacle_language_pending");
if (_hasUser && !_pendingLang) {
  // For web: credentials cookie is sent automatically; token param is only for mobile/desktop
  const _token = localStorage.getItem("tentacle_token");
  fetchInterfaceLanguage(_token || "__cookie__").then((lang) => {
    if (lang && lang !== i18n.language) {
      i18n.changeLanguage(lang);
      localStorage.setItem("tentacle_language", lang);
    }
  }).catch(() => {});
}

// Desktop : le catalogue local existe — un fetch qui pend doit échouer vite
// (12 s) pour nourrir la bascule hors ligne. Web : 30 s historiques conservés.
if (isDesktop) setRequestTimeoutMs(12_000);

// Le web et le bureau (miroir compris) titrent une rangée à thème par son `why`
// (`recoRowTitleText`) : ils demandent ces rangées au serveur (`?themes=1`).
// Posé avant toute requête — la page en cache est toujours demandée ainsi.
acceptRecoPageThemes();
// …et rendent « Tendances actuelles » en tête de « Pour vous » (`?trendingNow=1`).
acceptRecoTrendingHead();

// Copie du stockage local dans la base SQLite de l'app, en vue de la migration
// vers Electron. `localStorage` appartient au moteur web et est rangé par
// origine ; sans cette copie, la première version Electron déconnecterait TOUS
// les utilisateurs. Silencieux, sans effet sur le web.
//

// Plugin registration (legacy — plugins now run in sandboxed iframes on web)
// Mobile/desktop still use inline registration.
// Keeping window.__tentacle for backwards compat during transition.
(window as unknown as Record<string, unknown>).__tentacle = { registerPlugin, unregisterPlugin, backendUrl };

const storage = new WebStorageAdapter();
const uuid = new WebUuidGenerator();

// JellyfinClient routes through the Tentacle proxy at /api/jellyfin/*
const clientName = isDesktop ? "Tentacle TV - Desktop" : "Tentacle TV - Web";
const clientVersion = isDesktop ? __APP_VERSION_DESKTOP__ : __APP_VERSION_WEB__;

const jellyfinClient = new JellyfinClient(
  backendUrl ? `${backendUrl}/api/jellyfin` : "/api/jellyfin",
  storage,
  uuid,
  deviceName,
  clientName,
  clientVersion,
);

// Jellyfin 12 nomme pistes et libellés dans la langue de l'interface (Accept-Language).
jellyfinClient.followLanguage(i18n);

// Web: use httpOnly cookies for auth (XSS-proof token storage)
if (!isDesktop) {
  jellyfinClient.useCredentials = true;
}

// La télémétrie de lecture part par le NATIF quand la coquille sait le faire.
//
// Elle vise Jellyfin EN DIRECT, délibérément : le proxy remplace le jeton de
// l'utilisateur par la clé admin, et sans contexte utilisateur Jellyfin 10.11
// ne sait plus à qui attribuer le playstate — la position de reprise est
// perdue. Or un `fetch` du moteur web depuis l'origine applicative n'obtiendra
// jamais de CORS d'un serveur Jellyfin quelconque : le préflight échoue, et
// toute la session bascule sur le proxy en silence.
//
// Le processus principal n'est pas soumis au CORS. Rien à configurer sur les
// serveurs des utilisateurs, et le modèle de sécurité de la page ne bouge pas.
// Absent sous Tauri, dont l'origine HTTP passe déjà : `supportsNativeSessionPost`
// répond non et le `fetch` d'origine reste en place.
if (supportsNativeSessionPost()) {
  jellyfinClient.nativeSessionPost = nativeSessionPost;
}

// Le LECTEUR aussi : `PlaybackInfo` (la session de transcodage doit naître
// sous le jeton utilisateur) et `ActiveEncodings` (tuer le ffmpeg supplanté)
// visent Jellyfin en direct, et le fetch de la page y est voué au mur CORS —
// mesuré le 28.08, l'échec coupait le direct pour toute la session, URLs
// médias du lecteur natif comprises. Voir `desktop/playerRelay.ts`.
if (supportsNativePlayerRelay()) {
  jellyfinClient.nativePlaybackInfo = nativePlaybackInfo;
  jellyfinClient.nativeKillEncodings = nativeKillEncodings;
}

// Canal de session : la télémétrie de lecture et la télécommande Jellyfin
// passent par le backend, sur le socket déjà ouvert. Face à un serveur qui ne
// le connaît pas, rien ne change — les reports repartent en HTTP.
configureSessionChannel({ deviceId: () => jellyfinClient.getDeviceId() });

// Restore token from storage (mobile/desktop only — web uses httpOnly cookies)
const savedToken = storage.getItem("tentacle_token");
if (savedToken) {
  jellyfinClient.setAccessToken(savedToken);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Une tentative de rattrapage — sauf sur un 429, qu'on ne retente jamais
      // (cf. lib/retryPolicy.ts : retenter double la facture au pire moment).
      retry: retryUnlessRateLimited,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    },
    mutations: {
      retry: false,
    },
  },
});

// Vitalité de la session : verdict sur 401, revalidation au retour sur
// l'onglet, refresh proactif. Posé APRÈS le QueryClient — la purge doit vider
// son cache. Cf. auth/sessionGuard.
installSessionGuard({ client: jellyfinClient, storage, queryClient });

// Cold start instantané : le cache de requêtes revient du disque avant le
// premier render, et y retourne — voir `lib/queryPersistence.ts`.
installQueryPersistence(queryClient);

// `__animations()` en console — développement uniquement. Dit POURQUOI le
// compositeur tourne, là où le compteur d'images ne dit qu'à quelle cadence.
installAnimationAudit();
// `__cls()` en console — développement uniquement : les décalages de mise en page.
if (import.meta.env.DEV) installLayoutShiftProbe();

// L'historique de `BrowserRouter`, avec la chaîne de fiches : une fiche
// ouverte depuis une fiche remplace l'entrée au lieu de s'empiler (cf.
// `lib/detailChain.ts`). Un seul par document, comme celui qu'il remplace.
const appHistory = createAppHistory();

function renderApp() {
  // Diagnostic (porte du débogage du web) : monté à la racine et non dans le
  // lecteur — le panneau est en position fixe et lit l'état de mpv par le
  // singleton de l'adaptateur, il n'a besoin d'aucun contexte.
  const playerDebug = WebDebugPanel ? <WebDebugPanel /> : null;
  createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Le cadre de fenêtre, là où la page doit le dessiner elle-même. Monté à la
        racine, HORS des fournisseurs : il ne lit aucun contexte, et il doit
        exister sur TOUTES les pages — le lecteur et la fiche média sont servis
        hors de `AppLayout`. Rend `null` partout où la fenêtre a un vrai cadre. */}
    <HostTitleBar />
    {playerDebug}
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TentacleConfigContext.Provider value={{ storage, uuid }}>
          <JellyfinClientContext.Provider value={jellyfinClient}>
            {/* Bureau : le rideau d'arrivée d'une bascule de profil, déjà là au premier rendu. */}
            <ProfileArrival />
            <PluginProvider backendUrl={backendUrl}>
              <HistoryRouter history={appHistory}>
                {/* Compte désactivé ou hors plage : sa page REMPLACE l'application. */}
                <AccountAccessGate>
                  <AppErrorBoundary>
                    <App />
                  </AppErrorBoundary>
                </AccountAccessGate>
                {/* La migration de la base du serveur : au-dessus de tout, hors de l'application. */}
                <DatabaseMigrationGate backendUrl={backendUrl} />
              </HistoryRouter>
            </PluginProvider>
          </JellyfinClientContext.Provider>
        </TentacleConfigContext.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
  );
}

// Route de démarrage : son chunk d'abord (au plus 300 ms), pour rendre la
// page d'un coup depuis le cache hydraté — sans spinner à l'arrivée.
// Lancement en Octave : son module et son cache gardé (≤ 350 ms) — la page où l'on était, avec ses données.
// Le débogage, s'il est permis, est posé avant ce premier rendu.
void Promise.all([bootRoutePreload(window.location.pathname), webDebugReady, bootOctave(queryClient)]).then(() => {
  renderApp();
  // La fiche média, en temps mort : le premier clic sur une affiche n'attend plus son chunk.
  scheduleDetailPagePreload();
});
