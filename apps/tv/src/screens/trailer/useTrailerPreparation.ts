import { useEffect } from "react";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { relayedPlaybackOfUrl } from "@tentacle-tv/shared";
import { prepareTrailerStream } from "./resolveTrailerStream";

/**
 * Le temps de se poser sur la fiche avant de préparer : traverser des fiches
 * (retour, saga) ne lance pas une extraction par page.
 */
const PREPARE_DELAY_MS = 300;

/**
 * Apple TV et Android TV : la fiche qui propose une bande-annonce en ligne la fait préparer
 * par le serveur pendant qu'on la lit — extraction, maître, premières listes.
 * Mesuré : une à trois secondes d'extraction que le lancement n'attend plus.
 */
export function useTrailerPreparation(trailerUrl: string | undefined): void {
  const { storage } = useTentacleConfig();
  useEffect(() => {
    const video = relayedPlaybackOfUrl(trailerUrl);
    const serverUrl = (storage.getItem("tentacle_server_url") ?? "").replace(/\/$/, "");
    if (!video || !serverUrl) return;
    const token = storage.getItem("tentacle_token") ?? "";
    const timer = setTimeout(() => prepareTrailerStream(serverUrl, token, video), PREPARE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [trailerUrl, storage]);
}
