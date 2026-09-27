import { useCallback, useState } from "react";

export type WatchlistView = "grid" | "list";

/**
 * Clé NOUVELLE, propre à Ma liste — elle ne se renomme pas (cf. CLAUDE.md,
 * « un nom traversé par une chaîne n'est pas un identifiant »). Partagée par
 * le bureau et le miroir : c'est une préférence de l'appareil.
 */
const VIEW_STORAGE_KEY = "tentacle_watchlist_view";

function readStoredView(): WatchlistView {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

/** Grille ou liste, retenu d'une visite à l'autre quand le stockage le permet. */
export function useWatchlistView() {
  const [view, setViewState] = useState<WatchlistView>(readStoredView);
  const setView = useCallback((next: WatchlistView) => {
    setViewState(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Stockage refusé (navigation privée) : le choix vaut pour la visite.
    }
  }, []);
  return { view, setView };
}
