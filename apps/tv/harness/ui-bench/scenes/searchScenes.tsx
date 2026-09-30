import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { i18n, type MediaItem, type SearchMediaItem, type SearchResponse } from "@tentacle-tv/shared";
import type { CardModel } from "../../../src/redesign/cards/cardTypes";
import { NEUTRAL_PALETTE, type ArtworkPalette } from "../../../src/redesign/color/artworkPalette";
import { useForcedFocusKey } from "../../../src/redesign/focus/focusPreview";
import { SearchView } from "../../../src/redesign/screens/search/SearchView";
import type { SearchContentModel, SearchSectionModel } from "../../../src/redesign/screens/search/searchViewModel";
import type { BenchData } from "../data/benchData";
import { navOf } from "../data/screenModels";
import { discoverOf, inputLabels, noticeOf, paletteOfResponse, sectionsOf, suggestionsOf } from "../data/searchModels";
import { capturedResponse, catalogTitles, searchEpisodes, searchResponse } from "../data/searchResponses";
import type { BenchScene } from "./types";

/**
 * La recherche, sur les vrais titres du compte : la vraie réponse capturée
 * (« Orgueil ») et des réponses construites en filtrant les titres réels
 * (`searchResponses.ts`) — une recherche par titre (« knight »), par studio
 * (« marvel »), par personne (« keira »), partielle, en cours de frappe.
 * Les états que le compte n'a pas (correction, index en préparation,
 * réponse périmée, collection) sont des COPIES des vraies réponses, dites
 * « exemple » dans le catalogue.
 */

type Variant =
  | "idle" | "typing" | "loading" | "captured" | "full" | "studio" | "person"
  | "correction" | "partial" | "indexing" | "stale" | "none" | "android";

interface SceneInput {
  query: string;
  response?: SearchResponse;
  episodes?: SearchMediaItem[];
  content: "idle" | "empty" | "loading" | "results";
  stale?: boolean;
}

const byName = (data: BenchData, name: string): MediaItem | undefined =>
  catalogTitles(data).find((item) => item.Name === name);

function inputOf(data: BenchData, variant: Variant): SceneInput {
  const captured = capturedResponse(data) ?? undefined;
  switch (variant) {
    case "idle":
      return { query: "", content: "idle" };
    case "typing":
    case "android": {
      const source = byName(data, "Spider-Man : No Way Home");
      const response = searchResponse(data, "spi", source ? { exampleCollection: { source, name: "Spider-Man — La collection", count: 5 } } : {});
      return { query: "spi", response, episodes: searchEpisodes(data, "spi"), content: "results" };
    }
    case "loading":
      return { query: "marvel", content: "loading" };
    case "captured":
      return { query: captured?.query ?? "Orgueil", response: captured, content: "results" };
    case "full": {
      const source = byName(data, "The Dark Knight : Le Chevalier noir");
      const response = searchResponse(data, "knight", source ? { exampleCollection: { source, name: "The Dark Knight — Trilogie", count: 3 } } : {});
      return { query: "knight", response, episodes: searchEpisodes(data, "knight"), content: "results" };
    }
    case "studio":
      return { query: "marvel", response: searchResponse(data, "marvel"), episodes: searchEpisodes(data, "marvel"), content: "results" };
    case "person":
      return { query: "keira", response: searchResponse(data, "keira"), content: "results" };
    case "correction":
      return { query: "orgeuil", response: captured && { ...captured, query: "orgeuil", correction: "orgueil" }, content: "results" };
    case "partial":
      return {
        query: "dragon chevalier",
        response: searchResponse(data, "dragon chevalier", { partial: true }),
        episodes: searchEpisodes(data, "dragon chevalier", true),
        content: "results",
      };
    case "indexing":
      return { query: captured?.query ?? "Orgueil", response: captured && { ...captured, ready: false }, content: "results" };
    case "stale":
      return { query: "marvel s", response: searchResponse(data, "marvel"), episodes: searchEpisodes(data, "marvel"), content: "results", stale: true };
    case "none":
      return { query: "xqzw", content: "empty" };
  }
}

/** La carte focalisée, figée ou native : c'est elle qui teinte le fond. */
function forcedPalette(sections: SearchSectionModel[], forced: string | null): ArtworkPalette | null {
  if (!forced) return null;
  const [key, index] = forced.split(":");
  const section = sections.find((s) => s.key === key);
  if (section && "cards" in section) return section.cards[Number(index)]?.palette ?? null;
  return null;
}

function modelOf(data: BenchData, input: SceneInput, lang: string) {
  const { completion, suggestions } = suggestionsOf(input.query, input.response);
  const sections = sectionsOf(data, input.response, input.episodes ?? []);
  let content: SearchContentModel;
  if (input.content === "results") content = { kind: "results", notice: noticeOf(input.response), stale: input.stale === true, sections };
  else if (input.content === "loading") content = { kind: "loading", label: i18n.t("search:searching") };
  else content = { kind: input.content, discover: discoverOf(data, input.content, input.query) };
  return { lang, completion, suggestions, sections, content, labels: inputLabels(), nav: navOf(data, "Search") };
}

function SearchScene({ data, variant }: { data: BenchData; variant: Variant }) {
  // La langue du banc : les textes se retraduisent quand elle change.
  const { i18n: i18next } = useTranslation();
  const lang = i18next.language;
  const input = useMemo(() => inputOf(data, variant), [data, variant]);
  const model = useMemo(() => modelOf(data, input, lang), [data, input, lang]);
  const [focusedPalette, setFocusedPalette] = useState<ArtworkPalette | null>(null);
  const forced = useForcedFocusKey();
  const onFocusCard = useCallback((_section: string, card: CardModel) => card.palette && setFocusedPalette(card.palette), []);
  const palette =
    forcedPalette(model.sections, forced) ??
    (forced ? null : focusedPalette) ??
    (input.response && input.content === "results" ? paletteOfResponse(data, input.response) : NEUTRAL_PALETTE);
  return (
    <SearchView
      nav={model.nav}
      query={input.query}
      completion={model.completion}
      suggestions={model.suggestions}
      content={model.content}
      labels={model.labels}
      dictation={variant === "android" ? "key" : "system"}
      listening={variant === "android"}
      palette={palette}
      onFocusCard={onFocusCard}
    />
  );
}

const scene = (id: string, label: string, variant: Variant, focusKeys: string[]): BenchScene => ({
  id: `recherche/${id}`,
  group: "Recherche",
  label,
  focusKeys,
  settleMs: 1600,
  render: (data) => <SearchScene data={data} variant={variant} />,
});

export const SEARCH_SCENES: BenchScene[] = [
  scene("repos", "Repos (recherches récentes : exemple)", "idle", ["key:A", "search:field", "recent:0", "genre:0", "key:space"]),
  scene("saisie", "Saisie « spi » et suggestions (collection : exemple)", "typing", ["key:I", "suggestion:0", "suggestion:1", "top", "movies:0"]),
  scene("chargement", "Chargement", "loading", ["key:L"]),
  scene("resultats", "Résultats · vraie réponse « Orgueil »", "captured", ["top", "key:L"]),
  scene("complets", "Résultats « knight » (collection : exemple)", "full", ["top", "movies:0", "movies:2", "collections:0", "people:0", "episodes:0"]),
  scene("studio", "Résultats « marvel » (studio)", "studio", ["top", "movies:1", "facets:0"]),
  scene("personne", "Meilleur résultat : une personne", "person", ["top", "movies:0"]),
  scene("correction", "Correction (exemple)", "correction", ["top"]),
  scene("partiel", "Réponse partielle", "partial", ["top", "facets:0"]),
  scene("indexation", "Index en préparation (exemple)", "indexing", ["top"]),
  scene("perimee", "Réponse périmée (exemple)", "stale", ["key:S"]),
  scene("aucun", "Aucun résultat", "none", ["recent:0", "genre:1"]),
  scene("android", "Android TV : touche micro", "android", ["key:mic", "key:space"]),
];
