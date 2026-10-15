import { useEffect, useState } from "react";
import type { SearchMediaItem, SearchResponse } from "@tentacle-tv/shared";
import { EPISODES_WAIT_MS } from "./searchViewHold";

export interface SearchView {
  response: SearchResponse | undefined;
  episodes: readonly SearchMediaItem[];
}

/**
 * Ce que la page de résultats AFFICHE : les résultats et leurs épisodes,
 * ensemble (cf. `searchViewHold`). Tant que les épisodes de la requête n'ont
 * pas répondu, la vue déjà affichée reste en place — rien à la toute première
 * requête, la précédente pendant une frappe : jamais d'écran blanc entre deux
 * lettres. Après `EPISODES_WAIT_MS`, les résultats partent sans eux.
 *
 * `key` : la requête et l'onglet ; `episodes` doit être d'identité stable.
 */
export function useHeldSearchView(current: SearchView, settled: boolean, key: string): SearchView {
  const [expired, setExpired] = useState<string | null>(null);
  useEffect(() => {
    if (settled) return;
    const id = setTimeout(() => setExpired(key), EPISODES_WAIT_MS);
    return () => clearTimeout(id);
  }, [key, settled]);

  const open = settled || expired === key;
  const [shown, setShown] = useState<SearchView>(() => (open ? current : { response: undefined, episodes: current.episodes }));
  // État dérivé pendant le rendu (et non dans un effet) : la vue suit dans le
  // MÊME rendu, sans image intermédiaire.
  if (open && (shown.response !== current.response || shown.episodes !== current.episodes)) {
    setShown(current);
  }
  return open ? current : shown;
}
