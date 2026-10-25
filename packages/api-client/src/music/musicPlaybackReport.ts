/**
 * Octave — l'écoute rapportée au serveur (qui la redit à Jellyfin au nom de
 * l'appareil : PlayCount, « Récemment écoutés »). Fonction simple, pour le
 * moteur et la file (pas un crochet) : un rapport perdu ne perd pas la lecture,
 * il ne lève jamais.
 */

import type { MusicPlaybackReport } from "@tentacle-tv/shared/music";
import { TentacleApiError } from "../hooks/usePreferences";
import { reportNetworkSuspect } from "../net/requestPolicy";
import { musicApi } from "./musicApi";

/** Un titre est « écouté » au-delà de 90 % de sa durée (la règle de Jellyfin pour l'audio). */
export const MUSIC_COMPLETED_RATIO = 0.9;

export function isListenCompleted(positionMs: number, durationMs: number | null): boolean {
  return durationMs !== null && durationMs > 0 && positionMs >= durationMs * MUSIC_COMPLETED_RATIO;
}

export async function reportMusicPlayback(report: MusicPlaybackReport): Promise<boolean> {
  try {
    return (await musicApi.playback(report)).ok;
  } catch (error) {
    // Pas de réponse (serveur coupé) ou une passerelle en panne : la sonde de connectivité de l'app doit
    // l'apprendre. Une écoute d'une copie GARDÉE ne fait souvent aucune autre requête : sans ce signal, le
    // passage hors ligne attendait la sonde périodique (jusqu'à 90 s au bureau — recette D8, défaut 2).
    if (!(error instanceof TentacleApiError) || error.status >= 502) reportNetworkSuspect();
    return false;
  }
}
