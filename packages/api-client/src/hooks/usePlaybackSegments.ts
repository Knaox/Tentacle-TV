/**
 * Les segments RÉSOLUS d'un média — depuis le résolveur unique du backend
 * (`GET /api/playback/segments/:itemId`). Remplace l'ancienne cascade client
 * à quatre sources (`useIntroSkipper`) : plus aucune décision ici.
 *
 * Toute défaillance — serveur 1.13 sans la route (404), réseau, réponse
 * méconnaissable — rend le contrat VIDE, jamais une erreur : un lecteur privé
 * de segments doit lire quand même (dégradation gracieuse, testée côté
 * backend ; le hors ligne desktop, lui, lit le snapshot local).
 */

import { useQuery } from "@tanstack/react-query";
import {
  emptyPlaybackSegments,
  parsePlaybackSegmentsResponse,
  type PlaybackSegmentsResponse,
} from "@tentacle-tv/shared";
import { tentacleApiFetch } from "./usePreferences";

const EMPTY: PlaybackSegmentsResponse = emptyPlaybackSegments("", "");

export function usePlaybackSegments(
  itemId: string | undefined,
  options?: { enabled?: boolean },
): PlaybackSegmentsResponse {
  const on = options?.enabled ?? true;

  const { data } = useQuery({
    queryKey: ["playback-segments", itemId],
    queryFn: async (): Promise<PlaybackSegmentsResponse | null> => {
      try {
        const raw = await tentacleApiFetch<unknown>(`/api/playback/segments/${itemId}`);
        return parsePlaybackSegmentsResponse(raw);
      } catch {
        return null;
      }
    },
    enabled: !!itemId && on,
    staleTime: Infinity,
    retry: false,
  });

  return data ?? EMPTY;
}
