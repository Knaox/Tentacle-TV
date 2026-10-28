/**
 * Octave mobile — l'interface des gestes sur un titre (`OctaveActionsUi`
 * d'api-client) : les mots de l'espace `music`, les avis des pages, le stockage
 * préchargé de l'appareil. Les gestes eux-mêmes sont ceux du bureau.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTrackActions, type OctaveActionsUi, type TrackActions } from "@tentacle-tv/api-client";
import { showNotice } from "./notices";
import { useDeviceStore, useOctavePagesProvider } from "./pagesEnv";
import { usePagesPlayer } from "./pagesPlayer";

export function useMobileActionsUi(): OctaveActionsUi {
  const { t } = useTranslation("music");
  const store = useDeviceStore();
  return useMemo(() => ({ t: t as OctaveActionsUi["t"], notify: showNotice, store }), [t, store]);
}

/** Les gestes sur un titre (cœur, playlists), branchés sur l'extension et le lecteur du mobile. */
export function useMobileTrackActions(): TrackActions {
  return useTrackActions(useOctavePagesProvider(), usePagesPlayer(), useMobileActionsUi());
}
