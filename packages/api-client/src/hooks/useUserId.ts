import { useSyncExternalStore, useCallback, useMemo } from "react";
import { useTentacleConfig } from "../context";

/**
 * Reactive subscriber set — mirrors the pattern used in App.tsx for useIsAuthenticated.
 * When tentacle_user changes in localStorage, all useUserId consumers re-render.
 */
const userListeners = new Set<() => void>();

export function notifyUserChange(): void {
  userListeners.forEach((cb) => cb());
}

/** Whether we are in a browser environment with localStorage available. */
const HAS_LOCAL_STORAGE = typeof localStorage !== "undefined";

/**
 * Le dernier `tentacle_user` lu, et son Id. `useSyncExternalStore` relit le
 * snapshot à CHAQUE rendu de chaque abonné (deux fois au montage) : sans ce
 * souvenir, chaque carte d'une grille refaisait un `JSON.parse` du compte
 * entier pour rendre toujours le même Id.
 */
let lastRaw: string | null = null;
let lastId: string | null = null;

export function userIdFrom(raw: string | null): string | null {
  if (raw === lastRaw) return lastId;
  lastRaw = raw;
  try {
    lastId = raw ? JSON.parse(raw).Id ?? null : null;
  } catch {
    lastId = null;
  }
  return lastId;
}

function getWebSnapshot(): string | null {
  try {
    return userIdFrom(localStorage.getItem("tentacle_user"));
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

/**
 * Returns the current Jellyfin user ID, reactively.
 *
 * On web/desktop: uses useSyncExternalStore to re-render when tentacle_user
 * is written/removed from localStorage (via notifyUserChange()).
 *
 * On React Native: reads from the storage adapter on each render (non-reactive
 * via external store, but React Native handles auth state transitions through
 * navigation/re-mounts rather than in-place re-renders).
 */
export function useUserId(): string | null {
  const { storage } = useTentacleConfig();

  const subscribe = useCallback((cb: () => void) => {
    if (!HAS_LOCAL_STORAGE) return () => {};
    userListeners.add(cb);
    return () => { userListeners.delete(cb); };
  }, []);

  const getSnapshot = useMemo(() => {
    if (HAS_LOCAL_STORAGE) return getWebSnapshot;
    // React Native: read from storage adapter
    return () => {
      try {
        return userIdFrom(storage.getItem("tentacle_user"));
      } catch {
        return null;
      }
    };
  }, [storage]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
