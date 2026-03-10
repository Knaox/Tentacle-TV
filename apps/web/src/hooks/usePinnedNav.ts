import { useCallback, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "tentacle_pinned_nav";

interface PinnedState {
  libraries: string[];
  favorites: boolean;
  watchlist: boolean;
}

const DEFAULT: PinnedState = { libraries: [], favorites: false, watchlist: false };

// Shared in-memory snapshot so all hook instances stay in sync
let snapshot: PinnedState = readFromStorage();
const listeners = new Set<() => void>();

function readFromStorage(): PinnedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

function persist(next: PinnedState) {
  snapshot = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot() {
  return snapshot;
}

export function usePinnedNav() {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  const toggleLibrary = useCallback((id: string) => {
    const prev = getSnapshot();
    const libs = prev.libraries.includes(id)
      ? prev.libraries.filter((l) => l !== id)
      : [...prev.libraries, id];
    persist({ ...prev, libraries: libs });
  }, []);

  const toggleFavorites = useCallback(() => {
    const prev = getSnapshot();
    persist({ ...prev, favorites: !prev.favorites });
  }, []);

  const toggleWatchlist = useCallback(() => {
    const prev = getSnapshot();
    persist({ ...prev, watchlist: !prev.watchlist });
  }, []);

  const isLibraryPinned = useCallback(
    (id: string) => state.libraries.includes(id),
    [state.libraries]
  );

  return useMemo(
    () => ({
      ...state,
      toggleLibrary,
      toggleFavorites,
      toggleWatchlist,
      isLibraryPinned,
    }),
    [state, toggleLibrary, toggleFavorites, toggleWatchlist, isLibraryPinned]
  );
}
