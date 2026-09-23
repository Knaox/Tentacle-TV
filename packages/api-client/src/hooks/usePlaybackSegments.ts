/**
 * Les segments RÉSOLUS d'un média — depuis le résolveur unique du backend
 * (`GET /api/playback/segments/:itemId`). Remplace l'ancienne cascade client
 * à quatre sources (`useIntroSkipper`) : plus aucune décision ici.
 *
 * Toute défaillance — serveur 1.13 sans la route (404), réseau, réponse
 * méconnaissable — rend le contrat VIDE, jamais une erreur : un lecteur privé
 * de segments doit lire quand même (dégradation gracieuse, testée côté
 * backend ; le hors ligne desktop, lui, lit le snapshot local).
 *
 * Une seule exception au `staleTime: Infinity` : quand le serveur annonce qu'il
 * analyse les vignettes du média (`analysisPending`), le contrat est encore
 * incomplet et on le redemande. Un serveur plus ancien ne pose jamais ce
 * drapeau — le comportement d'avant est donc intact.
 */

import { useQuery } from "@tanstack/react-query";
import {
  emptyPlaybackSegments,
  parsePlaybackSegmentsResponse,
  type PlaybackSegmentsResponse,
} from "@tentacle-tv/shared";
import { tentacleApiFetch } from "./usePreferences";

const EMPTY: PlaybackSegmentsResponse = emptyPlaybackSegments("", "");

/** Cadence de relance tant que le serveur analyse les vignettes d'un média. */
const ANALYSIS_POLL_MS = 10_000;

/**
 * La cadence de relance, sous les DEUX signatures. v5 appelle
 * `refetchInterval(query)`, v4 (la TV, au runtime) appelle
 * `refetchInterval(data, query)` : on reconnaît la query à son `state` OBJET —
 * le contrat de segments n'a pas de champ `state`, c'est le discriminant.
 * Exportée pour être testée sous les deux formes (même motif que
 * `recoPagePollInterval`). Sans ça, la TV lit `undefined.state` et le rendu du
 * lecteur meurt AVANT la première image.
 */
export function segmentsPollInterval(...args: unknown[]): number | false {
  const first = args[0] as { state?: unknown } | undefined;
  const contract =
    first && typeof first.state === "object" && first.state !== null
      ? (first.state as { data?: PlaybackSegmentsResponse | null }).data
      : (first as PlaybackSegmentsResponse | null | undefined);
  return contract?.analysisPending === true ? ANALYSIS_POLL_MS : false;
}

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
    // Une analyse des vignettes tourne côté serveur : on redemande le contrat
    // de loin en loin, jusqu'à ce qu'il cesse de le dire. Elle prend moins
    // d'une seconde, mais elle peut attendre son tour derrière un autre média —
    // et de toute façon le générique n'arrive qu'à la fin, on a le temps.
    refetchInterval: (...args: unknown[]) => segmentsPollInterval(...args),
    refetchIntervalInBackground: false,
  });

  return data ?? EMPTY;
}
