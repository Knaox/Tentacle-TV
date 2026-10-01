import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  parseTitleKey,
  readTitleRequestOutcome,
  readTitleSeasons,
  titleRequestUrl,
  titleSeasonsUrl,
  type TitleKey,
  type TitleProvider,
  type TitleRequestOutcome,
  type TitleSeasonsAnswer,
} from "@tentacle-tv/shared";
import { tentacleApiFetch } from "../hooks/usePreferences";
import { titleStateQueryKey } from "./useTitleState";

/**
 * Les saisons d'une série chez l'extension de demandes, pour un client qui
 * les choisit lui-même (route `seasons` du contrat `titles`,
 * `pluginTitleSeasons.ts`) — et la demande de celles qu'on a cochées.
 *
 * Écrits pour TanStack Query v4 ET v5 — la TV est en v4 : des options
 * communes seulement.
 */

export function titleSeasonsQueryKey(provider: TitleProvider | null, lang: string, key: TitleKey | null) {
  return ["title-seasons", provider?.pluginId ?? "", lang, key ?? ""] as const;
}

export interface TitleSeasonsFeed {
  /** `null` tant que la réponse n'est pas là (ou sans route déclarée). */
  answer: TitleSeasonsAnswer | null;
  /** La lecture a échoué (réseau, serveur) — l'extension n'a rien pu dire. */
  failed: boolean;
}

export function useTitleSeasons(
  provider: TitleProvider | null,
  key: TitleKey | null,
  lang: string,
  options?: { enabled?: boolean },
): TitleSeasonsFeed {
  const url = provider && key ? titleSeasonsUrl(provider, key, lang) : null;
  const query = useQuery({
    queryKey: titleSeasonsQueryKey(provider, lang, key),
    queryFn: async () => readTitleSeasons(await tentacleApiFetch(url as string)),
    enabled: url !== null && (options?.enabled ?? true),
    // Une feuille qui s'ouvre relit : une saison a pu arriver ou être demandée.
    staleTime: 0,
    retry: 1,
  });
  return { answer: query.data ?? null, failed: query.isError };
}

/**
 * Demander des saisons cochées : la même route que tout geste « demander »,
 * avec `seasons`. L'état que rend l'extension remplace celui de la carte ; les
 * saisons de la série se relisent.
 */
export function useRequestTitleSeasons(provider: TitleProvider | null, lang: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, seasons }: { key: TitleKey; seasons: number[] }): Promise<TitleRequestOutcome> => {
      const url = provider ? titleRequestUrl(provider) : null;
      const parsed = parseTitleKey(key);
      if (!url || parsed?.mediaType !== "tv" || seasons.length === 0) throw new Error("Aucune saison à demander");
      const outcome = readTitleRequestOutcome(
        await tentacleApiFetch(url, { method: "POST", body: JSON.stringify({ ...parsed, lang, seasons }) }),
      );
      if (!outcome) throw new Error("Réponse illisible de l'extension");
      return outcome;
    },
    onSuccess: (outcome, { key }) => {
      const stateKey = titleStateQueryKey(provider, lang, key);
      if (outcome.kind === "done" && outcome.state) qc.setQueryData(stateKey, outcome.state);
      else void qc.invalidateQueries({ queryKey: stateKey });
      void qc.invalidateQueries({ queryKey: titleSeasonsQueryKey(provider, lang, key) });
    },
  });
}
