import { useQuery } from "@tanstack/react-query";
import {
  isTitleOrigin,
  myTitlesUrl,
  readMyTitles,
  readTitlesAccess,
  titlesAccessUrl,
  type MyTitle,
  type TitleOrigin,
  type TitleProvider,
  type TitlesAccess,
} from "@tentacle-tv/shared";
import { tentacleApiFetch } from "../hooks/usePreferences";

/**
 * Ce que le compte attend d'une extension de demandes — les routes `access`
 * et `mine` du contrat `titles` (`pluginTitlesMine`, @tentacle-tv/shared).
 * Deux entrées de cache, chacune sa clé, exportée : une demande faite ailleurs
 * (« Demander ») patche (`withMyTitle`) ou invalide `myTitlesQueryKey`, et
 * toute liste des titres attendus se met à jour aussitôt.
 *
 * Les titres attendus d'une ORIGINE seulement (`origin` : « tv », les
 * demandes faites depuis un téléviseur) sont une autre liste, avec sa clé,
 * dans la même famille (`MY_TITLES_KEY`) : `[MY_TITLES_KEY]` les invalide
 * toutes, et la liste entière garde la clé d'avant.
 *
 * Écrits pour TanStack Query v4 ET v5 — la TV est en v4 : des options
 * communes seulement, et un intervalle en NOMBRE, jamais en fonction (sa
 * signature diffère d'une version à l'autre).
 */

/** La famille des titres attendus : `[MY_TITLES_KEY]` les invalide tous. */
export const MY_TITLES_KEY = "titles-mine";

export function titlesAccessQueryKey(provider: TitleProvider | null) {
  return ["titles-access", provider?.pluginId ?? "", provider?.accessPath ?? ""] as const;
}

export function myTitlesQueryKey(provider: TitleProvider | null, lang: string, origin: TitleOrigin | null = null) {
  const base = [MY_TITLES_KEY, provider?.pluginId ?? "", lang] as const;
  return origin ? ([...base, origin] as const) : base;
}

/** L'origine d'une liste des titres attendus, lue sur sa clé ; `null` : la liste entière. */
export function myTitlesKeyOrigin(queryKey: readonly unknown[]): TitleOrigin | null {
  const origin = queryKey[0] === MY_TITLES_KEY ? queryKey[3] : undefined;
  return isTitleOrigin(origin) ? origin : null;
}

/** Le droit du compte ; `null` tant qu'il n'est pas lu, illisible, ou sans route déclarée. */
export function useTitlesAccess(
  provider: TitleProvider | null,
  options?: { enabled?: boolean; staleTimeMs?: number },
): TitlesAccess | null {
  const url = provider ? titlesAccessUrl(provider) : null;
  const { data } = useQuery({
    queryKey: titlesAccessQueryKey(provider),
    queryFn: async () => readTitlesAccess(await tentacleApiFetch(url as string)),
    enabled: url !== null && (options?.enabled ?? true),
    staleTime: options?.staleTimeMs ?? 10 * 60_000,
    retry: 1,
  });
  return data ?? null;
}

export interface MyTitlesOptions {
  enabled?: boolean;
  /** Relire à ce rythme tant que le crochet est monté et actif ; `false` : jamais de lui-même. */
  refetchIntervalMs?: number | false;
  /** Les titres demandés depuis cette origine seulement ; sans elle, tous. */
  origin?: TitleOrigin | null;
}

export interface MyTitlesFeed {
  /** `null` tant qu'ils ne sont pas lus (ou sans route déclarée). */
  titles: MyTitle[] | null;
  /** L'heure de la dernière lecture réussie (ms), 0 avant. */
  updatedAt: number;
  /** Stable d'un rendu à l'autre (méthode liée de l'observateur, v4 comme v5). */
  refetch: () => Promise<unknown>;
}

export function useMyTitles(provider: TitleProvider | null, lang: string, options?: MyTitlesOptions): MyTitlesFeed {
  const origin = options?.origin ?? null;
  const url = provider ? myTitlesUrl(provider, lang, origin) : null;
  const query = useQuery({
    queryKey: myTitlesQueryKey(provider, lang, origin),
    queryFn: async (): Promise<MyTitle[]> => readMyTitles(await tentacleApiFetch(url as string)),
    enabled: url !== null && (options?.enabled ?? true),
    // Plusieurs écrans montent le rail : un remontage proche ne relit rien.
    staleTime: 20_000,
    refetchInterval: options?.refetchIntervalMs ?? false,
    retry: 1,
  });
  return { titles: query.data ?? null, updatedAt: query.dataUpdatedAt, refetch: query.refetch };
}
