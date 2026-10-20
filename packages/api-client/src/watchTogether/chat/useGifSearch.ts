import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { tentacleApiFetch } from "../../hooks/usePreferences";

/**
 * Watch Together — recherche de GIFs par le relais du serveur `/api/gifs`
 * (la clé Klipy ne quitte jamais le serveur). Requête vide → tendances,
 * sinon recherche plein texte, après 350 ms sans frappe. Sans plateforme :
 * `tentacleApiFetch` porte le cookie (web) ou le jeton (bureau, mobile).
 */

export interface GifItem {
  id: string;
  /** URL tinygif (~220 px) : aperçu de la grille ET contenu de `wt:gif`. */
  url: string;
  w: number;
  h: number;
}

export interface GifsPayload {
  configured: boolean;
  results: GifItem[];
  /** Klipy en erreur ou injoignable (distinct d'une recherche sans résultat). */
  error?: boolean;
}

/** La locale Klipy d'une langue d'interface. */
export function gifLocaleOf(language: string | undefined): "fr_FR" | "en_US" {
  return language?.toLowerCase().startsWith("fr") ? "fr_FR" : "en_US";
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function useGifSearch(rawQuery: string, language: string | undefined) {
  const query = useDebouncedValue(rawQuery.trim(), 350);
  const locale = gifLocaleOf(language);
  return useQuery({
    queryKey: ["wt-gifs", query, locale],
    queryFn: async (): Promise<GifsPayload> => {
      const path = query
        ? `/api/gifs/search?q=${encodeURIComponent(query)}&locale=${locale}`
        : `/api/gifs/featured?locale=${locale}`;
      // Un serveur d'avant sans la route, ou tout autre refus : comme « non configuré ».
      return tentacleApiFetch<GifsPayload>(path).catch(() => ({ configured: false, results: [] }));
    },
    staleTime: 5 * 60 * 1000,
    // La grille précédente reste affichée pendant la frappe (pas de flash).
    placeholderData: (prev) => prev,
  });
}
