import { useEffect } from "react";
import { Image } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { getLibraryCatalogKey, prefetchLibraryCatalog, useJellyfinClient, useUserId } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { rememberedFilters } from "../../hooks/libraryCatalogParams";
import { posterUriOf } from "../cards/cardArtwork";
import type { FocusStore } from "../focus/focusStore";
import { gridCatalogParams } from "./gridCatalogParams";

/**
 * Le focus s'arrête sur une bibliothèque, dans la navigation : sa première
 * page part (les paramètres EXACTS de l'écran — `gridCatalogParams`, filtres
 * retenus compris — sans quoi les clés de cache ne se rencontrent pas), puis
 * les affiches de ses deux premières lignes, dans le cache HTTP. OK venu, la
 * grille se dessine de ce qu'elle a déjà : plus d'aller-retour au serveur sur
 * le chemin de l'ouverture.
 *
 * Temporisé : traverser la navigation flèche maintenue ne précharge pas tout
 * le serveur. Rien de retenu en mémoire en dehors du cache de requêtes (la
 * page) et du cache HTTP du système (les affiches, sur disque) : une affiche
 * préchargée n'est pas décodée pour l'écran.
 */

const PREFETCH_DWELL_MS = 300;
/** Deux lignes de six : ce que montre la grille à l'ouverture. */
const PREFETCH_POSTERS = 12;
const LIBRARY_ENTRY = "nav:Library_";

type CatalogPages = { pages?: { Items?: MediaItem[] }[] };

export function useLibraryPrefetch(focus: FocusStore): void {
  const queryClient = useQueryClient();
  const client = useJellyfinClient();
  const userId = useUserId();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const prefetch = async (libraryId: string) => {
      const params = gridCatalogParams(rememberedFilters(libraryId));
      await prefetchLibraryCatalog(queryClient, client, userId, libraryId, params);
      const data = queryClient.getQueryData<CatalogPages>(getLibraryCatalogKey(libraryId, params));
      for (const item of data?.pages?.[0]?.Items?.slice(0, PREFETCH_POSTERS) ?? []) {
        const uri = posterUriOf(client, item);
        if (uri) void Image.prefetch(uri).catch(() => undefined);
      }
    };
    const unsubscribe = focus.subscribe((key, focused) => {
      if (!key.startsWith(LIBRARY_ENTRY)) return;
      if (timer) clearTimeout(timer);
      timer = null;
      if (!focused) return;
      const libraryId = key.slice(LIBRARY_ENTRY.length);
      timer = setTimeout(() => {
        timer = null;
        void prefetch(libraryId).catch(() => undefined);
      }, PREFETCH_DWELL_MS);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [focus, queryClient, client, userId]);
}
