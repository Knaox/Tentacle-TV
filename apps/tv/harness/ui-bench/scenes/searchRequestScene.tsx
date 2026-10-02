import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SearchResponse } from "@tentacle-tv/shared";
import type { CardModel } from "../../../src/redesign/cards/cardTypes";
import type { ArtworkPalette } from "../../../src/redesign/color/artworkPalette";
import { SearchView } from "../../../src/redesign/screens/search/SearchView";
import type { SearchSectionModel } from "../../../src/redesign/screens/search/searchViewModel";
import type { BenchData } from "../data/benchData";
import { t } from "../data/absentModels";
import { navOf } from "../data/screenModels";
import { inputLabels, noticeOf, paletteOfResponse, sectionsOf, suggestionsOf } from "../data/searchModels";

/**
 * Une recherche dont la colonne finit par la rangée « À demander » — le même
 * ajout que le câblage (`useSearchResults` : la section `absent` après celles
 * de la bibliothèque, son compte comme les autres).
 */
export function SearchRequestScene({ data, query, response, absent }: {
  data: BenchData;
  query: string;
  response: SearchResponse;
  absent: CardModel[];
}) {
  const { i18n: live } = useTranslation();
  const sections = useMemo<SearchSectionModel[]>(() => {
    const found = sectionsOf(data, response);
    if (absent.length === 0) return found;
    return [...found, { key: "absent", title: t("requests:searchRow"), count: t("search:countTitles", { count: absent.length }), cards: absent }];
  }, [data, response, absent, live.language]); // eslint-disable-line react-hooks/exhaustive-deps
  const { completion, suggestions } = useMemo(() => suggestionsOf(query, response), [query, response]);
  const [focused, setFocused] = useState<ArtworkPalette | null>(null);
  const onFocusCard = useCallback((_section: string, card: CardModel) => card.palette && setFocused(card.palette), []);
  return (
    <SearchView
      nav={navOf(data, "Search")}
      query={query}
      completion={completion}
      suggestions={suggestions}
      content={{ kind: "results", notice: noticeOf(response), stale: false, sections }}
      labels={inputLabels()}
      dictation="system"
      palette={focused ?? paletteOfResponse(data, response)}
      onFocusCard={onFocusCard}
      onLongPressCard={() => undefined}
    />
  );
}
