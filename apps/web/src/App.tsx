import { useSyncExternalStore, useCallback, useState, useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { UpdateModal } from "./components/UpdateModal";
import { OfflineBanner } from "./components/OfflineBanner";
import { ServerSetup } from "./pages/ServerSetup";
import { AppConnect } from "./pages/AppConnect";
import { useJellyfinClient, useTentacleConfig, useStreamingConfig, STREAMING_CONFIG_QUERY_KEY, notifyUserChange } from "@tentacle-tv/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useActivePluginsMeta, useRefreshPlugins } from "@tentacle-tv/plugins-api";
import { PluginIframe } from "./components/PluginIframe";
import { backendUrl } from "./main";
import { useDirectStreamingGuard } from "./hooks/useDirectStreamingGuard";
import { useScrollMemory } from "./hooks/useScrollMemory";
import { ToastProvider } from "./contexts/ToastContext";
import { isTauriApp } from "./main";
import { Disclaimer } from "./pages/Disclaimer";

/* -- Lazy-loaded pages (code-split) -- */
const Home = lazy(() => import("./pages/Home").then((m) => ({ default: m.Home })));
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const Register = lazy(() => import("./pages/Register").then((m) => ({ default: m.Register })));
const Watch = lazy(() => import("./pages/Watch").then((m) => ({ default: m.Watch })));
const MediaDetail = lazy(() => import("./pages/MediaDetail").then((m) => ({ default: m.MediaDetail })));
const Library = lazy(() => import("./pages/Library").then((m) => ({ default: m.Library })));

const Support = lazy(() => import("./pages/Support").then((m) => ({ default: m.Support })));
const Admin = lazy(() => import("./pages/Admin").then((m) => ({ default: m.Admin })));
const Preferences = lazy(() => import("./pages/Preferences").then((m) => ({ default: m.Preferences })));
const About = lazy(() => import("./pages/About").then((m) => ({ default: m.About })));
const Credits = lazy(() => import("./pages/Credits").then((m) => ({ default: m.Credits })));
const PairDevice = lazy(() => import("./pages/PairDevice").then((m) => ({ default: m.PairDevice })));
const AdminPlugins = lazy(() => import("./pages/AdminPlugins").then((m) => ({ default: m.AdminPlugins })));
const Watchlist = lazy(() => import("./pages/Watchlist").then((m) => ({ default: m.Watchlist })));
const Favorites = lazy(() => import("./pages/Favorites").then((m) => ({ default: m.Favorites })));

function PageSpinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
    </div>
  );
}

/* -- Reactive auth state (tracks tentacle_user, not token — token is in httpOnly cookie) -- */
const authListeners = new Set<() => void>();
function notifyAuthChange() { authListeners.forEach((cb) => cb()); }

const origSetItem = localStorage.setItem.bind(localStorage);
const origRemoveItem = localStorage.removeItem.bind(localStorage);
localStorage.setItem = (key: string, value: string) => {
  origSetItem(key, value);
  if (key === "tentacle_user") { notifyAuthChange(); notifyUserChange(); }
};
localStorage.removeItem = (key: string) => {
  origRemoveItem(key);
  if (key === "tentacle_user") { notifyAuthChange(); notifyUserChange(); }
};

function useIsAuthenticated(): boolean {
  const subscribe = useCallback((cb: () => void) => {
    authListeners.add(cb);
    return () => { authListeners.delete(cb); };
  }, []);
  return useSyncExternalStore(subscribe, () => !!localStorage.getItem("tentacle_user"));
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
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [backendDown, setBackendDown] = useState(false);
  // Desktop app: need server URL before anything else
  const [needsServerUrl, setNeedsServerUrl] = useState(
    isTauriApp && !localStorage.getItem("tentacle_server_url")
  );
  const activePluginsMeta = useActivePluginsMeta();
  const refreshPlugins = useRefreshPlugins();
  const guard = (el: React.ReactElement) => authed ? el : <Navigate to="/login" replace />;

  // Re-fetch plugins after login (backendUrl doesn't change so the effect won't re-run otherwise)
  useEffect(() => {
    if (authed) refreshPlugins();
  }, [authed, refreshPlugins]);

  // Check backend setup status on mount (web deployment only)
  useEffect(() => {
    if (needsServerUrl) { setSetupRequired(false); return; }
    const base = isTauriApp ? (localStorage.getItem("tentacle_server_url") || "") : "";
    let attempts = 0;
    const check = () => {
      fetch(`${base}/api/setup/status`)
        .then((r) => {
          if (r.status >= 500) throw new Error(`backend ${r.status}`);
          return r.json();
        })
        .then((data) => { setBackendDown(false); setSetupRequired(data.state !== "running"); })
        .catch(() => {
          attempts++;
          if (attempts < 5) { setTimeout(check, 2000); return; }
          // After 5 failed attempts: backend is unreachable — don't show setup wizard
          if (isTauriApp) { setSetupRequired(false); }
          else { setBackendDown(true); setSetupRequired(false); }
        });
    };
    check();
  }, [needsServerUrl]);

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
          setSetupRequired(false);
        }}
      />
    );
  }

  return (
    <ToastProvider>
      {authed && <DirectStreamingSync />}
      <ScrollMemoryWrapper />
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected — immersive (no sidebar/tabbar) */}
          <Route path="/watch/:itemId" element={guard(<Watch />)} />
          <Route path="/media/:itemId" element={guard(<MediaDetail />)} />

          {/* Protected — with layout (sidebar desktop / tabbar mobile) */}
          <Route element={guard(<AppLayout />)}>
            <Route index element={<Home />} />
            <Route path="library/:libraryId" element={<Library />} />
            <Route path="watchlist" element={<Watchlist />} />
            <Route path="favorites" element={<Favorites />} />

            <Route path="support" element={<Support />} />
            <Route path="settings" element={<Preferences />} />
            <Route path="pair-device" element={<PairDevice />} />
            <Route path="admin" element={<Admin />} />
            <Route path="admin/plugins" element={<AdminPlugins />} />

            {/* Dynamic plugin admin routes (sandboxed iframes) — convention: /admin/plugins/:pluginId */}
            {activePluginsMeta
              .filter((plugin) => plugin.hasBundle)
              .map((plugin) => (
                <Route
                  key={`admin-${plugin.pluginId}`}
                  path={`admin/plugins/${plugin.pluginId}`}
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <UpdateModal />
      <OfflineBanner />
    </ToastProvider>
  );
}

function ScrollMemoryWrapper() {
  useScrollMemory();
  return null;
}
