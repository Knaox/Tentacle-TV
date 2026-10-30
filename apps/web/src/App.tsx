import { useState, useEffect, Suspense } from "react";
import { Route, Navigate, useLocation } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { AnimatedRoutes } from "./components/routeTransition/AnimatedRoutes";
import { StartupOverlays } from "./components/StartupOverlays";
import { OfflineBanner } from "./components/OfflineBanner";
import { ServerSetup } from "./pages/ServerSetup";
import { AppConnect } from "./pages/AppConnect";
import { ServerCapabilityGate, useJellyfinClient, useTentacleConfig, useUserId, notifyUserChange } from "@tentacle-tv/api-client";
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
import { SeasonRequestProvider } from "./components/seasons/SeasonRequestProvider";
import { isDesktopApp } from "./desktop/bridge";
import { supportsPictureInPicture } from "./desktop/capabilities";
import { PlayerStage } from "./pictureInPicture/PlayerStage";
import { PageSpinner } from "./components/PageSpinner";
import { UnknownRoute } from "./components/pluginIframe/UnknownRoute";
import { useProfileLaunchGate } from "./profiles/launch/useProfileLaunchGate";
import { OctaveHomeGate, OctaveRoute } from "./music/octave/mode/OctaveEntry";
import { OCTAVE_BASE_PATH } from "./music/octave/mode/octaveMode";
import { LaunchWait, useTentacleRelease } from "./music/octave/mode/OctaveLaunchBackdrop";
import { useDesktopAppLinks } from "./desktop/useDesktopAppLinks";

/* -- Lazy-loaded pages (code-split) -- */
import {
  Home, Login, Register, SharePage, SharedItemDetail, Watch, MediaDetail, Library, Search, Person, Support, AdminLayout, AdminInvites, Preferences, SettingsLayout, SettingsIndex, SettingsAppearance, SettingsSecurity, About, Credits, PairDevice, AdminPlugins, AdminUsers, AdminTicketsPage, AdminServicesPage, AdminMetadata, AdminSessions, Watchlist, Favorites, Recommendations, MobileProfile, NotFound, DownloadsPage, SettingsDownloads, SettingsData, SettingsFamily, SettingsPersonalization, OfflineCatalog, OfflineSeriesView, OfflineMediaDetail, AdminDownloads, AdminHome
} from "./lazyPages";
import { Stats, TrailerGuide } from "./lazyPages";
import { useOfflineMode } from "./offline/useOfflineMode";
import { ByFormFactor } from "./mirror/ByFormFactor";
import { RECO_REFINE_PATH } from "./lib/recoSections";
import { WIDE_LEGACY_PATHS } from "@tentacle-tv/shared";
import { webPluginRoutes } from "./hooks/pluginNavPages";
import { DevGlassLab } from "./dev/glassLab/devRoute";
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
  // Desktop app: need server URL before anything else
  const [needsServerUrl, setNeedsServerUrl] = useState(
    isDesktopApp() && !localStorage.getItem("tentacle_server_url")
  );
  // Statut du setup + démarrage optimiste desktop (cf. useSetupStatus).
  const { setupRequired, backendDown, setSetupRequired } = useSetupStatus(needsServerUrl);
  const activePluginsMeta = useActivePluginsMeta();
  const refreshPlugins = useRefreshPlugins();
  const guard = (el: React.ReactElement) => authed ? el : <Navigate to="/login" replace />;
  const playerOnStage = supportsPictureInPicture(); // le lecteur hors des routes, pour le PiP
  // Bureau : « Qui regarde ? » à l'ouverture, AVANT tout le reste (rien ne consomme derrière).
  const profileGate = useProfileLaunchGate(authed && !needsServerUrl);
  // Mode Hors ligne (desktop) : navigation réduite au contenu local — les
  // sections serveur ne sont pas rendues, elles redirigent vers le catalogue.
  const offlineMode = useOfflineMode();
  const onlineOnly = (el: React.ReactElement) => (offlineMode ? <Navigate to="/" replace /> : el);
  // Le mode musique (Octave) a sa propre coquille : la recherche vidéo (⌘K) s'y tait.
  const { pathname } = useLocation();
  const inOctave = pathname.startsWith(OCTAVE_BASE_PATH);
  useTentacleRelease(pathname); // une page de Tentacle relâche ce qu'un lancement en Octave retenait
  useDesktopAppLinks(authed && !needsServerUrl); // bureau : les liens `tentacle://octave/…` du système

  // Re-fetch plugins after login (backendUrl doesn't change so the effect won't re-run otherwise)
  useEffect(() => {
    if (authed) refreshPlugins();
  }, [authed, refreshPlugins]);

  // Bureau : l'adresse du serveur avant tout le reste. La mention légale qui
  // la précédait a été retirée (demande de Damien, 2026-10-03) ; la clé
  // `disclaimer_accepted` d'une installation existante reste en place, inerte.
  if (needsServerUrl) {
    return <AppConnect onConnected={() => { setNeedsServerUrl(false); window.location.reload(); }} />;
  }

  if (setupRequired === null) return <LaunchWait />; // lancement en Octave : son fond, sans anneau

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

  if (profileGate) return profileGate;

  return (
    <ToastProvider>
      <WatchTogetherProvider>
      {/* La feuille des saisons à demander : la recherche et l'omnibox l'ouvrent. */}
      <SeasonRequestProvider>
      <AppBindings authed={authed} offlineMode={offlineMode} />
      {/* Les messages de l'administrateur à cette session — au-dessus de tout, lecteur compris. */}
      <SessionMessageHost />
      <Suspense fallback={<PageSpinner />}>
        <AnimatedRoutes>
          {/* Public */}
          <Route path="/login" element={<ByFormFactor desktop={<Login />} mirror={<MirrorLogin />} />} />
          {/* Le lien de l'assistant (journaux du serveur) : une fois l'installation faite, l'accueil. */}
          <Route path="/setup" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<ByFormFactor desktop={<Register />} mirror={<MirrorRegister />} />} />
          <Route path="/share/:token" element={<SharePage />} />
          <Route path="/share/:token/:itemId" element={<SharedItemDetail />} />

          {/* Protected — immersive. Avec le PiP, `PlayerStage` rend le lecteur hors des routes. */}
          <Route path="/watch/:itemId" element={guard(playerOnStage ? <></> : <Watch />)} />
          {DevGlassLab ? <Route path="/dev/verre" element={guard(<DevGlassLab />)} /> : null}
          <Route path="/media/:itemId" element={guard(onlineOnly(<ByFormFactor desktop={<MediaDetail />} mirror={<MirrorMediaDetail />} />))} />
          {/* La page d'une personne : un clic sur le casting ou l'équipe d'une fiche. Immersive, comme la fiche. */}
          <Route path="/person/:personId" element={guard(onlineOnly(<ByFormFactor desktop={<Person />} mirror={<MirrorPerson />} />))} />
          {/* La fiche d'un titre gardé sur la machine, et celle d'une série :
              la scène de la fiche en ligne, lue sur le disque — en ligne comme
              hors ligne. Immersives, comme la fiche. */}
          <Route path="/offline/item/:itemId" element={guard(<OfflineMediaDetail />)} />
          <Route path="/offline/series/:seriesKey" element={guard(<OfflineSeriesView />)} />
          {/* Le mode musique : sa coquille, chargée à la demande ; il se garde lui-même (`music.library`). */}
          <Route path={`${OCTAVE_BASE_PATH}/*`} element={guard(<OctaveRoute />)} />

          {/* Protected — with layout (sidebar desktop / tabbar mobile) */}
          {/* Mode musique allumé : l'accueil EST Octave (comme le hors ligne remplace
              l'accueil), décidé AVANT la mise en page — rien de Tentacle ne clignote. */}
          <Route element={guard(<OctaveHomeGate><AppLayout /></OctaveHomeGate>)}>
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
              {/* Accueil et découverte : la page tient le hors ligne elle-même (le démarrage d'Octave y reste réglable). */}
              <Route path="personalization" element={<SettingsPersonalization />} />
              {/* Compte et sécurité : sans objet hors ligne (tout y parle au serveur, sauf le serveur lui-même). */}
              <Route
                path="security"
                element={offlineMode ? <Navigate to="/settings/appearance" replace /> : <SettingsSecurity />}
              />
              {/* La Famille : sans objet hors ligne ni face à un serveur d'avant (la page se retire d'elle-même). */}
              <Route
                path="family"
                element={offlineMode ? <Navigate to="/settings/appearance" replace /> : <SettingsFamily />}
              />
              {/* Lecture, et Langues et sous-titres : le même module paresseux (la rubrique se lit dans l'adresse). */}
              <Route path="playback" element={<Preferences />} />
              <Route path="languages" element={<Preferences />} />
              <Route path="downloads" element={<SettingsDownloads />} />
              {/* « Données » n'est plus une rubrique : la page renvoie à Lecture › Connexion (la cible LG y garde son écran Compte). */}
              <Route path="data" element={<SettingsData />} />
              {/* Volets propres au miroir (Profil de l'app) : au bureau, la ligne qui les porte. */}
              <Route path="password" element={<Navigate to={WIDE_LEGACY_PATHS.password} replace />} />
              <Route path="devices" element={<Navigate to={WIDE_LEGACY_PATHS.devices} replace />} />
              <Route path="media-languages" element={<Navigate to={WIDE_LEGACY_PATHS["media-languages"]} replace />} />
              <Route path="invites" element={<Navigate to="/admin/invites" replace />} />
            </Route>
            {/* Le chemin de la Famille commun aux clients (cloche, liens) : sa section des réglages. */}
            <Route path="family" element={<Navigate to="/settings/family" replace />} />
            <Route path="profile" element={onlineOnly(<ByFormFactor desktop={<MobileProfile />} mirror={<MirrorProfile />} />)} />
            {/* Une rubrique du catalogue des réglages (`/profile/playback`…) : la page de l'app. */}
            <Route path="profile/:section" element={onlineOnly(<ByFormFactor desktop={<MobileProfile />} mirror={<MirrorProfile />} />)} />
            <Route path="pair-device" element={onlineOnly(<ByFormFactor desktop={<PairDevice />} mirror={<MirrorPairDevice />} />)} />
            {/* Admin en maitre-detail : route PARENTE avec rail de sections.
                Les URLs restent identiques a l'avant (`/admin/users`,
                `/admin/services`, `/admin/plugins/<id>`), elles deviennent
                simplement des enfants — aucun lien profond ne casse. */}
            <Route path="admin" element={onlineOnly(<AdminLayout />)}>
              <Route index element={<AdminHome />} />
              <Route path="sessions" element={<AdminSessions />} />
              <Route path="users" element={<AdminUsers />} />
              {/* La Famille du serveur passe par le module de la page Utilisateurs : aucune
                  entrée de plus dans `lazyPages.ts` (la cible webOS le remplace). */}
              <Route path="family" element={<AdminUsers section="family" />} />
              <Route path="downloads" element={<AdminDownloads />} />
              <Route path="invites" element={<AdminInvites />} />
              <Route path="tickets" element={<AdminTicketsPage />} />
              <Route path="services" element={<AdminServicesPage />} />
              {/* L'accès à distance passe par le module de la page Services : il reste ainsi
                  hors du client LG sans entrée de plus dans `lazyPages.ts` (cf. AdminRemoteAccessView). */}
              {/* Section d'un serveur 1.24.0 : un serveur d'avant ne la déclare pas → la vue d'ensemble. */}
              <Route path="remote-access" element={(
                <ServerCapabilityGate capability="admin.remoteAccess" fallback={<Navigate to="/admin" replace />}>
                  <AdminServicesPage section="remote-access" />
                </ServerCapabilityGate>
              )} />
              {/* « Système » : module de la page Services, aucune entrée de plus dans `lazyPages.ts`. */}
              <Route path="system" element={<AdminServicesPage section="system" />} />
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

            {/* Dynamic plugin routes (sandboxed iframes) — TOUTES, masquées comprises : une page
                que son extension retire de la navigation (`hidden`) s'ouvre encore par un lien
                (Octave, administration). Cf. hooks/pluginNavPages.ts. */}
            {activePluginsMeta.flatMap((plugin) =>
              webPluginRoutes(plugin)
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
          <Route path="*" element={<UnknownRoute authed={authed} notFound={<NotFound />} />} />
        </AnimatedRoutes>
      </Suspense>
      {authed && playerOnStage && <PlayerStage />}
      <StartupOverlays authed={authed} />
      {/* La recherche de toute l'application (⌘K, « / », la barre) — au-dessus
          des pages avec ou sans navigation, jamais pendant la lecture. */}
      <OmniboxHost enabled={authed && !offlineMode && !inOctave} />
      {authed && <OfflineSessionGate />}
      {/* Overlay bloquant « serveur injoignable » : comportement WEB uniquement.
          Sur desktop, le mode Hors ligne (connectivityStore + pastille TopNav)
          remplace le blocage — l'app reste utilisable sur le contenu local. */}
      {!isDesktopApp() && <OfflineBanner />}
      </SeasonRequestProvider>
      </WatchTogetherProvider>
    </ToastProvider>
  );
}
