import { useSyncExternalStore, useCallback, useState, useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { UpdateNotification } from "./components/UpdateNotification";
import { ServerSetup } from "./pages/ServerSetup";
import { useJellyfinClient, useTentacleConfig } from "@tentacle/api-client";

/* -- Lazy-loaded pages (code-split) -- */
const Home = lazy(() => import("./pages/Home").then((m) => ({ default: m.Home })));
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const Register = lazy(() => import("./pages/Register").then((m) => ({ default: m.Register })));
const Watch = lazy(() => import("./pages/Watch").then((m) => ({ default: m.Watch })));
const MediaDetail = lazy(() => import("./pages/MediaDetail").then((m) => ({ default: m.MediaDetail })));
const Library = lazy(() => import("./pages/Library").then((m) => ({ default: m.Library })));
const Discover = lazy(() => import("./pages/Discover").then((m) => ({ default: m.Discover })));
const Downloads = lazy(() => import("./pages/Downloads").then((m) => ({ default: m.Downloads })));
const Support = lazy(() => import("./pages/Support").then((m) => ({ default: m.Support })));
const Admin = lazy(() => import("./pages/Admin").then((m) => ({ default: m.Admin })));
const Preferences = lazy(() => import("./pages/Preferences").then((m) => ({ default: m.Preferences })));
const About = lazy(() => import("./pages/About").then((m) => ({ default: m.About })));
const Credits = lazy(() => import("./pages/Credits").then((m) => ({ default: m.Credits })));
const MyRequestsList = lazy(() => import("./components/MyRequestsList").then((m) => ({ default: m.MyRequestsList })));

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
  const guard = (el: React.ReactElement) => authed ? el : <Navigate to="/login" replace />;

  // Check backend setup status on mount
  useEffect(() => {
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((data) => setSetupRequired(data.state !== "running"))
      .catch(() => setSetupRequired(true));
  }, []);

  if (setupRequired === null) return <PageSpinner />;

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
        <Routes>
          {/* Public */}
          <Route path="/login" element={authed ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected — immersive (no sidebar/tabbar) */}
          <Route path="/watch/:itemId" element={guard(<Watch />)} />
          <Route path="/media/:itemId" element={guard(<MediaDetail />)} />

          {/* Protected — with layout (sidebar desktop / tabbar mobile) */}
          <Route element={guard(<AppLayout />)}>
            <Route index element={<Home />} />
            <Route path="library/:libraryId" element={<Library />} />
            <Route path="discover" element={<Discover />} />
            <Route path="requests" element={<RequestsPage />} />
            <Route path="downloads" element={<Downloads />} />
            <Route path="support" element={<Support />} />
            <Route path="settings" element={<Preferences />} />
            <Route path="admin" element={<Admin />} />
            <Route path="about" element={<About />} />
            <Route path="credits" element={<Credits />} />
          </Route>

          <Route path="/preferences" element={<Navigate to="/settings" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <UpdateNotification />
    </>
  );
}

function RequestsPage() {
  return <div className="px-4 pt-4 md:px-12"><MyRequestsList /></div>;
}
