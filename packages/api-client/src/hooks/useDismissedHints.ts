import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  normalizeDismissedHints,
  normalizeHintMarks,
  normalizeKnownHints,
  type DismissedHintMarks,
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

/** Ce que le cache garde : les rappels masqués, leurs marques, et ce que le serveur sait retenir. */
export interface DismissedHintsState {
  dismissed: DismissibleHint[];
  /** La marque retenue au masquage (`serverUpdate` : l'exigence de version d'alors). */
  marks: DismissedHintMarks;
  /** La liste fermée du serveur : « Ne plus afficher » n'est offert que pour elle. */
  known: DismissibleHint[];
}

/** Une réponse du serveur, quelle que soit sa génération (sans marques ni `known` avant). */
export function hintsStateOf(data: DismissedHintsResponse): DismissedHintsState {
  const dismissed = normalizeDismissedHints(data.dismissed);
  const received = normalizeHintMarks(data.marks);
  // Une marque ne vaut que pour un rappel masqué.
  const marks: DismissedHintMarks = {};
  for (const hint of dismissed) {
    const mark = received[hint];
    if (mark) marks[hint] = mark;
  }
  return { dismissed, marks, known: normalizeKnownHints(data.known) };
}

/**
 * La liste du serveur. Un serveur d'avant cette route (404) répond « rien de
 * masqué » et ne sait rien retenir : il ne sait pas non plus diagnostiquer les
 * bandes-annonces, le rappel n'y paraît donc jamais.
 */
export async function fetchDismissedHints(): Promise<DismissedHintsState> {
  try {
    return hintsStateOf(await tentacleApiFetch<DismissedHintsResponse>("/api/preferences/hints"));
  } catch (error) {
    if (error instanceof TentacleApiError && error.status === 404) return { dismissed: [], marks: {}, known: [] };
    throw error;
  }
}

/** L'état après un geste — pur, pour l'optimiste comme pour les tests. */
export function applyHintChange(
  current: DismissedHintsState | undefined,
  hint: DismissibleHint,
  dismissed: boolean,
  mark?: string,
): DismissedHintsState {
  const list = current?.dismissed ?? [];
  const marks: DismissedHintMarks = { ...current?.marks };
  delete marks[hint];
  if (dismissed && mark) marks[hint] = mark;
  return {
    dismissed: normalizeDismissedHints(dismissed ? [...list, hint] : list.filter((entry) => entry !== hint)),
    marks,
    known: current?.known ?? [],
  };
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
  return data ? data.dismissed.includes(hint) : undefined;
}

/**
 * Le masquage de ce rappel : `undefined` tant que la liste n'est pas arrivée,
 * `null` s'il n'est pas masqué, sinon sa marque (`""` : masqué sans marque).
 */
export function useHintDismissal(hint: DismissibleHint, options: { enabled?: boolean } = {}): string | null | undefined {
  const { data } = useDismissedHints(options);
  if (!data) return undefined;
  return data.dismissed.includes(hint) ? data.marks[hint] ?? "" : null;
}

/** Le serveur sait-il retenir ce rappel ? `undefined` tant qu'on ne le sait pas. */
export function useHintSupported(hint: DismissibleHint, options: { enabled?: boolean } = {}): boolean | undefined {
  const { data } = useDismissedHints(options);
  return data ? data.known.includes(hint) : undefined;
}

export interface SetHintDismissedInput {
  hint: DismissibleHint;
  dismissed: boolean;
  /** Ce que le masquage retient — `serverUpdate` : l'exigence en vigueur. */
  mark?: string;
}

/**
 * Masquer ou réafficher un rappel. Optimiste : le rappel s'efface au geste,
 * et revient si le serveur refuse ; la réponse (la liste complète) fait foi.
 */
export function useSetHintDismissed() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: SET_HINT_DISMISSED_KEY,
    mutationFn: ({ hint, dismissed, mark }: SetHintDismissedInput) =>
      tentacleApiFetch<DismissedHintsResponse>(`/api/preferences/hints/${hint}`, {
        method: "PUT",
        body: JSON.stringify(dismissed && mark ? { dismissed, mark } : { dismissed }),
      }),
    onMutate: async ({ hint, dismissed, mark }: SetHintDismissedInput) => {
      await qc.cancelQueries({ queryKey: DISMISSED_HINTS_KEY });
      const previous = qc.getQueryData<DismissedHintsState>(DISMISSED_HINTS_KEY);
      qc.setQueryData<DismissedHintsState>(DISMISSED_HINTS_KEY, applyHintChange(previous, hint, dismissed, mark));
      return { previous };
    },
    onError: (_error: unknown, _input: SetHintDismissedInput, context: { previous?: DismissedHintsState } | undefined) => {
      if (context?.previous) qc.setQueryData(DISMISSED_HINTS_KEY, context.previous);
      else void qc.invalidateQueries({ queryKey: DISMISSED_HINTS_KEY });
    },
    onSuccess: (data: DismissedHintsResponse) => {
      qc.setQueryData<DismissedHintsState>(DISMISSED_HINTS_KEY, hintsStateOf(data));
    },
  });
}
