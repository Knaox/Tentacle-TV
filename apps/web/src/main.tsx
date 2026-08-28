import { StrictMode } from "react";
import * as React from "react";
import * as ReactJSXRuntime from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import * as TanStackQuery from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as ReactRouterDOM from "react-router-dom";
import { BrowserRouter } from "react-router-dom";
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
  hydrateQueryClient,
  attachQueryPersister,
  HOME_PERSIST_WHITELIST,
  setRequestTimeoutMs,
} from "@tentacle-tv/api-client";
import { initI18n, detectLanguage, i18n } from "@tentacle-tv/shared";
import { fetchInterfaceLanguage } from "@tentacle-tv/api-client";
import * as PluginsAPI from "@tentacle-tv/plugins-api";
import { PluginProvider, registerPlugin, unregisterPlugin } from "@tentacle-tv/plugins-api";
import { App } from "./App";
import { ThemeProvider } from "./theme";
import { isDesktopApp } from "./desktop/bridge";
import { nativeSessionPost, supportsNativeSessionPost } from "./desktop/sessionPost";
import { nativeKillEncodings, nativePlaybackInfo, supportsNativePlayerRelay } from "./desktop/playerRelay";
import { getBackendBase } from "./lib/backendBase";
import { retenterSaufDebit } from "./lib/retryPolicy";
import { installSessionGuard } from "./auth/sessionGuard";
import { installAnimationAudit } from "./dev/animationAudit";
import { installerSondeReseau } from "./dev/networkProbe";
import { PlayerDebugPanel } from "./dev/PlayerDebugPanel";
import { HostTitleBar } from "./desktop/HostTitleBar";
import "./index.css";

// Expose shared modules for dynamically loaded plugins (IIFE bundles)
(window as unknown as Record<string, unknown>).TentacleShared = {
  React, ReactJSXRuntime, ReactRouterDOM, TanStackQuery, ReactI18next, PluginsAPI, i18n,
};

// Journal des requêtes sortantes, pour le panneau de diagnostic. Posé ICI, tout
// en haut : il doit envelopper `fetch` AVANT le premier appel, sans quoi les
// requêtes du démarrage — celles qui décident de ce qu'on voit — lui échappent.
// `__PLAYER_DEBUG__` est faux dans tout build livré : le module disparaît alors
// du bundle, et `window.fetch` n'est jamais touché.
if (import.meta.env.DEV || __PLAYER_DEBUG__) installerSondeReseau();

// Initialize i18n before rendering (local cache first for instant display)
const savedLang = localStorage.getItem("tentacle_language") ?? detectLanguage();
initI18n({ lng: savedLang });

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
      retry: retenterSaufDebit,
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

// Cold start instantané : hydrate le cache depuis localStorage avant le premier
// render — la home affichera ses données précédentes pendant que les refetchs
// arrière-plan se déclenchent (le WebSocket pousse les vrais nouveaux ajouts).
const persistStorage = {
  getItem: (k: string) => localStorage.getItem(k),
  setItem: (k: string, v: string) => localStorage.setItem(k, v),
  removeItem: (k: string) => localStorage.removeItem(k),
};
// Le cache est étiqueté au nom du compte qui l'a produit, et n'est rendu qu'à
// lui. Sans cette étiquette, un admin sorti du mode impersonation retrouvait
// les reprises de lecture de l'autre : la sauvegarde sur `pagehide` réécrivait
// le cache en mémoire — celui de l'usurpé — juste après l'effacement, pendant
// la navigation de sortie.
const cacheOwner = ((): string | null => {
  try {
    const raw = localStorage.getItem("tentacle_user");
    if (!raw) return null;
    const id = (JSON.parse(raw) as { Id?: unknown }).Id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
})();

void hydrateQueryClient(queryClient, persistStorage, {
  whitelist: HOME_PERSIST_WHITELIST,
  owner: cacheOwner,
});
attachQueryPersister(queryClient, persistStorage, {
  whitelist: HOME_PERSIST_WHITELIST,
  owner: cacheOwner,
});

// `__animations()` en console — développement uniquement. Dit POURQUOI le
// compositeur tourne, là où le compteur d'images ne dit qu'à quelle cadence.
installAnimationAudit();

// Diagnostic du lecteur — DÉVELOPPEMENT UNIQUEMENT. Monté à la racine et non
// dans le lecteur : le panneau est en position fixe et lit l'état de mpv par
// le singleton de l'adaptateur, il n'a besoin d'aucun contexte.
// `__PLAYER_DEBUG__` est faux dans tout build livré — la branche et son import
// disparaissent alors du bundle.
const debugLecteur = (import.meta.env.DEV || __PLAYER_DEBUG__) ? <PlayerDebugPanel /> : null;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Le cadre de fenêtre, là où la page doit le dessiner elle-même. Monté à la
        racine, HORS des fournisseurs : il ne lit aucun contexte, et il doit
        exister sur TOUTES les pages — le lecteur et la fiche média sont servis
        hors de `AppLayout`. Rend `null` partout où la fenêtre a un vrai cadre. */}
    <HostTitleBar />
    {debugLecteur}
    <QueryClientProvider client={queryClient}>
      <ThemeProvider backendUrl={backendUrl}>
        <TentacleConfigContext.Provider value={{ storage, uuid }}>
          <JellyfinClientContext.Provider value={jellyfinClient}>
            <PluginProvider backendUrl={backendUrl}>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </PluginProvider>
          </JellyfinClientContext.Provider>
        </TentacleConfigContext.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
);
