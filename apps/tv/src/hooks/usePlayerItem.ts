import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient, useMediaItem, useUserId } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import {
  ITEM_FALLBACK_AFTER_MS, isPlayableItem, itemFallbackPlan, needsItemFallback, type ItemFallbackPlan,
} from "@tentacle-tv/tv-core";
import { readServerReachability } from "./serverReachability";
import { fetchItemDirect, hasDirectItemPath } from "../utils/fetchItemDirect";
import { findCachedMediaItem } from "../utils/findCachedMediaItem";
import { tentacleAnswers } from "../utils/streamPathProbe";
import { plog } from "../utils/playerDiag";

const PLAN_LABEL: Record<ItemFallbackPlan, string> = {
  cache: "la fiche en cache",
  direct: "la fiche lue en direct chez Jellyfin",
  none: "aucun recours (mode proxy, rien de jouable en cache)",
};

/**
 * La fiche du lecteur : celle du serveur, comme partout — sa reprise est la
 * plus fraîche. Quand Tentacle ne répond plus, la lecture ne part plus à
 * l'aveugle (règles et mesure : `playerItemFallback`, tv-core) : la fiche du
 * cache si elle est jouable, sinon celle lue en direct chez Jellyfin.
 *
 * On ne s'en mêle que si la fiche TARDE et qu'une sonde dit Tentacle muet —
 * tout de suite s'il est déjà tenu pour hors ligne, ou si la requête a échoué.
 * Le serveur revenu, sa fiche reprend la main : même titre, même source, la
 * lecture ne se rouvre pas.
 *
 * `placeholderItem` : la version en cache, pour l'écran de chargement (titre,
 * affiche) pendant l'attente — jamais pour la lecture elle-même.
 */
export function usePlayerItem(itemId: string): { item: MediaItem | undefined; placeholderItem: MediaItem | null } {
  const query = useMediaItem(itemId);
  const queryClient = useQueryClient();
  const client = useJellyfinClient();
  const userId = useUserId();
  const fetched = query.data;
  const failed = query.isError;
  const [fallback, setFallback] = useState<{ id: string; item: MediaItem } | null>(null);

  const fallbackId = fallback?.id ?? null;
  useEffect(() => {
    // La fiche du serveur est là, ou un recours a déjà trouvé la sienne.
    if (fetched || fallbackId === itemId) return undefined;
    let cancelled = false;
    const run = async () => {
      const silent = failed ? null : !(await tentacleAnswers(client));
      if (cancelled || !needsItemFallback({ hasServerItem: false, serverFailed: failed, tentacleSilent: silent })) return;
      const cached = findCachedMediaItem(queryClient, itemId, isPlayableItem);
      const plan = itemFallbackPlan({ cached, directAvailable: hasDirectItemPath(client) });
      plog("item", `fiche du serveur indisponible → ${PLAN_LABEL[plan]}`);
      const found = plan === "cache" ? cached : plan === "direct" && userId ? await fetchItemDirect(client, userId, itemId) : null;
      if (cancelled || !found) return;
      if (plan === "direct") plog("item", "fiche lue en direct : reprise et pistes retrouvées");
      setFallback({ id: itemId, item: found });
    };
    const soon = failed || !readServerReachability().reachable;
    const timer = setTimeout(() => void run(), soon ? 0 : ITEM_FALLBACK_AFTER_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [fetched, fallbackId, failed, itemId, client, userId, queryClient]);

  const item = fetched ?? (fallback?.id === itemId ? fallback.item : undefined);
  const placeholderItem = useMemo(
    () => (item ? null : findCachedMediaItem(queryClient, itemId)),
    [item, queryClient, itemId],
  );
  return { item, placeholderItem };
}
