import { api } from "./api-client";
import { hosts } from "./record";

/**
 * Une doublure de @tanstack/react-query : `useQuery` rend l'état que le
 * scénario pose (`api.query` : `data`, `isFetched`, `isError`) et inscrit ses
 * options (`hosts` « query ») — la trace compare la clé, la fraîcheur, les
 * reprises, et le banc joue la lecture (`queryFn`) quand il veut voir ce
 * qu'elle demande. Rien ne part jamais.
 */

interface QueryOptions {
  queryKey: readonly unknown[];
  queryFn?: () => unknown;
  staleTime?: number;
  retry?: unknown;
  enabled?: boolean;
}

interface QueryState {
  data?: unknown;
  isFetched?: boolean;
  isError?: boolean;
}

export function useQuery(options: QueryOptions) {
  hosts.set("query", options as unknown as Record<string, unknown>);
  const state = (api.query ?? {}) as QueryState;
  const isFetched = state.isFetched === true;
  const isError = state.isError === true;
  return { data: state.data, isFetched, isError, isLoading: !isFetched && !isError };
}
