import { useEffect, useSyncExternalStore } from "react";
import { useJellyfinClient } from "./useJellyfinClient";
import { bitrateForItem, bitratePendingFor, subscribeItemBitrate } from "../jellyfin/itemBitrate";
import type { BitrateMeasureOptions } from "../jellyfin/bitrateMeasure";

/**
 * Le titre attend-il sa mesure de débit avant de choisir son flux ? Vrai
 * entre l'arrivée de l'épisode suivant et la fin de sa remesure (au plus
 * `REMEASURE_WAIT_MS`) — le temps que le plafond Auto se décide sur le lien
 * d'AUJOURD'HUI. Le premier titre n'attend jamais (`itemBitrate.ts`).
 *
 * Les lecteurs retiennent leur URL tant que c'est vrai ; ensuite, `cachedBitrate`
 * rend la nouvelle mesure, ou l'ancienne si elle a tardé.
 */
export function useItemBitrateReady(
  itemId: string | undefined,
  enabled: boolean,
  options?: BitrateMeasureOptions,
): { pending: boolean } {
  const client = useJellyfinClient();
  const pending = useSyncExternalStore(
    subscribeItemBitrate,
    () => enabled && !!itemId && bitratePendingFor(itemId),
    () => false,
  );
  useEffect(() => {
    if (enabled && itemId) void bitrateForItem(client, itemId, options);
    // `options` est une constante de plateforme : seul le titre compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, enabled, itemId]);
  return { pending };
}
