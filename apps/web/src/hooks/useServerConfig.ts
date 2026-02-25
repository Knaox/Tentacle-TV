import { useSyncExternalStore, useCallback } from "react";

const JELLYFIN_KEY = "tentacle_jellyfin_url";
const BACKEND_KEY = "tentacle_backend_url";

const listeners = new Set<() => void>();
function notify() { listeners.forEach((cb) => cb()); }

/** Read saved server URLs (or env defaults) */
function getSnapshot() {
  const envJellyfin = import.meta.env.VITE_JELLYFIN_URL || "";
  const envBackend = import.meta.env.VITE_BACKEND_URL || "";
  const jellyfin = localStorage.getItem(JELLYFIN_KEY) || envJellyfin;
  const backend = localStorage.getItem(BACKEND_KEY) || envBackend;
  return { jellyfinUrl: jellyfin, backendUrl: backend, configured: !!jellyfin };
}

let cached = getSnapshot();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshotStable() {
  const next = getSnapshot();
  if (
    next.jellyfinUrl !== cached.jellyfinUrl ||
    next.backendUrl !== cached.backendUrl
  ) {
    cached = next;
  }
  return cached;
}

export function useServerConfig() {
  const config = useSyncExternalStore(subscribe, getSnapshotStable);

  const save = useCallback((jellyfinUrl: string, backendUrl: string) => {
    localStorage.setItem(JELLYFIN_KEY, jellyfinUrl.replace(/\/$/, ""));
    localStorage.setItem(BACKEND_KEY, backendUrl.replace(/\/$/, ""));
    cached = getSnapshot();
    notify();
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(JELLYFIN_KEY);
    localStorage.removeItem(BACKEND_KEY);
    cached = getSnapshot();
    notify();
  }, []);

  return { ...config, save, clear };
}

/** Get server URLs synchronously (for initialization before React mounts) */
export function getServerUrls() {
  return getSnapshot();
}
