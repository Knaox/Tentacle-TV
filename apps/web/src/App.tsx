import { useSyncExternalStore, useCallback, useState, useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { UpdateNotification } from "./components/UpdateNotification";
import { ServerSetup } from "./pages/ServerSetup";
import { AppConnect } from "./pages/AppConnect";
import { useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { usePluginRoutes } from "@tentacle-tv/plugins-api";
import { isTauriApp } from "./main";

/* -- Lazy-loaded pages (code-split) -- */
const Home = lazy(() => import("./pages/Home").then((m) => ({ default: m.Home })));
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const Register = lazy(() => import("./pages/Register").then((m) => ({ default: m.Register })));
const Watch = lazy(() => import("./pages/Watch").then((m) => ({ default: m.Watch })));
const MediaDetail = lazy(() => import("./pages/MediaDetail").then((m) => ({ default: m.MediaDetail })));
const Library = lazy(() => import("./pages/Library").then((m) => ({ default: m.Library })));
const Downloads = lazy(() => import("./pages/Downloads").then((m) => ({ default: m.Downloads })));
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

  // Backend unreachable (502/503/crash) — show error, not setup wizard
  if (backendDown) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="mb-4 text-5xl">&#x26A0;</div>
          <h1 className="mb-2 text-xl font-bold text-white">Serveur indisponible</h1>
          <p className="mb-6 text-sm text-white/50">
            Le backend Tentacle TV ne repond pas. Verifiez que le service est demarre et consultez les logs du serveur.
          </p>
          <button onClick={() => window.location.reload()}
            className="rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-purple-700">
            Reessayer
          </button>
        </div>
      </div>
    );
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
      <Suspense fallback={<PageSpinner />}>
        <PluginRoutes guard={guard} />
      </Suspense>
      <UpdateNotification />
    </>
  );
}

function PluginRoutes({ guard }: { guard: (el: React.ReactElement) => React.ReactElement }) {
  const pluginRoutes = usePluginRoutes();

  return (
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
        <Route path="downloads" element={<Downloads />} />
        <Route path="support" element={<Support />} />
        <Route path="settings" element={<Preferences />} />
        <Route path="pair-device" element={<PairDevice />} />
        <Route path="admin/*" element={<Admin />} />
        <Route path="admin/plugins" element={<AdminPlugins />} />
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
  );
}
