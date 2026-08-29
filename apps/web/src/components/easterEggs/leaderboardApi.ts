import { useQuery } from "@tanstack/react-query";
import type { LeaderboardEntry } from "./LeaderboardRow";

export interface Leaderboard {
  source: "playback-reporting" | "estimation";
  estimated: boolean;
  generatedAt: string;
  entries: LeaderboardEntry[];
}

export interface FavoriteSeries {
  seriesId: string;
  name: string;
  episodesPlayed: number;
  playCount: number;
}

/**
 * Import PARESSEUX de `adminUtils`, et c'est structurel : ce module lit
 * `backendUrl` de `main.tsx`, lequel monte l'application. Une importation
 * statique referme la boucle dès qu'un composant monté au démarrage y touche —
 * la page reste alors vide, sans la moindre erreur en console. Le résoudre au
 * moment de l'appel, bien après l'amorçage, coupe le cycle une fois pour toutes.
 */
async function call<T>(path: string): Promise<T> {
  const { BACKEND, hdrs, creds } = await import("../../pages/adminUtils");
  const res = await fetch(`${BACKEND}${path}`, { headers: hdrs(), credentials: creds() });
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<T>;
}

export function useLeaderboard() {
  return useQuery<Leaderboard>({
    queryKey: ["leaderboard"],
    queryFn: () => call<Leaderboard>("/api/leaderboard"),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * Séries les plus regardées d'un compte — chargées SEULEMENT au dépliage
 * (`enabled`). Les calculer pour tout le monde à chaque ouverture exigerait de
 * parcourir les épisodes vus de chaque compte, pour des lignes que personne
 * n'ouvrira.
 */
export function useSeriesFavorites(userId: string, active: boolean) {
  return useQuery<{ userId: string; series: FavoriteSeries[] }>({
    queryKey: ["leaderboard", "top-series", userId],
    queryFn: () => call(`/api/leaderboard/${userId}/top-series`),
    enabled: active,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
