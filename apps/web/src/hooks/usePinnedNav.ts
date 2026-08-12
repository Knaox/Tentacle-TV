import { useCallback, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "tentacle_pinned_nav";

interface PinnedState {
  libraries: string[];
  favorites: boolean;
  watchlist: boolean;
  /*
   * Pages de plugin RETIRÉES de la navigation — et non celles qui y sont.
   *
   * Les bibliothèques sont désépinglées par défaut, les pages de plugin
   * doivent l'être. En enregistrant les exclusions plutôt que les inclusions,
   * une liste vide signifie « tout est épinglé » : le bon comportement dès la
   * première ouverture, sans migration pour les installations existantes.
   *
   * Clé d'une entrée : `${pluginId}:${path}`.
   */
  pluginsUnpinned: string[];
}

const DEFAULT: PinnedState = { libraries: [], favorites: false, watchlist: false, pluginsUnpinned: [] };

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

/** Identifiant d'une page de plugin dans la navigation. */
export function pluginNavKey(pluginId: string, path: string): string {
  return `${pluginId}:${path}`;
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

  const togglePluginNav = useCallback((key: string) => {
    const prev = getSnapshot();
    const unpinned = prev.pluginsUnpinned.includes(key)
      ? prev.pluginsUnpinned.filter((k) => k !== key)
      : [...prev.pluginsUnpinned, key];
    persist({ ...prev, pluginsUnpinned: unpinned });
  }, []);

  const isLibraryPinned = useCallback(
    (id: string) => state.libraries.includes(id),
    [state.libraries]
  );

  const isPluginNavPinned = useCallback(
    (key: string) => !state.pluginsUnpinned.includes(key),
    [state.pluginsUnpinned]
  );

  return useMemo(
    () => ({
      ...state,
      toggleLibrary,
      toggleFavorites,
      toggleWatchlist,
      togglePluginNav,
      isLibraryPinned,
      isPluginNavPinned,
    }),
    [state, toggleLibrary, toggleFavorites, toggleWatchlist, togglePluginNav, isLibraryPinned, isPluginNavPinned]
  );
}
