import { useEffect } from "react";
import type { JellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import type { EnqueueOutcome, OfflineVariantKind } from "@tentacle-tv/offline-core";
import { keepOffline, listOfflineEntries, type OfflineEntry } from "./engineApi";
import { buildKeepItem } from "./keepTargets";

export interface OfflineDevHook {
  /** « Garder hors ligne » un titre, comme le dialogue le ferait (original par défaut). */
  keep: (itemId: string, kind?: OfflineVariantKind) => Promise<EnqueueOutcome>;
  entries: () => OfflineEntry[];
}

type DevGlobal = typeof globalThis & { __tentacleOffline?: OfflineDevHook };

/**
 * Le crochet de DÉVELOPPEMENT du hors ligne : `globalThis.__tentacleOffline`,
 * pilotable depuis l'inspecteur Hermes (Metro, CDP) pour lancer une mise de
 * côté et lire les entrées sans toucher l'écran — les taps injectés au
 * simulateur n'atteignent pas les `Pressable`. Sous `__DEV__` seulement : le
 * bloc disparaît des bundles de production.
 */
export function useOfflineDevHook(client: JellyfinClient, userId: string | null): void {
  useEffect(() => {
    if (!__DEV__ || userId === null) return;
    const scope = globalThis as DevGlobal;
    const hook: OfflineDevHook = {
      keep: async (itemId, kind = "original") => {
        const item = await client.fetch<MediaItem>(`/Users/${userId}/Items/${itemId}?Fields=MediaSources,MediaStreams`);
        const options = { kind, preset: "p720" as const, autoDeleteAfterWatch: false, autoDeleteDelayMinutes: 0 };
        return keepOffline(userId, [buildKeepItem(item, options)]);
      },
      entries: () => listOfflineEntries(userId),
    };
    scope.__tentacleOffline = hook;
    return () => {
      if (scope.__tentacleOffline === hook) delete scope.__tentacleOffline;
    };
  }, [client, userId]);
}
