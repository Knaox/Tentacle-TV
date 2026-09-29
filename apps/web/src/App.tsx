import { useState, useEffect, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { StartupOverlays } from "./components/StartupOverlays";
import { OfflineBanner } from "./components/OfflineBanner";
import { ServerSetup } from "./pages/ServerSetup";
import { AppConnect } from "./pages/AppConnect";
import { useJellyfinClient, useTentacleConfig, useUserId, notifyUserChange } from "@tentacle-tv/api-client";
import { useActivePluginsMeta, useRefreshPlugins } from "@tentacle-tv/plugins-api";
import { PluginIframe } from "./components/PluginIframe";
import { backendUrl } from "./main";
import { useSetupStatus } from "./hooks/useSetupStatus";
import { OfflineSessionGate } from "./offline/OfflineSessionGate";
import { AppBindings } from "./AppBindings";
import { ToastProvider } from "./contexts/ToastContext";
import { WatchTogetherProvider } from "./watchTogether/WatchTogetherProvider";
import { SessionMessageHost } from "./components/session/SessionMessageHost";
import { OmniboxHost } from "./components/search/OmniboxHost";
import { isDesktopApp } from "./desktop/bridge";
import { Disclaimer } from "./pages/Disclaimer";

/* -- Lazy-loaded pages (code-split) -- */
import {
  Home, Login, Register, SharePage, SharedItemDetail, Watch, MediaDetail, Library, Search, Person, Support, AdminLayout, AdminInvites, Preferences, SettingsLayout, SettingsIndex, SettingsAppearance, SettingsSecurity, About, Credits, PairDevice, AdminPlugins, AdminUsers, AdminTicketsPage, AdminServicesPage, AdminMetadata, AdminSessions, Watchlist, Favorites, Recommendations, MobileProfile, NotFound, DownloadsPage, SettingsDownloads, SettingsData, SettingsPersonalization, OfflineCatalog, OfflineSeriesView, OfflineMediaDetail, AdminDownloads, AdminHome
} from "./lazyPages";
import { Stats, TrailerGuide } from "./lazyPages";
import { useOfflineMode } from "./offline/useOfflineMode";
import { ByFormFactor } from "./mirror/ByFormFactor";
import { RECO_REFINE_PATH } from "./lib/recoSections";
import {
  MirrorAbout,
  MirrorCredits,
  MirrorFavorites,
  MirrorForYou,
  MirrorHome,
  MirrorLogin,
  MirrorPairDevice,
  MirrorProfile,
  MirrorRegister,
  MirrorSettingsPane,
  MirrorSupport,
  MirrorLibraries,
  MirrorLibraryCatalog,
  MirrorMediaDetail,
  MirrorPerson,
  MirrorSearch,
  MirrorWatchlist,
} from "./mirror/screens";

function PageSpinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
    </div>
  );
}

/* -- Reactive auth state — dérivée de la source unique `tentacle_user` exposée
   par useUserId(). La notification est explicite (voir useAuth / onAuthExpired /
   ServerSetup) et NON via un monkey-patch de localStorage.setItem : WebKit /
   WKWebView (desktop macOS) ignore silencieusement la réassignation des méthodes
   de Storage (le named-property setter stocke une clé "setItem" au lieu de
   remplacer la méthode), ce qui cassait la réactivité d'auth → boucle de login. -- */
function useIsAuthenticated(): boolean {
  return useUserId() !== null;
}

export function App() {
  const authed = useIsAuthenticated();
  const client = useJellyfinClient();
  const { storage } = useTentacleConfig();
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(
    () => localStorage.getItem("disclaimer_accepted") === "true",
  );
  // Desktop app: need server URL before anything else
  const [needsServerUrl, setNeedsServerUrl] = useState(
    isDesktopApp() && !localStorage.getItem("tentacle_server_url")
  );
  // Statut du setup + démarrage optimiste desktop (cf. useSetupStatus).
  const { setupRequired, backendDown, setSetupRequired } = useSetupStatus(needsServerUrl);
  const activePluginsMeta = useActivePluginsMeta();
  const refreshPlugins = useRefreshPlugins();
  const guard = (el: React.ReactElement) => authed ? el : <Navigate to="/login" replace />;
  // Mode Hors ligne (desktop) : navigation réduite au contenu local — les
  // sections serveur ne sont pas rendues, elles redirigent vers le catalogue.
  const offlineMode = useOfflineMode();
  const onlineOnly = (el: React.ReactElement) => (offlineMode ? <Navigate to="/" replace /> : el);

  // Re-fetch plugins after login (backendUrl doesn't change so the effect won't re-run otherwise)
  useEffect(() => {
    if (authed) refreshPlugins();
  }, [authed, refreshPlugins]);

  // Desktop app: show disclaimer before server URL input (first launch only)
  if (needsServerUrl) {
    if (!disclaimerAccepted) {
      return <Disclaimer onAccepted={() => setDisclaimerAccepted(true)} />;
    }
    return <AppConnect onConnected={() => { setNeedsServerUrl(false); window.location.reload(); }} />;
  }

  if (setupRequired === null) return <PageSpinner />;

  // Web first setup: show disclaimer before setup wizard
  if (setupRequired && !disclaimerAccepted) {
    return <Disclaimer onAccepted={() => setDisclaimerAccepted(true)} />;
  }

  // Backend unreachable (502/503/crash) — show crying tentacle, reload on reconnect
  if (backendDown) {
    return <OfflineBanner reloadOnReconnect />;
  }

  // Web deployment: show full setup wizard (DB → Jellyfin → Admin)
  if (setupRequired) {
    return (
      <ServerSetup
        onComplete={(token, user) => {
          client.setAccessToken(token);
          storage.setItem("tentacle_user", JSON.stringify(user));
          notifyUserChange();
          setSetupRequired(false);
        }}
      />
    );
  }

  return (
    <ToastProvider>
      <WatchTogetherProvider>
      <AppBindings authed={authed} offlineMode={offlineMode} />
      {/* Les messages de l'administrateur à cette session — au-dessus de tout, lecteur compris. */}
      <SessionMessageHost />
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<ByFormFactor desktop={<Login />} mirror={<MirrorLogin />} />} />
          <Route path="/register" element={<ByFormFactor desktop={<Register />} mirror={<MirrorRegister />} />} />
          <Route path="/share/:token" element={<SharePage />} />
          <Route path="/share/:token/:itemId" element={<SharedItemDetail />} />

          {/* Protected — immersive (no sidebar/tabbar) */}
          <Route path="/watch/:itemId" element={guard(<Watch />)} />
          <Route path="/media/:itemId" element={guard(onlineOnly(<ByFormFactor desktop={<MediaDetail />} mirror={<MirrorMediaDetail />} />))} />
          {/* La page d'une personne : un clic sur le casting ou l'équipe d'une fiche. Immersive, comme la fiche. */}
          <Route path="/person/:personId" element={guard(onlineOnly(<ByFormFactor desktop={<Person />} mirror={<MirrorPerson />} />))} />
          {/* La fiche d'un titre gardé sur la machine, et celle d'une série :
              la scène de la fiche en ligne, lue sur le disque — en ligne comme
              hors ligne. Immersives, comme la fiche. */}
          <Route path="/offline/item/:itemId" element={guard(<OfflineMediaDetail />)} />
          <Route path="/offline/series/:seriesKey" element={guard(<OfflineSeriesView />)} />

          {/* Protected — with layout (sidebar desktop / tabbar mobile) */}
          <Route element={guard(<AppLayout />)}>
            {/* Hors ligne : l'accueil devient le catalogue local. */}
            <Route index element={offlineMode ? <OfflineCatalog /> : <ByFormFactor desktop={<Home />} mirror={<MirrorHome />} />} />
            <Route path="library/:libraryId" element={onlineOnly(<ByFormFactor desktop={<Library />} mirror={<MirrorLibraryCatalog />} />)} />
            {/* L'onglet Bibliothèque de l'app : le miroir seulement, le bureau a ses onglets. */}
            <Route path="libraries" element={onlineOnly(<ByFormFactor desktop={<Navigate to="/" replace />} mirror={<MirrorLibraries />} />)} />
            <Route path="watchlist" element={onlineOnly(<ByFormFactor desktop={<Watchlist />} mirror={<MirrorWatchlist />} />)} />
            <Route path="favorites" element={onlineOnly(<ByFormFactor desktop={<Favorites />} mirror={<MirrorFavorites />} />)} />
            <Route path="recommendations" element={onlineOnly(<ByFormFactor desktop={<Recommendations />} mirror={<MirrorForYou />} />)} />
            {/* « Affiner » : une section de Recommandations, plus un onglet. */}
            <Route path="recommendations/refine" element={onlineOnly(<ByFormFactor desktop={<Recommendations />} mirror={<MirrorForYou />} />)} />
            <Route path="swipe" element={<Navigate to={RECO_REFINE_PATH} replace />} />
            {/* Vos statistiques : la même page au bureau et au téléphone (écran empilé du miroir). */}
            <Route path="stats" element={onlineOnly(<Stats />)} />
            {/* La recherche pleine page — l'omnibox (⌘K) y mène pour « tous les résultats ». */}
            <Route path="search" element={onlineOnly(<ByFormFactor desktop={<Search />} mirror={<MirrorSearch />} />)} />
            {/* Desktop uniquement — la page se redirige elle-même hors droit
                et hors contenu local (invisibilité stricte). */}
            <Route path="downloads" element={<DownloadsPage />} />
            {/* « Sur cet appareil » : le catalogue local, atteignable EN LIGNE
                aussi. Hors ligne il tient déjà lieu d'accueil ; en ligne, rien
                n'y menait — il fallait attendre une coupure pour revoir ce
                qu'on avait gardé. La page se vide d'elle-même sans contenu. */}
            <Route path="on-device" element={<OfflineCatalog />} />

            <Route path="support" element={onlineOnly(<ByFormFactor desktop={<Support />} mirror={<MirrorSupport />} />)} />
            {/* Le guide « Bandes-annonces » : l'Aide le liste, le lien discret des
                fiches y mène, la vue d'ensemble de l'administration vise #admin. */}
            <Route path="help/trailers" element={onlineOnly(<TrailerGuide />)} />
            {/* Reglages en maitre-detail, meme coquille que l'admin.
                `/settings` reste l'URL d'entree ; les sections deviennent des
                enfants, et Securite regroupe ce qui etait disperse. */}
            <Route path="settings" element={<ByFormFactor desktop={<SettingsLayout />} mirror={<MirrorSettingsPane />} />}>
              <Route index element={<SettingsIndex />} />
              <Route path="appearance" element={<SettingsAppearance />} />
              {/* Personnalisation (accueil + recommandations) : réglages serveur,
                  sans objet hors ligne. */}
              <Route
                path="personalization"
                element={offlineMode ? <Navigate to="/settings/appearance" replace /> : <SettingsPersonalization />}
              />
              {/* Sécurité (mot de passe, appareils, serveur) : sans objet hors ligne. */}
              <Route
                path="security"
                element={offlineMode ? <Navigate to="/settings/appearance" replace /> : <SettingsSecurity />}
              />
              <Route path="playback" element={<Preferences />} />
              <Route path="downloads" element={<SettingsDownloads />} />
            <Route path="data" element={<SettingsData />} />
              {/* Volets propres au miroir (Profil de l'app) : au bureau, leur page. */}
              <Route path="password" element={<Navigate to="/settings/security" replace />} />
              <Route path="devices" element={<Navigate to="/settings/security" replace />} />
              <Route path="invites" element={<Navigate to="/admin/invites" replace />} />
            </Route>
            <Route path="profile" element={onlineOnly(<ByFormFactor desktop={<MobileProfile />} mirror={<MirrorProfile />} />)} />
            <Route path="pair-device" element={onlineOnly(<ByFormFactor desktop={<PairDevice />} mirror={<MirrorPairDevice />} />)} />
            {/* Admin en maitre-detail : route PARENTE avec rail de sections.
                Les URLs restent identiques a l'avant (`/admin/users`,
                `/admin/services`, `/admin/plugins/<id>`), elles deviennent
                simplement des enfants — aucun lien profond ne casse. */}
            <Route path="admin" element={onlineOnly(<AdminLayout />)}>
              <Route index element={<AdminHome />} />
              <Route path="sessions" element={<AdminSessions />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="downloads" element={<AdminDownloads />} />
              <Route path="invites" element={<AdminInvites />} />
              <Route path="tickets" element={<AdminTicketsPage />} />
              <Route path="services" element={<AdminServicesPage />} />
              <Route path="metadata" element={<AdminMetadata />} />
              <Route path="plugins" element={<AdminPlugins />} />

              {/* Dynamic plugin admin routes (sandboxed iframes) — convention: /admin/plugins/:pluginId */}
              {activePluginsMeta
                .filter((plugin) => plugin.hasBundle)
                .map((plugin) => (
                  <Route
                    key={`admin-${plugin.pluginId}`}
                    path={`plugins/${plugin.pluginId}`}
                    element={
                      <PluginIframe
                        pluginId={plugin.pluginId}
                        bundleUrl={`${backendUrl}/api/plugins/${plugin.pluginId}/bundle?v=${plugin.version}`}
                        pluginPath={`/admin/plugins/${plugin.pluginId}`}
                      />
                    }
                  />
                ))
              }
            </Route>
            <Route path="about" element={<ByFormFactor desktop={<About />} mirror={<MirrorAbout />} />} />
            <Route path="credits" element={<ByFormFactor desktop={<Credits />} mirror={<MirrorCredits />} />} />

            {/* Dynamic plugin routes (sandboxed iframes) */}
            {activePluginsMeta
              .filter((plugin) => plugin.configEnabled === true)
              .flatMap((plugin) =>
              (plugin.navItems || [])
                .filter((nav) => !nav.admin && nav.platforms?.includes("web"))
                .map((nav) => (
                  <Route
                    key={`${plugin.pluginId}-${nav.path}`}
                    path={nav.path.replace(/^\//, "")}
                    element={
                      <PluginIframe
                        pluginId={plugin.pluginId}
                        bundleUrl={`${backendUrl}/api/plugins/${plugin.pluginId}/bundle?v=${plugin.version}`}
                        pluginPath={nav.path}
                      />
                    }
                  />
                ))
            )}
          </Route>

          <Route path="/preferences" element={<Navigate to="/settings" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <StartupOverlays authed={authed} disclaimerAccepted={disclaimerAccepted} />
      {/* La recherche de toute l'application (⌘K, « / », la barre) — au-dessus
          des pages avec ou sans navigation, jamais pendant la lecture. */}
      <OmniboxHost enabled={authed && !offlineMode} />
      {authed && <OfflineSessionGate />}
      {/* Overlay bloquant « serveur injoignable » : comportement WEB uniquement.
          Sur desktop, le mode Hors ligne (connectivityStore + pastille TopNav)
          remplace le blocage — l'app reste utilisable sur le contenu local. */}
      {!isDesktopApp() && <OfflineBanner />}
      </WatchTogetherProvider>
    </ToastProvider>
  );
}
