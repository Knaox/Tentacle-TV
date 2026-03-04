import { useSyncExternalStore, useCallback, useState, useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { UpdateNotification } from "./components/UpdateNotification";
import { OfflineBanner } from "./components/OfflineBanner";
import { ServerSetup } from "./pages/ServerSetup";
import { AppConnect } from "./pages/AppConnect";
import { useJellyfinClient, useTentacleConfig, useStreamingConfig } from "@tentacle-tv/api-client";
import { usePluginRoutes, usePluginAdminRoutes } from "@tentacle-tv/plugins-api";
import { isTauriApp } from "./main";

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

function PageSpinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
    </div>
  );
}

/* -- Reactive auth state -- */
const authListeners = new Set<() => void>();
function notifyAuthChange() { authListeners.forEach((cb) => cb()); }

const origSetItem = localStorage.setItem.bind(localStorage);
const origRemoveItem = localStorage.removeItem.bind(localStorage);
localStorage.setItem = (key: string, value: string) => {
  origSetItem(key, value);
  if (key === "tentacle_token") notifyAuthChange();
};
localStorage.removeItem = (key: string) => {
  origRemoveItem(key);
  if (key === "tentacle_token") notifyAuthChange();
};

function useIsAuthenticated(): boolean {
  const subscribe = useCallback((cb: () => void) => {
    authListeners.add(cb);
    return () => { authListeners.delete(cb); };
  }, []);
  return useSyncExternalStore(subscribe, () => !!localStorage.getItem("tentacle_token"));
}

/** Sync direct streaming config from backend into JellyfinClient. */
function DirectStreamingSync() {
  const client = useJellyfinClient();
  const token = localStorage.getItem("tentacle_token");
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

  return null;
}

export function App() {
  const authed = useIsAuthenticated();
  const client = useJellyfinClient();
  const { storage } = useTentacleConfig();
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [backendDown, setBackendDown] = useState(false);
  // Desktop app: need server URL before anything else
  const [needsServerUrl, setNeedsServerUrl] = useState(
    isTauriApp && !localStorage.getItem("tentacle_server_url")
  );
  const pluginRoutes = usePluginRoutes();
  const pluginAdminRoutes = usePluginAdminRoutes();
  const guard = (el: React.ReactElement) => authed ? el : <Navigate to="/login" replace />;

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

  // Desktop app: show simple server URL input
  if (needsServerUrl) {
    return <AppConnect onConnected={() => { setNeedsServerUrl(false); window.location.reload(); }} />;
  }

  if (setupRequired === null) return <PageSpinner />;

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
          storage.setItem("tentacle_token", token);
          storage.setItem("tentacle_user", JSON.stringify(user));
          setSetupRequired(false);
        }}
      />
    );
  }

  return (
    <>
      {authed && <DirectStreamingSync />}
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

            <Route path="support" element={<Support />} />
            <Route path="settings" element={<Preferences />} />
            <Route path="pair-device" element={<PairDevice />} />
            <Route path="admin/*" element={<Admin />} />
            <Route path="admin/plugins" element={<AdminPlugins />} />

            {/* Dynamic plugin admin routes */}
            {pluginAdminRoutes.map((route) => (
              <Route
                key={route.path}
                path={route.path.replace(/^\//, "")}
                element={<Suspense fallback={<PageSpinner />}><route.component /></Suspense>}
              />
            ))}
            <Route path="about" element={<About />} />
            <Route path="credits" element={<Credits />} />

            {/* Dynamic plugin routes */}
            {pluginRoutes.map((route) => (
              <Route
                key={route.path}
                path={route.path.replace(/^\//, "")}
                element={<route.component />}
              />
            ))}
          </Route>

          <Route path="/preferences" element={<Navigate to="/settings" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <UpdateNotification />
      <OfflineBanner />
    </>
  );
}
