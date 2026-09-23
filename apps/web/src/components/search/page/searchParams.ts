/**
 * L'état de la page de résultats vit dans son ADRESSE : une recherche se
 * partage, se met en favori, et Retour la retrouve telle qu'on l'a laissée.
 *
 *   /search?q=dune                → tout
 *   /search?q=dune&type=movies    → un seul type, en grille complète
 *   /search?person=<id>&name=…    → une filmographie
 *   /search?genre=Comédie         → un genre
 *   /search?studio=Pixar          → un studio
 */

import type { SearchBrowseTarget } from "@tentacle-tv/api-client";

export const SEARCH_TABS = ["all", "movies", "series", "collections", "people", "episodes"] as const;
export type SearchTab = (typeof SEARCH_TABS)[number];

export interface SearchPageState {
  query: string;
  tab: SearchTab;
  browse: SearchBrowseTarget | null;
  /** Le nom d'une personne parcourue, pour titrer avant la réponse. */
  personName: string | null;
}

export function readSearchParams(params: URLSearchParams): SearchPageState {
  const person = params.get("person");
  const genre = params.get("genre");
  const studio = params.get("studio");
  const tab = params.get("type");
  let browse: SearchBrowseTarget | null = null;
  if (person) browse = { kind: "person", id: person };
  else if (genre) browse = { kind: "genre", name: genre };
  else if (studio) browse = { kind: "studio", name: studio };
  return {
    query: params.get("q") ?? "",
    tab: SEARCH_TABS.includes(tab as SearchTab) ? (tab as SearchTab) : "all",
    browse,
    personName: params.get("name"),
  };
}

/** L'adresse d'une recherche : `tab` omis pour « tout ». */
export function searchHref(query: string, tab: SearchTab = "all"): string {
  const params = new URLSearchParams();
  if (query.trim() !== "") params.set("q", query.trim());
  if (tab !== "all") params.set("type", tab);
  const search = params.toString();
  return search === "" ? "/search" : `/search?${search}`;
}
