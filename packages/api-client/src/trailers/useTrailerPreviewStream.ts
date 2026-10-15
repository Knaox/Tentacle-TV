import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { TrailerPreviewSubject } from "@tentacle-tv/shared";
import { useServerCapability } from "../hooks/useServerCapabilities";
import {
  fetchTrailerPreviewStream,
  trailerPreviewQueryKey,
  trailerPreviewResultTtl,
  type TrailerPreviewStreamResult,
} from "./trailerPreviewStream";

/** Une réponse gardée au plus une heure après le dernier survol qui l'a lue (un refus vaut une heure). */
const TRAILER_PREVIEW_GC_MS = 60 * 60_000;
/** La même garde pour TanStack Query v4 (les téléviseurs), qui ne lit pas `gcTime`. */
const V4_CACHE_TIME: object = { cacheTime: TRAILER_PREVIEW_GC_MS };

export interface TrailerPreviewStreamState {
  /** La réponse, refus compris ; `undefined` tant qu'aucune n'est venue. */
  result: TrailerPreviewStreamResult | undefined;
  /**
   * La réponse est encore valable (jeton du relais pas échu, refus encore
   * tenu par le serveur). Périmée, elle se renouvelle à l'activation suivante :
   * l'appelant attend la nouvelle au lieu de lire l'ancienne.
   */
  fresh: boolean;
  /** L'instant (ms) de la réponse : une nouvelle demande se reconnaît à un instant plus récent. */
  receivedAt: number;
  /** Une demande est en vol. */
  loading: boolean;
  /** Le serveur déclare `trailers.preview` : sans elle, rien n'est jamais demandé. */
  capable: boolean;
  /** Redemande maintenant (le survol tient après un refus passager) — jamais une seconde demande en vol. */
  retry: () => void;
  /**
   * Oublie la réponse gardée : la vidéo qu'elle désignait a lâché (un jeton du
   * relais mort avec un redémarrage du serveur, une vidéo que le relais a
   * oubliée…) — la prochaine activation redemande au serveur.
   */
  forget: () => void;
}

/**
 * La bande-annonce d'aperçu d'un titre — une requête TanStack
 * (`["trailer-preview", sujet, langue]`), qui ne part QUE quand l'appelant
 * l'active (l'intention de survol), jamais au montage d'une carte.
 *
 * Gardée par la capacité `trailers.preview` : un serveur qui ne la déclare
 * pas ne reçoit aucune requête, et rien ne s'affiche — sans erreur. Un refus
 * (404, 429…) est une réponse, gardée autant que le serveur garde sa décision,
 * jamais relancée ; une bande-annonce trouvée l'est jusqu'à l'échéance de son
 * jeton.
 *
 * Une demande partie VA AU BOUT, même si le survol cesse avant la réponse :
 * le serveur la mène de toute façon à son terme (décision, extraction), et sa
 * réponse, gardée, sert le survol suivant sans rien redemander. L'abandonner,
 * c'était la jeter et la refaire au retour sur la carte. Rien ne lit donc le
 * signal d'abandon de TanStack (qui couperait la requête au démontage de la
 * dernière carte qui l'attend) ; seul le délai propre de la demande
 * (`fetchTimeoutMs`) l'arrête.
 *
 * ⚠️ Les téléviseurs (`apps/tv`) résolvent TanStack Query v4 au runtime, typés
 * v5 : la fraîcheur est un NOMBRE (v4 ne sait pas appeler un `staleTime`
 * fonction — il l'ajoutait à une date, et toute réponse était périmée), lu
 * sur la réponse gardée, et la garde de l'entrée se dit aux deux (`gcTime`
 * v5, `cacheTime` v4).
 */
export function useTrailerPreviewStream(
  subject: TrailerPreviewSubject | null,
  lang: string,
  options: { enabled: boolean },
): TrailerPreviewStreamState {
  const capable = useServerCapability("trailers.preview");
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => trailerPreviewQueryKey(subject, lang), [subject, lang]);
  // La fraîcheur de la réponse gardée, en durée depuis son arrivée — ce que
  // `staleTime` mesure lui aussi depuis `dataUpdatedAt`.
  const cached = queryClient.getQueryState<TrailerPreviewStreamResult>(queryKey);
  const staleTime = trailerPreviewResultTtl(cached?.data, cached?.dataUpdatedAt ?? 0);
  const query = useQuery({
    queryKey,
    queryFn: () => fetchTrailerPreviewStream(subject as TrailerPreviewSubject, lang),
    enabled: capable && options.enabled && subject !== null,
    staleTime,
    gcTime: TRAILER_PREVIEW_GC_MS,
    ...V4_CACHE_TIME,
    // Un refus est une réponse ; une panne se retente à la PROCHAINE intention, pas en boucle.
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const { refetch } = query;
  // Une demande déjà en vol pour ce titre (une autre carte du même titre) est
  // REJOINTE, jamais doublée : `cancelRefetch` la couperait pour en refaire une.
  const retry = useCallback(() => {
    void refetch({ cancelRefetch: false });
  }, [refetch]);
  const forget = useCallback(() => {
    queryClient.removeQueries({ queryKey, exact: true });
  }, [queryClient, queryKey]);
  // La fraîcheur se calcule ICI, depuis l'âge de la réponse : `isStale` de
  // TanStack vaut toujours faux pour une requête DÉSACTIVÉE — or c'est
  // désactivée qu'elle est lue, au rendu même où l'intention l'active.
  const fresh = query.data !== undefined
    && Date.now() < query.dataUpdatedAt + trailerPreviewResultTtl(query.data, query.dataUpdatedAt);
  return { result: query.data, fresh, receivedAt: query.dataUpdatedAt, loading: query.isFetching, capable, retry, forget };
}
