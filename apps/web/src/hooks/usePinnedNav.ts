import { useCallback, useMemo, useSyncExternalStore } from "react";
import { isPluginNavPinnedBy, readKeyList, withPluginNavPinned } from "./pluginNavPins";

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
   *
   * Une page que son extension cache de la barre (`primary: false`, capacité
   * `plugins.navigation`) n'y est jamais, quels que soient ces gestes, qui
   * restent gardés pour le jour où elle y revient (`pluginNavPins.ts`).
   */
  pluginsUnpinned: string[];
  /** Pages mises dans la barre quand `primary: false` n'était qu'un défaut (avant le 26/10) : lues sans effet. */
  pluginsPinned: string[];
}

const DEFAULT: PinnedState = { libraries: [], favorites: false, watchlist: false, pluginsUnpinned: [], pluginsPinned: [] };

// Shared in-memory snapshot so all hook instances stay in sync
let snapshot: PinnedState = readFromStorage();
const listeners = new Set<() => void>();

function readFromStorage(): PinnedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = { ...DEFAULT, ...JSON.parse(raw) } as PinnedState;
    // Un champ abîmé ne fait pas tomber la barre : une liste illisible vaut « rien de choisi ».
    return { ...parsed, pluginsUnpinned: readKeyList(parsed.pluginsUnpinned), pluginsPinned: readKeyList(parsed.pluginsPinned) };
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

  /** `primary` : la place par défaut que l'extension donne à la page (absent : dans la barre). */
  const setPluginNavPinned = useCallback((key: string, on: boolean, primary?: boolean) => {
    const prev = getSnapshot();
    persist({ ...prev, ...withPluginNavPinned(prev, key, on, primary) });
  }, []);

  const togglePluginNav = useCallback((key: string, primary?: boolean) => {
    const prev = getSnapshot();
    persist({ ...prev, ...withPluginNavPinned(prev, key, !isPluginNavPinnedBy(prev, key, primary), primary) });
  }, []);

  /** Plus aucun geste sur les pages d'extensions : chacune reprend la place que son extension lui donne. */
  const resetPluginNav = useCallback(() => {
    persist({ ...getSnapshot(), pluginsUnpinned: [], pluginsPinned: [] });
  }, []);

  const isLibraryPinned = useCallback(
    (id: string) => state.libraries.includes(id),
    [state.libraries]
  );

  const isPluginNavPinned = useCallback(
    (key: string, primary?: boolean) => isPluginNavPinnedBy(state, key, primary),
    [state]
  );

  return useMemo(
    () => ({
      ...state,
      toggleLibrary,
      toggleFavorites,
      toggleWatchlist,
      togglePluginNav,
      setPluginNavPinned,
      resetPluginNav,
      isLibraryPinned,
      isPluginNavPinned,
    }),
    [state, toggleLibrary, toggleFavorites, toggleWatchlist, togglePluginNav, setPluginNavPinned, resetPluginNav, isLibraryPinned, isPluginNavPinned]
  );
}
