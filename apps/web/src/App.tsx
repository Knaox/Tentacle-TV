import { useSyncExternalStore, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Watch } from "./pages/Watch";
import { MediaDetail } from "./pages/MediaDetail";
import { Library } from "./pages/Library";
import { Discover } from "./pages/Discover";
import { Downloads } from "./pages/Downloads";
import { Support } from "./pages/Support";
import { Admin } from "./pages/Admin";
import { Preferences } from "./pages/Preferences";
import { About } from "./pages/About";
import { Credits } from "./pages/Credits";
import { MyRequestsList } from "./components/MyRequestsList";
import { UpdateNotification } from "./components/UpdateNotification";
import { ServerSetup } from "./pages/ServerSetup";
import { useServerConfig } from "./hooks/useServerConfig";

/* ── Reactive auth state ── */
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
  const { configured, save } = useServerConfig();
  const guard = (el: React.ReactElement) => authed ? el : <Navigate to="/login" replace />;

  // Show server setup if no Jellyfin URL is configured (no env var + no saved URL)
  if (!configured) {
    return <ServerSetup onComplete={(jUrl, bUrl) => { save(jUrl, bUrl); window.location.reload(); }} />;
  }

  return (
    <>
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

        {/* Legacy redirects + fallback */}
        <Route path="/preferences" element={<Navigate to="/settings" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <UpdateNotification />
    </>
  );
}

function RequestsPage() {
  return <div className="px-4 pt-4 md:px-12"><MyRequestsList /></div>;
}
