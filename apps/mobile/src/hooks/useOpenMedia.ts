import { useCallback } from "react";
import { useRouter } from "expo-router";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Ouvrir la fiche d'un titre — une fonction STABLE, que les cartes
 * mémoïsées (`MobileMediaCard`) reçoivent telle quelle : une fermeture par
 * carte les ferait toutes re-rendre à chaque rendu de leur liste.
 */
export function useOpenMedia(): (item: MediaItem) => void {
  const router = useRouter();
  return useCallback((item: MediaItem) => {
    router.push(`/media/${item.Id}`);
  }, [router]);
}
