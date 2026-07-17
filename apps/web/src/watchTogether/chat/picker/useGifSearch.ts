import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getBackendBase } from "../../../lib/backendBase";

/**
 * Watch Together — recherche de GIFs via le proxy backend `/api/gifs`
 * (clé Tenor côté serveur uniquement). Requête vide → tendances (featured),
 * sinon recherche plein texte. Pattern fetch identique à useTmdbTrailers.
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
  /** Tenor en erreur/injoignable (distinct d'une recherche sans résultat). */
  error?: boolean;
}

function getToken(): string {
  return localStorage.getItem("tentacle_token") ?? "";
}

/** Valeur debouncée — évite une requête Tenor à chaque frappe. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function useGifSearch(rawQuery: string) {
  const { i18n } = useTranslation();
  const query = useDebouncedValue(rawQuery.trim(), 350);
  const locale = i18n.language?.toLowerCase().startsWith("fr") ? "fr_FR" : "en_US";

  return useQuery({
    queryKey: ["wt-gifs", query, locale],
    queryFn: async (): Promise<GifsPayload> => {
      const base = `${getBackendBase()}/api/gifs`;
      const url = query
        ? `${base}/search?q=${encodeURIComponent(query)}&locale=${locale}`
        : `${base}/featured?locale=${locale}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
      // 404 (vieux serveur sans la route) ou autre échec → même UX que non configuré.
      if (!res.ok) return { configured: false, results: [] };
      return (await res.json()) as GifsPayload;
    },
    staleTime: 5 * 60 * 1000,
    // Garde la grille précédente affichée pendant la frappe (pas de flash).
    placeholderData: (prev) => prev,
  });
}
