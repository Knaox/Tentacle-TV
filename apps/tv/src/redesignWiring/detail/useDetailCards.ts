import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useCollectionItems, useSagaResponse, useSagaView, useSimilarItems } from "@tentacle-tv/api-client";
import {
  sagaCollectionIdOf,
  sagaLabel,
  sagaSummary,
  sagaTitle,
  type ExternalSearchItem,
  type MediaItem,
} from "@tentacle-tv/shared";
import type { CardModel } from "../../redesign/cards/cardTypes";
import type { SagaModel } from "../../redesign/screens/detail/detailTypes";
import { useCardModelFactory, useCardModels, type CardModelOptions } from "../cards/cardModels";

/**
 * Les rangées d'affiches de la fiche, sur l'adaptateur des cartes
 * (`useCardModels` : marqueurs du modèle partagé, résolus pour la liste) :
 * - le contenu d'une collection (`useCollectionItems`) ;
 * - la saga d'un film (`useSagaView`) : ses volets de la bibliothèque, et à
 *   leur rang ceux qui manquent — tirés des `parts` de TMDB, le téléviseur
 *   n'ayant pas d'extension : un cadre, un titre, une année, jamais une
 *   fausse affiche ;
 * - les titres similaires (`useSimilarItems`) — ceux de la SÉRIE pour un
 *   épisode, dans sa bibliothèque.
 */

const yearOf = (item: MediaItem) => (item.ProductionYear ? String(item.ProductionYear) : undefined);
const POSTER: CardModelOptions = { variant: "poster", subtitle: yearOf };
const NO_EXTERNAL: ReadonlyArray<{ pluginId: string; items: readonly ExternalSearchItem[] }> = [];

/** Les volets de la saga selon TMDB, sous la forme d'une source hors bibliothèque. */
function useSagaParts(item: MediaItem | undefined, lang: string) {
  const { data: response } = useSagaResponse(sagaCollectionIdOf(item), lang);
  return useMemo(() => {
    const parts = response?.saga?.parts ?? [];
    if (!parts.length) return NO_EXTERNAL;
    const items: ExternalSearchItem[] = parts.map((part) => ({
      id: String(part.tmdbId),
      kind: "movie",
      title: part.title,
      year: part.releaseDate ? Number(part.releaseDate.slice(0, 4)) : null,
      subtitle: null,
      imageUrl: null,
      href: "",
      badge: null,
      tmdbId: part.tmdbId,
    }));
    // `buildSagaView` écarte ceux que la bibliothèque a déjà.
    return [{ pluginId: "tmdb", items }];
  }, [response]);
}

export interface DetailCards {
  collection: CardModel[];
  similar: CardModel[];
  saga: SagaModel | null;
  /** L'item Jellyfin d'une carte : sa feuille d'actions. */
  itemOf: (cardId: string) => MediaItem | undefined;
}

export function useDetailCards(item: MediaItem | undefined, series: MediaItem | undefined): DetailCards {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "fr").slice(0, 2);
  const isEpisode = item?.Type === "Episode";
  const isMovie = item?.Type === "Movie";

  const { data: collectionItems } = useCollectionItems(item?.Type === "BoxSet" ? item.Id : undefined);
  const similarId = isEpisode ? item?.SeriesId ?? item?.Id : item?.Id;
  const { data: similarItems } = useSimilarItems(similarId, isEpisode ? series?.ParentId : item?.ParentId);
  const external = useSagaParts(isMovie ? item : undefined, lang);
  const { view } = useSagaView(isMovie ? item : undefined, { lang, external });

  const collection = useCardModels(collectionItems, POSTER);
  const similar = useCardModels(similarItems, POSTER);
  const factory = useCardModelFactory();
  const saga = useMemo<SagaModel | null>(() => {
    if (!view) return null;
    return {
      title: sagaTitle(t, view),
      summary: sagaSummary(t, view),
      entries: view.entries.map((entry) => {
        const { rank, cue } = sagaLabel(t, entry);
        if (entry.kind === "library") {
          return { key: entry.key, card: factory(entry.item, POSTER), rank, cue, current: entry.cue === "current" };
        }
        const year = entry.item.year ? String(entry.item.year) : undefined;
        return { key: entry.key, missing: { title: entry.item.title, year }, rank, cue };
      }),
    };
  }, [view, t, factory]);

  const byId = useMemo(() => {
    const map = new Map<string, MediaItem>();
    for (const list of [collectionItems, similarItems]) for (const it of list ?? []) map.set(it.Id, it);
    for (const entry of view?.entries ?? []) if (entry.kind === "library") map.set(entry.item.Id, entry.item);
    return map;
  }, [collectionItems, similarItems, view]);
  const itemOf = useCallback((cardId: string) => byId.get(cardId), [byId]);

  return { collection, similar, saga, itemOf };
}
