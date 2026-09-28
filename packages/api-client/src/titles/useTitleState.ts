import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  parseTitleKey,
  readTitleRequestOutcome,
  titleRequestUrl,
  type TitleKey,
  type TitleProvider,
  type TitleRequestOutcome,
  type TitleState,
} from "@tentacle-tv/shared";
import { tentacleApiFetch } from "../hooks/usePreferences";
import { loadTitleState } from "./titleStateBatcher";

/**
 * Ce que l'extension de demandes dit d'un titre hors bibliothèque — sa
 * pastille (« Demandé »…) et le geste qu'elle offre (« Demander »). Une entrée
 * de cache PAR titre : les cartes d'une rangée partent dans une seule requête
 * (`loadTitleState`), mais une demande ne re-rend que la carte concernée.
 */

export function titleStateQueryKey(provider: TitleProvider | null, lang: string, key: TitleKey | null) {
  return ["title-state", provider?.pluginId ?? "", lang, key ?? ""] as const;
}

/** `null` : pas de source, pas de clé, ou rien à dire de ce titre. */
export function useTitleState(
  provider: TitleProvider | null,
  key: TitleKey | null,
  lang: string,
  options?: { enabled?: boolean },
): TitleState | null {
  const { data } = useQuery({
    queryKey: titleStateQueryKey(provider, lang, key),
    queryFn: () => loadTitleState(provider as TitleProvider, key as TitleKey, lang, (url) => tentacleApiFetch(url)),
    enabled: !!provider && !!key && (options?.enabled ?? true),
    // Ce qui change l'état (une demande) passe par ici et le réécrit ; le reste
    // (une approbation, une arrivée) peut attendre la minute.
    staleTime: 60_000,
    retry: 1,
  });
  return data ?? null;
}

/**
 * Le geste « demander » : le plugin le fait sur place (un film), ou désigne sa
 * page pour un choix (les saisons d'une série) — à l'appelant de naviguer.
 * L'état qu'il rend remplace aussitôt celui de la carte.
 */
export function useRequestTitle(provider: TitleProvider | null, lang: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: TitleKey): Promise<TitleRequestOutcome> => {
      const url = provider ? titleRequestUrl(provider) : null;
      const parsed = parseTitleKey(key);
      if (!url || !parsed) throw new Error("Aucune extension ne sait demander ce titre");
      const outcome = readTitleRequestOutcome(
        await tentacleApiFetch(url, { method: "POST", body: JSON.stringify({ ...parsed, lang }) }),
      );
      if (!outcome) throw new Error("Réponse illisible de l'extension");
      return outcome;
    },
    onSuccess: (outcome, key) => {
      const queryKey = titleStateQueryKey(provider, lang, key);
      if (outcome.kind === "done" && outcome.state) qc.setQueryData(queryKey, outcome.state);
      else if (outcome.kind === "done") void qc.invalidateQueries({ queryKey });
    },
  });
}
