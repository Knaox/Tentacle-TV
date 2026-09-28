import { useMemo } from "react";
import { useRouter } from "expo-router";
import { useCardSheetOpener } from "@/components/cards/sheet/cardSheetContext";
import type { OfflineEntry } from "@/offline/engineApi";
import { localSheetTarget } from "./localSheetTarget";
import { BANNER_ART, ITEM_BANNER_ART, MOVIE_ART, SERIES_ART, resolveLocalArt } from "./offlineArt";
import { useLocalWatchedToggle } from "./useOfflineActions";

export type OpenLocalSheet = (entry: OfflineEntry, variant: "poster" | "landscape", manage?: () => void) => void;

/**
 * L'appui long d'une carte hors ligne : la feuille unique des cartes, en mode
 * local — celle de toutes les cartes du mobile. Les gestes de l'appareil
 * (retirer, transferts, suppression après visionnage) restent à un geste, par
 * « Gérer ». `null` hors de toute portée : la carte garde alors son ancien
 * appui long.
 */
export function useOpenLocalSheet(): OpenLocalSheet | null {
  const openSheet = useCardSheetOpener();
  const router = useRouter();
  const toggleWatched = useLocalWatchedToggle();
  return useMemo(() => {
    if (!openSheet) return null;
    return (entry, variant, manage) => {
      const episode = entry.kind === "episode";
      openSheet(localSheetTarget(entry, variant, {
        setWatched: (played) => toggleWatched([entry.itemId], played),
        play: (itemId) => router.push(`/watch/${itemId}` as never),
        open: (itemId) => router.push(`/on-device/item/${itemId}` as never),
        images: {
          poster: resolveLocalArt(entry.itemId, episode ? SERIES_ART : MOVIE_ART),
          backdrop: resolveLocalArt(entry.itemId, episode ? BANNER_ART : ITEM_BANNER_ART),
        },
        manage,
      }));
    };
  }, [openSheet, router, toggleWatched]);
}
