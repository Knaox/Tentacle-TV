/**
 * Octave — une sortie importée EN ROUTE vers la bibliothèque Jellyfin (`importedLibraryState` → `onTheWay`) : la
 * page la relit toutes les 20 s tant qu'elle est ouverte et visible, pour céder la place à l'album de la
 * bibliothèque dès qu'il existe. Rien d'autre ne relit ; rien du tout sans sortie en route.
 */

import { useEffect } from "react";
import { RELEASE_LIBRARY_POLL_MS } from "@tentacle-tv/api-client";

export function useImportedLibraryWatch(active: boolean, refetch: () => unknown): void {
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") void refetch();
    }, RELEASE_LIBRARY_POLL_MS);
    return () => clearInterval(timer);
  }, [active, refetch]);
}
