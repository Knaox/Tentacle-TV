import { useEffect } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { warmMediaFile } from "../lib/mediaWarmup";

/**
 * Précharge le fichier de `item` après `delayMs` — le temps d'une intention :
 * une fiche qu'on lit, un survol qui s'attarde. Voir `lib/mediaWarmup.ts`.
 * Démonté avant, rien n'est demandé.
 */
export function useMediaWarmup(
  item: MediaItem | null | undefined,
  delayMs: number,
  mediaSourceId?: string | null,
): void {
  const client = useJellyfinClient();
  useEffect(() => {
    if (!item) return;
    const timer = window.setTimeout(() => warmMediaFile(client, item, mediaSourceId), delayMs);
    return () => window.clearTimeout(timer);
    // L'identité du titre et de sa source suffit : un nouvel objet pour le
    // même titre (rafraîchissement de la requête) ne relance rien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, item?.Id, mediaSourceId, delayMs]);
}
