import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { wtAuthInit, wtBackendRoot } from "../../hooks/useWatchTogetherApi";

/**
 * Watch Together — recherche de GIFs via le proxy backend `/api/gifs`
 * (clé Klipy côté serveur uniquement). Requête vide → tendances (featured),
 * sinon recherche plein texte. Même serveur et même authentification que le
 * reste de Watch Together (`setWatchTogetherBackendUrl`, jeton) : web, bureau
 * et mobile.
 */

export interface GifItem {
  id: string;
  /** URL tinygif (~220 px) : aperçu grille ET payload de wt:gif. */
  url: string;
  w: number;
  h: number;
}

export interface GifsPayload {
  configured: boolean;
  results: GifItem[];
  /** Klipy en erreur/injoignable (distinct d'une recherche sans résultat). */
  error?: boolean;
}

/** Valeur debouncée — évite une requête Klipy à chaque frappe. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** `language` : la langue de l'interface (« fr », « en-US »…) — Klipy cherche dans la sienne. */
export function useGifSearch(rawQuery: string, language: string | undefined) {
  const query = useDebouncedValue(rawQuery.trim(), 350);
  const locale = language?.toLowerCase().startsWith("fr") ? "fr_FR" : "en_US";

  return useQuery({
    queryKey: ["wt-gifs", query, locale],
    queryFn: async (): Promise<GifsPayload> => {
      const base = `${wtBackendRoot()}/api/gifs`;
      const url = query
        ? `${base}/search?q=${encodeURIComponent(query)}&locale=${locale}`
        : `${base}/featured?locale=${locale}`;
      const res = await fetch(url, wtAuthInit());
      // 404 (vieux serveur sans la route) ou autre échec → même UX que non configuré.
      if (!res.ok) return { configured: false, results: [] };
      return (await res.json()) as GifsPayload;
    },
    staleTime: 5 * 60 * 1000,
    // Garde la grille précédente affichée pendant la frappe (pas de flash).
    placeholderData: (prev) => prev,
  });
}
