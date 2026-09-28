/**
 * La synthèse de l'écran de gestion, tenue à jour EN DIRECT : la barre globale
 * suit le magasin de progression, comme celles des lignes.
 *
 * Le magasin émet à chaque échantillon de n'importe quel transfert ; la vue
 * n'est recalculée que si l'avancement global a bougé d'un millième, pour ne
 * pas repeindre l'en-tête deux fois par seconde et par fichier pour rien.
 */

import { useMemo, useSyncExternalStore } from "react";
import { summarizeOffline, type OfflineOverview, type OverviewEntry } from "../catalog/offlineOverview";
import { getProgressFor, subscribeProgress } from "./progressStore";

export function useOfflineOverview(entries: readonly OverviewEntry[]): OfflineOverview {
  // Clé primitive : `useSyncExternalStore` compare par identité.
  const liveKey = useSyncExternalStore(
    subscribeProgress,
    () => liveProgressKey(entries),
    () => liveProgressKey(entries),
  );
  return useMemo(
    () => summarizeOffline(entries, getProgressFor),
    // `liveKey` EST la dépendance au magasin : il change quand la barre bouge.
    [entries, liveKey],
  );
}

function liveProgressKey(entries: readonly OverviewEntry[]): string {
  const overview = summarizeOffline(entries, getProgressFor);
  return overview.transferRatio === null ? "none" : String(Math.round(overview.transferRatio * 1000));
}
