import { useState, useEffect, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { GlassFilters } from "@tentacle-tv/ui";
import { AppLayout } from "./components/AppLayout";
import { UpdateModal } from "./components/UpdateModal";
import { OfflineBanner } from "./components/OfflineBanner";
import { ImpersonationBanner } from "./components/ImpersonationBanner";
import { ServerSetup } from "./pages/ServerSetup";
import { AppConnect } from "./pages/AppConnect";
import { useJellyfinClient, useTentacleConfig, useStreamingConfig, STREAMING_CONFIG_QUERY_KEY, useUserId, notifyUserChange } from "@tentacle-tv/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useActivePluginsMeta, useRefreshPlugins } from "@tentacle-tv/plugins-api";
import { PluginIframe } from "./components/PluginIframe";
import { SoakHarness } from "./dev/soakPlayer";
import { AutoWatchHarness } from "./dev/autoWatch";
import { FrameMeter, frameMeterEnabled } from "./dev/FrameMeter";
import { backendUrl } from "./main";
import { useDirectStreamingGuard } from "./hooks/useDirectStreamingGuard";
import { useScrollMemory } from "./hooks/useScrollMemory";
import { useSetupStatus } from "./hooks/useSetupStatus";
import { ConnectivityBinding } from "./offline/ConnectivityBinding";
import { DataSaverBinding } from "./offline/DataSaverBinding";
import { OfflineSessionSync } from "./offline/OfflineSessionSync";
import { OfflineSessionGate } from "./offline/OfflineSessionGate";
import { DownloadsEngineBoot } from "./downloads/DownloadsEngineBoot";
import { DownloadsEvents } from "./downloads/DownloadsEvents";
import { ToastProvider } from "./contexts/ToastContext";
import { WatchTogetherProvider } from "./watchTogether/WatchTogetherProvider";
import { isDesktopApp } from "./desktop/bridge";
import { Disclaimer } from "./pages/Disclaimer";

/* -- Lazy-loaded pages (code-split) -- */
import {
  Home, Login, Register, SharedListView, SharedItemDetail, Watch, MediaDetail, Library, Support, AdminLayout, AdminInvites, Preferences, SettingsLayout, SettingsIndex, SettingsAppearance, SettingsSecurity, About, Credits, PairDevice, AdminPlugins, AdminUsers, AdminTicketsPage, AdminServicesPage, AdminTheme, AdminThemeTokens, AdminThemeReference, Watchlist, Favorites, MobileProfile, NotFound, DownloadsPage, SettingsDownloads, SettingsData, OfflineCatalog, OfflineSeasonView, AdminDownloads
} from "./lazyPages";
import { useOfflineMode } from "./offline/useOfflineMode";

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

/** Sync direct streaming config from backend into JellyfinClient.
 *  Auto-disables and refetches config when consecutive media errors occur. */
function DirectStreamingSync() {
  const client = useJellyfinClient();
  const queryClient = useQueryClient();
  // Web uses httpOnly cookie (credentials: "include"), so pass a sentinel token
  // to satisfy the `enabled: !!token` guard. Mobile/desktop pass real token.
  const token = localStorage.getItem("tentacle_token") || (localStorage.getItem("tentacle_user") ? "__cookie__" : null);
  const { data } = useStreamingConfig(token);

  useEffect(() => {
    // Direct Streaming is applied on every client (web/native) when the admin
    // enabled it. On web, CORS may block the direct call — the transparent
    // fallback lives in 3 places:
    //   - packages/api-client/src/jellyfin.ts (getPlaybackInfo direct → proxy)
    //   - apps/web/src/components/VideoPlayer.tsx (HLS manifestLoadError → DS off + refetch)
    //   - apps/web/src/hooks/useDirectStreamingGuard.ts (auto-disable after N <img>/<video> errors)
    // The admin config is never touched; only the in-memory session flag is cleared.
    if (data?.enabled && data.mediaBaseUrl && data.jellyfinToken) {
      client.setDirectStreaming({
        enabled: true,
        mediaBaseUrl: data.mediaBaseUrl,
        jellyfinToken: data.jellyfinToken,
      });
    } else {
      client.setDirectStreaming(null);
    }
  }, [client, data]);

  // Register fallback: on consecutive direct streaming errors, force refetch
  useEffect(() => {
    client.setOnDirectStreamingFail(() => {
      queryClient.invalidateQueries({ queryKey: [STREAMING_CONFIG_QUERY_KEY] });
    });
  }, [client, queryClient]);

  // Global image error listener for direct streaming URLs
  useDirectStreamingGuard();

  return null;
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
      {/* Definitions SVG de la refraction Liquid Glass. Montees UNE fois pres
          de la racine : les surfaces verre y referent par `url(#...)`, un
          filtre non monte resoudrait sur rien et le verre retomberait
          silencieusement sur un flou plat. */}
      <GlassFilters />
      {/* Pont connectivité ↔ TanStack : erreurs réseau → sonde, retour en
          ligne → invalidations échelonnées. Web ET desktop. */}
      <ConnectivityBinding />
      {/* Décide du mode économie (réglage ∘ latence mesurée) et le pousse dans
          api-client — avant que le moindre queryFn ne s'exécute. */}
      <DataSaverBinding />
      {/* Desktop : photo de session (profil+droits) rafraîchie en ligne, et
          garde « reconnexion nécessaire » à l'expiration des 30 j hors ligne. */}
      {authed && <OfflineSessionSync />}
      {authed && <DownloadsEngineBoot />}
      {authed && <DownloadsEvents />}
      {authed && <DirectStreamingSync />}
      {authed && <ImpersonationBanner />}
      <ScrollMemoryWrapper />
      {/* Banc de torture du lecteur (dev only) : tentacleSoak("<itemId>", 200) */}
      {import.meta.env.DEV && <SoakHarness />}
      {/* Reprise auto de la dernière lecture (dev only, URL ?autowatch=1) */}
      {import.meta.env.DEV && <AutoWatchHarness />}
      {/* Compteur d'images (dev only) — éliminé du build de production. */}
      {import.meta.env.DEV && frameMeterEnabled() && <FrameMeter />}
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/share/:token" element={<SharedListView />} />
          <Route path="/share/:token/:itemId" element={<SharedItemDetail />} />

          {/* Protected — immersive (no sidebar/tabbar) */}
          <Route path="/watch/:itemId" element={guard(<Watch />)} />
          <Route path="/media/:itemId" element={guard(onlineOnly(<MediaDetail />))} />

          {/* Protected — with layout (sidebar desktop / tabbar mobile) */}
          <Route element={guard(<AppLayout />)}>
            {/* Hors ligne : l'accueil devient le catalogue local. */}
            <Route index element={offlineMode ? <OfflineCatalog /> : <Home />} />
            <Route path="library/:libraryId" element={onlineOnly(<Library />)} />
            <Route path="watchlist" element={onlineOnly(<Watchlist />)} />
            <Route path="favorites" element={onlineOnly(<Favorites />)} />
            {/* Desktop uniquement — la page se redirige elle-même hors droit
                et hors contenu local (invisibilité stricte). */}
            <Route path="downloads" element={<DownloadsPage />} />
            {/* Saison téléchargée : contenu 100 % local, donc accessible aussi
                en ligne (le retour navigateur fonctionne normalement). */}
            <Route path="offline/season/:groupKey" element={<OfflineSeasonView />} />

            <Route path="support" element={onlineOnly(<Support />)} />
            {/* Reglages en maitre-detail, meme coquille que l'admin.
                `/settings` reste l'URL d'entree ; les sections deviennent des
                enfants, et Securite regroupe ce qui etait disperse. */}
            <Route path="settings" element={<SettingsLayout />}>
              <Route index element={<SettingsIndex />} />
              <Route path="appearance" element={<SettingsAppearance />} />
              {/* Sécurité (mot de passe, appareils, serveur) : sans objet hors ligne. */}
              <Route
                path="security"
                element={offlineMode ? <Navigate to="/settings/appearance" replace /> : <SettingsSecurity />}
              />
              <Route path="playback" element={<Preferences />} />
              <Route path="downloads" element={<SettingsDownloads />} />
            <Route path="data" element={<SettingsData />} />
            </Route>
            <Route path="profile" element={onlineOnly(<MobileProfile />)} />
            <Route path="pair-device" element={onlineOnly(<PairDevice />)} />
            {/* Admin en maitre-detail : route PARENTE avec rail de sections.
                Les URLs restent identiques a l'avant (`/admin/users`,
                `/admin/theme/tokens`, `/admin/plugins/<id>`), elles deviennent
                simplement des enfants — aucun lien profond ne casse. */}
            <Route path="admin" element={onlineOnly(<AdminLayout />)}>
              <Route index element={null} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="downloads" element={<AdminDownloads />} />
              <Route path="invites" element={<AdminInvites />} />
              <Route path="tickets" element={<AdminTicketsPage />} />
              <Route path="services" element={<AdminServicesPage />} />
              <Route path="plugins" element={<AdminPlugins />} />
              <Route path="theme" element={<AdminTheme />} />
              <Route path="theme/tokens" element={<AdminThemeTokens />} />
              <Route path="theme/reference" element={<AdminThemeReference />} />

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
            <Route path="about" element={<About />} />
            <Route path="credits" element={<Credits />} />

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
      <UpdateModal />
      {authed && <OfflineSessionGate />}
      {/* Overlay bloquant « serveur injoignable » : comportement WEB uniquement.
          Sur desktop, le mode Hors ligne (connectivityStore + pastille TopNav)
          remplace le blocage — l'app reste utilisable sur le contenu local. */}
      {!isDesktopApp() && <OfflineBanner />}
      </WatchTogetherProvider>
    </ToastProvider>
  );
}

function ScrollMemoryWrapper() {
  useScrollMemory();
  return null;
}
