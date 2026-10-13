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
  /** Abandonne la demande en cours (survol fini avant la réponse). */
  cancel: () => void;
  /** Redemande maintenant (le survol tient après un refus passager). */
  retry: () => void;
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
 */
export function useTrailerPreviewStream(
  subject: TrailerPreviewSubject | null,
  lang: string,
  options: { enabled: boolean },
): TrailerPreviewStreamState {
  const capable = useServerCapability("trailers.preview");
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => trailerPreviewQueryKey(subject, lang), [subject, lang]);
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchTrailerPreviewStream(subject as TrailerPreviewSubject, lang, signal),
    enabled: capable && options.enabled && subject !== null,
    staleTime: (q) => trailerPreviewResultTtl(q.state.data, q.state.dataUpdatedAt),
    gcTime: TRAILER_PREVIEW_GC_MS,
    // Un refus est une réponse ; une panne se retente à la PROCHAINE intention, pas en boucle.
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const cancel = useCallback(() => {
    void queryClient.cancelQueries({ queryKey, exact: true });
  }, [queryClient, queryKey]);
  const { refetch } = query;
  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);
  // La fraîcheur se calcule ICI, depuis l'âge de la réponse : `isStale` de
  // TanStack vaut toujours faux pour une requête DÉSACTIVÉE — or c'est
  // désactivée qu'elle est lue, au rendu même où l'intention l'active.
  const fresh = query.data !== undefined
    && Date.now() < query.dataUpdatedAt + trailerPreviewResultTtl(query.data, query.dataUpdatedAt);
  return { result: query.data, fresh, receivedAt: query.dataUpdatedAt, loading: query.isFetching, capable, cancel, retry };
}
