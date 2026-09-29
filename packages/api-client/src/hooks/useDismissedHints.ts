import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  normalizeDismissedHints,
  type DismissedHintsResponse,
  type DismissibleHint,
} from "@tentacle-tv/shared";
import { TentacleApiError, tentacleApiFetch } from "./usePreferences";

/**
 * Les rappels que le compte a masqués pour de bon (`/api/preferences/hints`).
 * La clé est la portée diffusée en direct (`preferences:update` → `hints`) :
 * masqué sur un appareil, un rappel quitte les autres sans rechargement. Même
 * écriture pour le web, le miroir, le mobile et les téléviseurs (API commune
 * react-query v4 / v5 seulement : la TV tourne en v4).
 */
export const DISMISSED_HINTS_KEY = ["hints"] as const;
/** Préfixé par la portée : une sauvegarde en vol suspend la relecture en direct (cf. usePreferencesLive). */
export const SET_HINT_DISMISSED_KEY = ["hints", "save"] as const;

const DISMISSED_HINTS_STALE_TIME = 5 * 60_000;

/**
 * La liste du serveur. Un serveur d'avant cette route (404) répond « rien de
 * masqué » : il ne sait pas non plus diagnostiquer les bandes-annonces, le
 * rappel n'y paraît donc jamais.
 */
export async function fetchDismissedHints(): Promise<DismissibleHint[]> {
  try {
    const data = await tentacleApiFetch<DismissedHintsResponse>("/api/preferences/hints");
    return normalizeDismissedHints(data.dismissed);
  } catch (error) {
    if (error instanceof TentacleApiError && error.status === 404) return [];
    throw error;
  }
}

/** La liste après un geste — pure, pour l'optimiste comme pour les tests. */
export function applyHintChange(
  current: readonly DismissibleHint[] | undefined,
  hint: DismissibleHint,
  dismissed: boolean,
): DismissibleHint[] {
  const list = current ?? [];
  return normalizeDismissedHints(dismissed ? [...list, hint] : list.filter((entry) => entry !== hint));
}

export function useDismissedHints(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: DISMISSED_HINTS_KEY,
    queryFn: fetchDismissedHints,
    enabled: options.enabled ?? true,
    staleTime: DISMISSED_HINTS_STALE_TIME,
  });
}

/**
 * Ce rappel est-il masqué ? `undefined` tant que la liste n'est pas arrivée —
 * et, faute de réponse, on ne montre rien : un rappel qui paraît puis
 * disparaît aussitôt serait pire que pas de rappel.
 */
export function useIsHintDismissed(hint: DismissibleHint, options: { enabled?: boolean } = {}): boolean | undefined {
  const { data } = useDismissedHints(options);
  return data ? data.includes(hint) : undefined;
}

export interface SetHintDismissedInput {
  hint: DismissibleHint;
  dismissed: boolean;
}

/**
 * Masquer ou réafficher un rappel. Optimiste : le rappel s'efface au geste,
 * et revient si le serveur refuse ; la réponse (la liste complète) fait foi.
 */
export function useSetHintDismissed() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: SET_HINT_DISMISSED_KEY,
    mutationFn: ({ hint, dismissed }: SetHintDismissedInput) =>
      tentacleApiFetch<DismissedHintsResponse>(`/api/preferences/hints/${hint}`, {
        method: "PUT",
        body: JSON.stringify({ dismissed }),
      }),
    onMutate: async ({ hint, dismissed }: SetHintDismissedInput) => {
      await qc.cancelQueries({ queryKey: DISMISSED_HINTS_KEY });
      const previous = qc.getQueryData<DismissibleHint[]>(DISMISSED_HINTS_KEY);
      qc.setQueryData<DismissibleHint[]>(DISMISSED_HINTS_KEY, applyHintChange(previous, hint, dismissed));
      return { previous };
    },
    onError: (_error: unknown, _input: SetHintDismissedInput, context: { previous?: DismissibleHint[] } | undefined) => {
      if (context?.previous) qc.setQueryData(DISMISSED_HINTS_KEY, context.previous);
      else void qc.invalidateQueries({ queryKey: DISMISSED_HINTS_KEY });
    },
    onSuccess: (data: DismissedHintsResponse) => {
      qc.setQueryData<DismissibleHint[]>(DISMISSED_HINTS_KEY, normalizeDismissedHints(data.dismissed));
    },
  });
}
