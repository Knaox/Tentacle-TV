/**
 * Octave — la recherche dans la bibliothèque musique (index local du serveur,
 * < 100 ms) pendant la frappe :
 *
 * - ANTI-REBOND court (120 ms par défaut) : une rafale de lettres ne fait
 *   partir qu'une requête ;
 * - ANNULATION : la requête d'une frappe dépassée est abandonnée (le signal de
 *   TanStack passe jusqu'à `fetch`) ;
 * - CACHE : revenir à une frappe déjà vue répond sans réseau (60 s) ;
 * - PROGRESSIF : la réponse précédente reste affichée pendant la suivante —
 *   jamais un écran vide entre deux lettres.
 *
 * Les résultats d'une extension se fusionnent DANS l'interface (contrat,
 * point 1) ; ce crochet ne connaît que la bibliothèque.
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { musicApi } from "./musicApi";
import { useMusicCapability } from "./useMusicLibrary";
import { KEEP_PREVIOUS, musicKeys } from "./musicQueryKeys";

export interface MusicSearchOptions {
  /** Titres au plus ; albums, artistes et playlists : la moitié. Le serveur plafonne à 50. */
  limit?: number;
  debounceMs?: number;
  enabled?: boolean;
}

/** La frappe, une fois qu'elle s'est arrêtée `delayMs`. */
export function useDebouncedText(value: string, delayMs: number): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (value === settled) return;
    // Effacer la recherche se voit tout de suite.
    if (value === "") {
      setSettled("");
      return;
    }
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs, settled]);
  return settled;
}

/** La frappe normalisée pour la clé de cache : « Kevin  » et « kevin » sont la même recherche. */
export function musicSearchText(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export function useMusicSearch(raw: string, options: MusicSearchOptions = {}) {
  const capable = useMusicCapability();
  const limit = options.limit ?? 20;
  const typed = musicSearchText(raw);
  const q = useDebouncedText(typed, options.debounceMs ?? 120);
  const result = useQuery({
    queryKey: musicKeys.search(q, limit),
    queryFn: ({ signal }) => musicApi.search(q, limit, signal),
    enabled: capable && options.enabled !== false && q.length > 0,
    staleTime: 60_000,
    ...KEEP_PREVIOUS,
  });
  return {
    ...result,
    // Barre vidée : plus rien (la réponse précédente ne sert de remplacement qu'entre deux frappes).
    data: q.length > 0 ? result.data : undefined,
    /** La frappe que les résultats affichés concernent (peut retarder sur `raw`). */
    settledQuery: q,
    /** Vrai pendant l'anti-rebond ou la requête : les résultats montrés sont ceux d'avant. */
    pending: typed !== q || result.isFetching,
  };
}
