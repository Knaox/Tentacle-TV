import { useSyncExternalStore, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Watch } from "./pages/Watch";
import { MediaDetail } from "./pages/MediaDetail";
import { Admin } from "./pages/Admin";
import { Preferences } from "./pages/Preferences";
import { UpdateNotification } from "./components/UpdateNotification";

/**
 * Reactive auth state — listens for localStorage changes so that
 * login/logout immediately triggers a re-render (no F5 needed).
 */
const authListeners = new Set<() => void>();

function notifyAuthChange() {
  authListeners.forEach((cb) => cb());
}

// Patch localStorage so writes to "tentacle_token" trigger re-renders
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
  const getSnapshot = () => !!localStorage.getItem("tentacle_token");
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function App() {
  const isAuthenticated = useIsAuthenticated();
  const auth = (el: React.ReactElement) => isAuthenticated ? el : <Navigate to="/login" replace />;

  return (
    <>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/watch/:itemId" element={auth(<Watch />)} />
        <Route path="/media/:itemId" element={auth(<MediaDetail />)} />
        <Route path="/admin" element={auth(<Admin />)} />
        <Route path="/preferences" element={auth(<Preferences />)} />
        <Route path="/search" element={<Navigate to="/" replace />} />
        <Route path="/requests" element={<Navigate to="/" replace />} />
        <Route path="/" element={auth(<Home />)} />
      </Routes>
      <UpdateNotification />
    </>
  );
}
