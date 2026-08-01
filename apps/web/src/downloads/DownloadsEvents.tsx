/**
 * Pont événements Tauri → UI : `downloads://changed` invalide les requêtes
 * d'état (listes, badges, espace) ; `downloads://progress` alimente le store
 * de progression (sans passer par TanStack — trop fréquent). Monté UNE fois
 * dans App, desktop uniquement. Ne rend rien.
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supportsDownloads } from "../desktop/bridge";
import { onDownloadsChanged, onDownloadsProgress } from "./api";
import { updateProgress } from "./progressStore";
import {
  DOWNLOADS_LIST_QUERY_KEY,
  DOWNLOAD_STATE_QUERY_KEY,
  DISK_INFO_QUERY_KEY,
} from "./useDownloadState";

export function DownloadsEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!supportsDownloads()) return;
    let disposed = false;
    const unsubs: Array<() => void> = [];

    void onDownloadsChanged(() => {
      queryClient.invalidateQueries({ queryKey: [DOWNLOADS_LIST_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [DOWNLOAD_STATE_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [DISK_INFO_QUERY_KEY] });
    }).then((unsub) => {
      if (disposed) unsub();
      else unsubs.push(unsub);
    });

    void onDownloadsProgress((event) => {
      updateProgress(event.fileId, {
        bytesDone: event.bytesDone,
        expectedSize: event.expectedSize,
      });
    }).then((unsub) => {
      if (disposed) unsub();
      else unsubs.push(unsub);
    });

    return () => {
      disposed = true;
      for (const unsub of unsubs) unsub();
    };
  }, [queryClient]);

  return null;
}
