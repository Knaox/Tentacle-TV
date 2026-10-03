import { useEffect, useRef, type MutableRefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWatchStopInvalidation } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

interface WatchStopCleanupArgs {
  itemId: string | undefined;
  item: MediaItem | undefined;
  positionRef: MutableRefObject<number>;
  lastStopPromiseRef: { current: Promise<void> };
}

/**
 * La sortie d'une lecture web : la fiche du titre est oubliée (elle se relira
 * à jour), puis l'invalidation « vu / à reprendre » part APRÈS l'arrêt signalé
 * à Jellyfin. Extrait de `WatchWeb` tel quel ; à appeler APRÈS
 * `usePlaybackReporting` — l'ordre des nettoyages en dépend (cf. plus bas).
 */
export function useWatchStopCleanup({ itemId, item, positionRef, lastStopPromiseRef }: WatchStopCleanupArgs): void {
  const queryClient = useQueryClient();
  const runStopInvalidation = useWatchStopInvalidation();
  // Snapshot de l'item lu pour le cleanup, sans le mettre en dépendance de
  // l'effet (sinon le cleanup tournerait à chaque maj UserData de l'item).
  const itemRef = useRef(item);
  itemRef.current = item;

  useEffect(() => {
    return () => {
      const id = itemId;
      const snap = itemRef.current;
      // Lue MAINTENANT : l'effet [itemId] de useWatchSession remet la position
      // à zéro juste après ces cleanups — dans le microtask, elle vaudrait 0.
      const stopPositionSeconds = positionRef.current;
      const stoppedAt = Date.now();
      queryClient.removeQueries({ queryKey: ["item", id] });
      // Cleanups React s'exécutent en ordre inverse d'enregistrement : ce
      // cleanup tourne AVANT celui de usePlaybackReporting qui assigne le vrai
      // stop promise. On défère donc la lecture du ref à un microtask pour
      // chaîner l'invalidation APRÈS le /Sessions/Playing/Stopped (Jellyfin a
      // alors mis à jour Played/DatePlayed → décision « 100% vu » fiable).
      queueMicrotask(() => {
        void runStopInvalidation({
          itemId: id, seriesId: snap?.SeriesId, itemType: snap?.Type,
          stopPositionSeconds, runtimeTicks: snap?.RunTimeTicks,
          stoppedAt, stopped: lastStopPromiseRef.current,
        });
      });
    };
  }, [itemId, queryClient, lastStopPromiseRef, runStopInvalidation, positionRef]);
}
