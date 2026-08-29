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
import { installTvSessionGuard } from "./auth/sessionGuardTv";
import { installPolyfills } from "./bootstrap/polyfills";
import { readTvCapabilities } from "./bootstrap/webosGlobals";
import { consumePairing, deviceToken } from "./bootstrap/fragmentToken";
import { startConfigCapture } from "./playback/configsTv";
import { installWakeLock } from "./playback/wakeLockTv";
import { installFocusEngine } from "./focus/engine";
import { primeFocus } from "./focus/entry";
import { installBack } from "./focus/back";
import { installPlayerKeys } from "./playback/playerKeys";
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
installPolyfills();

// Lu tôt, pour que le profil d'appareil soit prêt à la première négociation de
// lecture — et pour retirer `?tvinfo=` de l'URL avant que le routeur la voie.
readTvCapabilities();

// Ce que `deviceInfo` ne dit pas, le matériel le déclare — Dolby Vision, Atmos,
// type de dalle. Lancé ici et jamais attendu : la première négociation de
// lecture est à plusieurs écrans d'ici, et la déduction par gamme tient lieu de
// repli si la réponse tardait.
startConfigCapture();

// L'écran ne veille jamais pendant une lecture ACTIVE (pause exclue — la dalle
// OLED garde sa protection) : sentinelle Luna tvpower, cf. antiVeilleTv.
installWakeLock();

// Le jumelage arrive de la coquille dans le fragment d'URL, jamais dans la
// requête : un jeton d'appareil est un JWT sans expiration, donc un secret de
// longue durée, et un fragment n'atteint ni les journaux ni le `Referer`.
consumePairing();

const savedLanguage = localStorage.getItem("tentacle_language") ?? detectLanguage();
initI18n({ lng: savedLanguage });

// Le client est servi par le serveur Tentacle lui-même : même origine, donc
// adresse vide et appels relatifs. Le proxy Jellyfin est same-origin ;
// l'authentification, elle, passe par le jeton du jumelage et non par un
// cookie — voir plus bas.
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
const hasUser = !!localStorage.getItem("tentacle_user");
const pendingChange = localStorage.getItem("tentacle_language_pending");
if (hasUser && !pendingChange) {
  const token = localStorage.getItem("tentacle_token");
  fetchInterfaceLanguage(token || "__cookie__")
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

// L'authentification vient du jumelage quand il y en a un, du cookie sinon.
//
// Les deux réglages répondent à la même question et ne peuvent pas diverger :
// `buildStreamUrl` et `buildSubtitleUrl` n'ajoutent `api_key` que lorsque
// `useCredentials` est faux, en comptant sur le cookie dans le cas contraire.
// Figer `useCredentials` à faux sans jeton produisait donc des URL portant un
// `api_key` vide, et privait au passage `fetchWithRetry` de la condition qui
// arme la revalidation de session.
//
// Avec un jeton d'appareil, rien ne change : pas de cookie, `api_key` partout.
// Sans jeton — au navigateur de développement, ou pour un compte déjà connecté
// par cookie — le client redevient utilisable, sans rien retirer au chemin du
// jumelage.
const pairingToken = deviceToken();
jellyfinClient.useCredentials = !pairingToken;
if (pairingToken) jellyfinClient.setAccessToken(pairingToken);

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

installTvSessionGuard({ client: jellyfinClient, storage, queryClient });

const stockagePersistant = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
};

const cacheOwner = ((): string | null => {
  try {
    const raw = localStorage.getItem("tentacle_user");
    if (!raw) return null;
    const identifier = (JSON.parse(raw) as { Id?: unknown }).Id;
    return typeof identifier === "string" ? identifier : null;
  } catch {
    return null;
  }
})();

void hydrateQueryClient(queryClient, stockagePersistant, {
  whitelist: HOME_PERSIST_WHITELIST,
  owner: cacheOwner,
});
attachQueryPersister(queryClient, stockagePersistant, {
  whitelist: HOME_PERSIST_WHITELIST,
  owner: cacheOwner,
});

// Navigation à la télécommande. Installée avant le rendu : le moteur écoute
// le document en capture, il n'a besoin d'aucun composant pour exister. Le
// focus initial, lui, attend que le premier écran soit monté.
installFocusEngine();
primeFocus();

// La touche Retour, que le moteur décodait sans que personne l'écoute.
installBack();

// Touches de transport de la télécommande. Le client web ne les connaît pas :
// il n'a jamais eu affaire qu'à un clavier, où elles n'existent pas.
installPlayerKeys();

// Surcouche de vérification du focus — Ctrl+Maj+D. `__TV_DEBUG__` est figé à
// faux par la configuration de build : l'import dynamique et tout ce qu'il tire
// disparaissent du fragment servi à un téléviseur.
if (__TV_DEBUG__) {
  void import("./debug/debugOverlay").then((module) => module.installDebugOverlay());
}

// Ce que le serveur fait de l'image — remux ou ré-encodage. Affichée d'office
// pendant une lecture, sans raccourci : elle doit se voir en regardant un film
// à la télécommande, qui n'a pas de modificateur.
//
// `import.meta.env.DEV` couvre `pnpm dev:webos` ; `__TV_DEBUG__` couvre le
// build de diagnostic. Les deux sont faux dans l'image Docker, et Vite les
// remplace littéralement — la branche et son import disparaissent alors.
if (import.meta.env.DEV || __TV_DEBUG__) {
  void import("./debug/playbackOverlay").then((module) => module.installPlaybackOverlay());
}

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
