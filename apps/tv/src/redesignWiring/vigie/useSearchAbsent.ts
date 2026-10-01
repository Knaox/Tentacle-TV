import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { tentacleApiFetch } from "@tentacle-tv/api-client";
import {
  providerUrl,
  readExternalResponse,
  searchProviders,
  withoutLibraryTwins,
  type ExternalSearchItem,
  type ExternalSearchResult,
} from "@tentacle-tv/shared";
import type { CardModel } from "../../redesign/cards/cardTypes";
import { absentCard, tvPosterUri } from "../cards/absentCards";
import { absentTitle, type AbsentTitle } from "./absentTitle";
import { useAbsentStates } from "./useAbsentStates";
import { useActivePlugins } from "./useActivePlugins";
import type { VigieGate } from "./useVigieGate";

/**
 * L'entrée « recherche » des demandes : les titres que la bibliothèque n'a
 * PAS, trouvés par l'extension qui sait les demander (sa route `search`), en
 * une rangée « À demander » sous les résultats de la bibliothèque — la barre
 * de recherche, rien d'autre. Garde Vigie fermée, ou extension sans
 * recherche : `null`, la recherche reste la bibliothèque seule.
 *
 * Mêmes cartes que les volets absents d'une saga : affiche grisée, badge
 * (`useAbsentStates`), « OK : demander » sous la carte focalisée. La réponse
 * précédente reste affichée pendant la suivante (la colonne entière s'atténue
 * alors) ; une réponse incomplète se relit quelques fois.
 */

const MIN_QUERY = 2;
const LIMIT = 12;
const REFETCH_MS = 450;
const MAX_REFETCHES = 6;

export interface SearchAbsent {
  cards: CardModel[];
  /** Le titre absent derrière une carte de la rangée. */
  titleOf: (cardId: string) => AbsentTitle | undefined;
}

const cardIdOf = (title: AbsentTitle) => `absent:${title.key}`;

export function useSearchAbsent(
  gate: VigieGate | null,
  query: string,
  library: ReadonlyArray<{ name: string; year?: number | null }>,
): SearchAbsent | null {
  const plugins = useActivePlugins();
  const lang = gate?.lang ?? "fr";
  const provider = useMemo(
    () => (gate ? searchProviders(plugins ?? [], lang, "").find((p) => p.pluginId === gate.provider.pluginId) ?? null : null),
    [gate, plugins, lang],
  );
  const q = query.trim();
  const { data } = useQuery<ExternalSearchResult | null>({
    queryKey: ["tv-search-absent", provider?.pluginId ?? "", provider?.path ?? "", q, lang],
    queryFn: async () =>
      provider ? readExternalResponse(await tentacleApiFetch<unknown>(providerUrl(provider, q, { lang, limit: LIMIT, kind: null })), provider) : null,
    enabled: provider !== null && q.length >= MIN_QUERY,
    staleTime: 60_000,
    retry: false,
    keepPreviousData: true,
    refetchInterval: (result, current) =>
      result?.complete === false && current.state.dataUpdateCount < MAX_REFETCHES ? REFETCH_MS : false,
  });

  const shown = provider !== null && q.length >= MIN_QUERY ? data : null;
  const found = useMemo(() => {
    const items = withoutLibraryTwins(shown?.items ?? [], library).filter((item) => item.tmdbId);
    return items.map((item) => ({ item, title: absentTitle(item.kind, item.tmdbId as number, item.title, item.year, item.imageUrl) }));
  }, [shown, library]);
  const keys = useMemo(() => found.map(({ title }) => title.key), [found]);
  const states = useAbsentStates(gate, keys);

  const cards = useMemo<CardModel[]>(() => {
    if (!states) return [];
    return found.map(({ item, title }: { item: ExternalSearchItem; title: AbsentTitle }) => ({
      ...absentCard({ id: cardIdOf(title), title: title.title, year: title.year, posterUri: tvPosterUri(title.imageUrl), absent: states.absentOf(title.key, item.badge) }),
      focusNote: states.hintOf(title.key),
    }));
  }, [found, states]);
  const byId = useMemo(() => new Map(found.map(({ title }) => [cardIdOf(title), title])), [found]);
  const titleOf = useCallback((cardId: string) => byId.get(cardId), [byId]);

  return useMemo(() => (states ? { cards, titleOf } : null), [states, cards, titleOf]);
}
