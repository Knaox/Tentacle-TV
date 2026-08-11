import { useQuery } from "@tanstack/react-query";
import type { EntreeClassement } from "./LeaderboardRow";

export interface Classement {
  source: "playback-reporting" | "estimation";
  estimated: boolean;
  generatedAt: string;
  entries: EntreeClassement[];
}

export interface SerieFavorite {
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
async function appeler<T>(chemin: string): Promise<T> {
  const { BACKEND, hdrs, creds } = await import("../../pages/adminUtils");
  const res = await fetch(`${BACKEND}${chemin}`, { headers: hdrs(), credentials: creds() });
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<T>;
}

export function useClassement() {
  return useQuery<Classement>({
    queryKey: ["leaderboard"],
    queryFn: () => appeler<Classement>("/api/leaderboard"),
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
export function useSeriesFavorites(userId: string, actif: boolean) {
  return useQuery<{ userId: string; series: SerieFavorite[] }>({
    queryKey: ["leaderboard", "top-series", userId],
    queryFn: () => appeler(`/api/leaderboard/${userId}/top-series`),
    enabled: actif,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
