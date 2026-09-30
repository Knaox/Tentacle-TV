import type { TFunction } from "i18next";
import { i18n, type MediaItem, type SearchMediaItem, type SearchResponse } from "@tentacle-tv/shared";
import type { ArtworkPalette } from "../../../src/redesign/color/artworkPalette";
import type { SearchDiscoverModel, SearchSectionModel } from "../../../src/redesign/screens/search/searchViewModel";
import {
  searchDiscover,
  searchInputLabels,
  searchNotice,
  searchPalette,
  searchSections,
  searchSuggestions,
  type SearchModelSources,
} from "../../../src/redesignWiring/search/searchModels";
import type { BenchData } from "./benchData";
import { cardOf, paletteOf } from "./models";
import { metaOf } from "./screenModels";

/**
 * Les props de la vue « Recherche » au banc : le MÊME modèle que l'écran
 * (`src/redesignWiring/search/searchModels.ts`), nourri par l'instantané —
 * titres complets, images, lumières, filmographies.
 */

const t = ((key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string) as unknown as TFunction;

function sources(data: BenchData): SearchModelSources {
  return {
    t,
    // L'élément complet de l'instantané (images, empreintes), sinon celui du moteur.
    full: (item: SearchMediaItem) => data.item(item.Id) ?? (item as unknown as MediaItem),
    card: (item, subtitle) => cardOf(data, item, subtitle),
    palette: (item) => paletteOf(data, item),
    // Un seul genre : la ligne tient sur une ligne, à côté du logo.
    meta: (item) => metaOf(item, { quality: false, genres: 1 }),
    backdrop: (item) => data.image(item.Id, "Backdrop"),
    logo: (item) => data.image(item.Id, "Logo"),
    portrait: (person) => data.image(person.id, "Primary"),
    creditOf: (personId) => data.items(data.snapshot.credits[personId])[0],
  };
}

export const inputLabels = () => searchInputLabels(t);
export const suggestionsOf = searchSuggestions;
export const noticeOf = (response: SearchResponse | undefined) => searchNotice(t, response);
export const paletteOfResponse = (data: BenchData, response: SearchResponse | undefined): ArtworkPalette =>
  searchPalette(sources(data), response);

/** L'instantané n'a aucune collection : celle d'une réponse construite est une
 *  COPIE d'un titre (son affiche, son propre nom), dite « exemple » sous la carte. */
export function sectionsOf(data: BenchData, response: SearchResponse | undefined, episodes: SearchMediaItem[] = []): SearchSectionModel[] {
  return searchSections(sources(data), response, episodes).map((section) =>
    section.key === "collections"
      ? {
          ...section,
          cards: section.cards.map((card) =>
            data.item(card.id)?.Type === "BoxSet" ? card : { ...card, id: `${card.id}:collection`, subtitle: `${card.subtitle} (exemple)` },
          ),
        }
      : section,
  );
}

/**
 * Les recherches récentes vivent sur l'appareil (`readRecentSearches`) :
 * l'instantané ne les a pas. On en tire d'exemple de ce que le compte a
 * vraiment cherché et regardé : la requête capturée, des séries en cours,
 * une personne de l'instantané.
 */
function recentsOf(data: BenchData): string[] {
  const captured = (data.snapshot.extras?.search as { query?: string } | undefined)?.query;
  const series = data.list("nextUp").map((ep) => ep.SeriesName ?? "").filter(Boolean);
  const person = data.list("people")[0]?.Name;
  return [...new Set([captured, ...series.slice(0, 3), person].filter((q): q is string => !!q))].slice(0, 5);
}

export function discoverOf(data: BenchData, mode: "idle" | "empty", query = ""): SearchDiscoverModel {
  const discover = data.snapshot.extras?.searchDiscover as { genres?: Array<{ name: string; count: number }> } | undefined;
  return searchDiscover(t, mode, query, recentsOf(data), discover?.genres ?? []);
}
