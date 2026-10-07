import { useCallback, useEffect, useRef, useState } from "react";
import { searchRemembers } from "@tentacle-tv/tv-core";
import { pushRecentSearch, readRecentSearches } from "../../storage/recentSearches";

/** Le moteur répond en quelques millisecondes : on n'attend que la frappe. */
const DEBOUNCE_MS = 150;

/**
 * La saisie de la recherche : ce qui est tapé (clavier à l'écran, clavier
 * système et sa dictée, suggestion ou recherche récente choisie), sa version
 * débattue, qui interroge le moteur, et les recherches récentes de l'appareil.
 * Mêmes règles que l'écran d'Android TV.
 */
export function useSearchInput() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [recents, setRecents] = useState<string[]>(() => readRecentSearches());

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const onKey = useCallback((char: string) => setQuery((q) => q + char), []);
  const onSpace = useCallback(() => setQuery((q) => q + " "), []);
  const onDelete = useCallback(() => setQuery((q) => q.slice(0, -1)), []);
  const onClear = useCallback(() => setQuery(""), []);

  // Mémorisée à la SÉLECTION d'un résultat, pas à la frappe (parité LG) : une
  // requête abandonnée en route n'a rien donné, la ressortir serait un mauvais conseil.
  // Stable d'une frappe à l'autre (la requête est lue au moment du choix) :
  // les gestionnaires des cartes qui l'appellent ne changent pas à chaque
  // lettre, et les cartes mémoïsées ne se redessinent pas.
  const latest = useRef(debounced);
  latest.current = debounced;
  const remember = useCallback(() => {
    const chosen = latest.current;
    if (searchRemembers("result", chosen)) setRecents(pushRecentSearch(chosen));
  }, []);

  return { query, setQuery, debounced, recents, remember, onKey, onSpace, onDelete, onClear };
}

export type SearchInput = ReturnType<typeof useSearchInput>;
